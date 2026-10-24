package payments

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

// ShipmentAccess reuses the shipment ownership rules.
type ShipmentAccess interface {
	Authorize(ctx context.Context, actor security.Principal, shipmentID int64) error
}

type Service struct {
	db        database.DBTX
	tx        database.Transactor
	repo      Repository
	shipments ShipmentAccess
	audit     audit.Recorder
}

func NewService(db database.DBTX, tx database.Transactor, repo Repository, sh ShipmentAccess, rec audit.Recorder) *Service {
	return &Service{db: db, tx: tx, repo: repo, shipments: sh, audit: rec}
}

func (s *Service) List(ctx context.Context, actor security.Principal, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]Payment, int, error) {
	if actor.Role == security.RoleCustomer {
		if actor.CustomerID == nil {
			return []Payment{}, 0, nil
		}
		f.CustomerID = actor.CustomerID
	}
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

func needsReference(method, status string, ref *string) bool {
	return method != "CASH" && status == "PAID" && (ref == nil || strings.TrimSpace(*ref) == "")
}

func (s *Service) Create(ctx context.Context, actor security.Principal, r CreateRequest) (Payment, error) {
	if needsReference(r.Method, r.Status, r.Reference) {
		return Payment{}, apperr.Validation("A reference number is required", map[string]any{"reference": "is required for non-cash payments"})
	}
	if r.Status == "PAID" && r.PaidAt == nil {
		now := time.Now()
		r.PaidAt = &now
	}
	if err := s.shipments.Authorize(ctx, actor, r.ShipmentID); err != nil {
		return Payment{}, apperr.Validation("Shipment not found", map[string]any{"shipmentId": "does not exist"})
	}
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		var err error
		if id, err = s.repo.Insert(ctx, tx, r, actor.UserID); err != nil {
			if code, _ := database.PgErrorCode(err); code == database.UniqueViolation {
				return apperr.Conflict("This payment reference was already recorded").WithDetails(map[string]any{"reference": "is already recorded"})
			}
			return apperr.Internal(err)
		}
		st, err := s.repo.RecomputeShipment(ctx, tx, r.ShipmentID)
		if err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "payment.recorded", EntityType: audit.EntityPayment, EntityID: audit.ID(id),
			Changes: map[string]any{"shipmentId": r.ShipmentID, "amount": r.Amount, "method": r.Method, "status": r.Status, "shipmentPaymentStatus": st},
		})
	})
	if err != nil {
		return Payment{}, apperr.As(err)
	}
	p, err := s.repo.Get(ctx, s.db, id, false)
	if err != nil || p == nil {
		return Payment{}, apperr.Internal(err)
	}
	return *p, nil
}

var allowedStatus = map[string][]string{
	"PENDING": {"PAID", "FAILED"},
	"PAID":    {"REFUNDED"},
}

func (s *Service) UpdateStatus(ctx context.Context, id int64, r StatusRequest) (Payment, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("Payment not found")
		}
		ok := false
		for _, n := range allowedStatus[cur.Status] {
			ok = ok || n == r.Status
		}
		if !ok {
			return apperr.InvalidTransition("Cannot change payment from "+cur.Status+" to "+r.Status, map[string]any{"from": cur.Status, "to": r.Status})
		}
		ref := r.Reference
		if ref == nil {
			ref = cur.Reference
		}
		if needsReference(cur.Method, r.Status, ref) {
			return apperr.Validation("A reference number is required", map[string]any{"reference": "is required for non-cash payments"})
		}
		if err := s.repo.SetStatus(ctx, tx, id, r.Status, r.Reference); err != nil {
			return apperr.Internal(err)
		}
		st, err := s.repo.RecomputeShipment(ctx, tx, cur.ShipmentID)
		if err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "payment.status_changed", EntityType: audit.EntityPayment, EntityID: audit.ID(id),
			Changes: map[string]any{"from": cur.Status, "to": r.Status, "shipmentPaymentStatus": st},
		})
	})
	if err != nil {
		return Payment{}, apperr.As(err)
	}
	p, err := s.repo.Get(ctx, s.db, id, false)
	if err != nil || p == nil {
		return Payment{}, apperr.Internal(err)
	}
	return *p, nil
}
