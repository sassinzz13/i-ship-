package addresses

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
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

// canAccess applies ownership: staff see every address book, customers only
// their own.
func canAccess(actor security.Principal, customerID int64) bool {
	if actor.IsStaffSide() {
		return true
	}
	return actor.Role == security.RoleCustomer && actor.CustomerID != nil && *actor.CustomerID == customerID
}

func (s *Service) List(ctx context.Context, actor security.Principal, customerID int64, includeArchived bool) ([]Address, error) {
	if !canAccess(actor, customerID) {
		return nil, apperr.NotFound("Customer not found")
	}
	ok, err := s.repo.CustomerExists(ctx, s.db, customerID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if !ok {
		return nil, apperr.NotFound("Customer not found")
	}
	out, err := s.repo.ListByCustomer(ctx, s.db, customerID, includeArchived)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return out, nil
}

// Lookup returns an address for other features (shipments) inside their
// transaction. It performs no authorization.
func (s *Service) Lookup(ctx context.Context, q database.DBTX, id int64) (*Address, error) {
	return s.repo.Get(ctx, q, id)
}

func (s *Service) get(ctx context.Context, q database.DBTX, id int64) (Address, error) {
	a, err := s.repo.Get(ctx, q, id)
	if err != nil {
		return Address{}, apperr.Internal(err)
	}
	if a == nil {
		return Address{}, apperr.NotFound("Address not found")
	}
	return *a, nil
}

func (s *Service) Create(ctx context.Context, customerID int64, f Fields) (Address, error) {
	normalize(&f)
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		ok, err := s.repo.CustomerExists(ctx, tx, customerID)
		if err != nil {
			return apperr.Internal(err)
		}
		if !ok {
			return apperr.NotFound("Customer not found")
		}
		// The first address of a customer becomes the default.
		existing, err := s.repo.ListByCustomer(ctx, tx, customerID, false)
		if err != nil {
			return apperr.Internal(err)
		}
		if len(existing) == 0 {
			f.IsDefault = true
		}
		if f.IsDefault {
			if err := s.repo.ClearDefault(ctx, tx, customerID, 0); err != nil {
				return apperr.Internal(err)
			}
		}
		if id, err = s.repo.Insert(ctx, tx, customerID, f); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "address.created", EntityType: audit.EntityAddress, EntityID: audit.ID(id),
			Changes: map[string]any{"customerId": customerID, "city": f.City},
		})
	})
	if err != nil {
		return Address{}, apperr.As(err)
	}
	return s.get(ctx, s.db, id)
}

func (s *Service) Update(ctx context.Context, id int64, f Fields) (Address, error) {
	normalize(&f)
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.get(ctx, tx, id)
		if err != nil {
			return err
		}
		if cur.ArchivedAt != nil {
			return apperr.Conflict("Archived addresses cannot be edited")
		}
		if f.IsDefault && !cur.IsDefault {
			if err := s.repo.ClearDefault(ctx, tx, cur.CustomerID, id); err != nil {
				return apperr.Internal(err)
			}
		}
		if err := s.repo.Update(ctx, tx, id, f); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "address.updated", EntityType: audit.EntityAddress, EntityID: audit.ID(id)})
	})
	if err != nil {
		return Address{}, apperr.As(err)
	}
	return s.get(ctx, s.db, id)
}

func (s *Service) Archive(ctx context.Context, id int64) error {
	return apperr.As(s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		if _, err := s.get(ctx, tx, id); err != nil {
			return err
		}
		if err := s.repo.Archive(ctx, tx, id); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "address.archived", EntityType: audit.EntityAddress, EntityID: audit.ID(id)})
	}))
}
