package vehicles

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Service struct {
	db    database.DBTX
	tx    database.Transactor
	repo  Repository
	audit audit.Recorder
}

func NewService(db database.DBTX, tx database.Transactor, repo Repository, rec audit.Recorder) *Service {
	return &Service{db: db, tx: tx, repo: repo, audit: rec}
}

func normalize(v *VehicleRequest) {
	v.PlateNumber = strings.ToUpper(strings.Join(strings.Fields(v.PlateNumber), " "))
	v.Brand = strings.TrimSpace(v.Brand)
	v.Model = strings.TrimSpace(v.Model)
	if v.Status == "" {
		v.Status = StatusAvailable
	}
}

func conflict(err error) error {
	if code, _ := database.PgErrorCode(err); code == database.UniqueViolation {
		return apperr.Conflict("A vehicle with this plate number already exists").WithDetails(map[string]any{"plateNumber": "is already registered"})
	}
	return apperr.Internal(err)
}

func (s *Service) List(ctx context.Context, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]Vehicle, int, error) {
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Vehicle, error) {
	v, err := s.repo.Get(ctx, s.db, id, false)
	if err != nil {
		return Vehicle{}, apperr.Internal(err)
	}
	if v == nil {
		return Vehicle{}, apperr.NotFound("Vehicle not found")
	}
	return *v, nil
}

// Lookup and SetStatus are used by the assignments feature inside its
// transactions.
func (s *Service) Lookup(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Vehicle, error) {
	return s.repo.Get(ctx, q, id, forUpdate)
}

func (s *Service) SetStatus(ctx context.Context, q database.DBTX, id int64, status string) error {
	return s.repo.SetStatus(ctx, q, id, status)
}

func (s *Service) Create(ctx context.Context, v VehicleRequest) (Vehicle, error) {
	normalize(&v)
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		var err error
		if id, err = s.repo.Insert(ctx, tx, v); err != nil {
			return conflict(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "vehicle.created", EntityType: audit.EntityVehicle, EntityID: audit.ID(id),
			Changes: map[string]any{"plateNumber": v.PlateNumber, "vehicleType": v.VehicleType},
		})
	})
	if err != nil {
		return Vehicle{}, apperr.As(err)
	}
	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int64, v VehicleRequest) (Vehicle, error) {
	normalize(&v)
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("Vehicle not found")
		}
		if err := s.repo.Update(ctx, tx, id, v); err != nil {
			return conflict(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "vehicle.updated", EntityType: audit.EntityVehicle, EntityID: audit.ID(id),
			Changes: map[string]any{"status": map[string]any{"from": cur.Status, "to": v.Status}},
		})
	})
	if err != nil {
		return Vehicle{}, apperr.As(err)
	}
	return s.Get(ctx, id)
}
