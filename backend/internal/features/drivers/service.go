package drivers

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/users"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

// AccountCreator creates the driver's login (implemented by users.Service).
type AccountCreator interface {
	CreateInTx(ctx context.Context, q database.DBTX, u users.NewUser) (int64, error)
}

type Service struct {
	db       database.DBTX
	tx       database.Transactor
	repo     Repository
	accounts AccountCreator
	audit    audit.Recorder
}

func NewService(db database.DBTX, tx database.Transactor, repo Repository, accounts AccountCreator, rec audit.Recorder) *Service {
	return &Service{db: db, tx: tx, repo: repo, accounts: accounts, audit: rec}
}

func (s *Service) List(ctx context.Context, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]Driver, int, error) {
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Driver, error) {
	d, err := s.repo.Get(ctx, s.db, id, false)
	if err != nil {
		return Driver{}, apperr.Internal(err)
	}
	if d == nil {
		return Driver{}, apperr.NotFound("Driver not found")
	}
	return *d, nil
}

// Lookup loads (and optionally locks) a driver inside the caller's
// transaction, for the assignments feature.
func (s *Service) Lookup(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Driver, error) {
	return s.repo.Get(ctx, q, id, forUpdate)
}

// SetAvailability changes availability inside the caller's transaction.
func (s *Service) SetAvailability(ctx context.Context, q database.DBTX, id int64, availability string) error {
	return s.repo.SetAvailability(ctx, q, id, availability)
}

func parseDate(field, v string) (time.Time, error) {
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return time.Time{}, apperr.Validation("Invalid date", map[string]any{field: "must be a date (YYYY-MM-DD)"})
	}
	return t, nil
}

func mapConflict(err error) error {
	code, constraint := database.PgErrorCode(err)
	if code != database.UniqueViolation {
		return apperr.As(err)
	}
	switch {
	case strings.Contains(constraint, "employee_code"):
		return apperr.Conflict("Employee code already in use").WithDetails(map[string]any{"employeeCode": "is already in use"})
	case strings.Contains(constraint, "license_number"):
		return apperr.Conflict("License number already registered").WithDetails(map[string]any{"licenseNumber": "is already registered"})
	}
	return apperr.Conflict("Driver already exists")
}

type CreateInput struct {
	Fields
	Email    string
	Password string
}

func (s *Service) Create(ctx context.Context, in CreateInput) (Driver, error) {
	in.FullName = strings.TrimSpace(in.FullName)
	in.EmployeeCode = strings.ToUpper(strings.TrimSpace(in.EmployeeCode))
	in.LicenseNumber = strings.ToUpper(strings.TrimSpace(in.LicenseNumber))
	in.Status, in.Availability = StatusActive, Available
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		phone := in.Phone
		uid, err := s.accounts.CreateInTx(ctx, tx, users.NewUser{
			Email: in.Email, Password: in.Password, FullName: in.FullName, Phone: &phone, Role: security.RoleDriver,
		})
		if err != nil {
			return err
		}
		if id, err = s.repo.Insert(ctx, tx, uid, in.Fields); err != nil {
			return mapConflict(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "driver.created", EntityType: audit.EntityDriver, EntityID: audit.ID(id),
			Changes: map[string]any{"employeeCode": in.EmployeeCode, "fullName": in.FullName},
		})
	})
	if err != nil {
		return Driver{}, apperr.As(err)
	}
	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int64, f Fields) (Driver, error) {
	f.FullName = strings.TrimSpace(f.FullName)
	f.EmployeeCode = strings.ToUpper(strings.TrimSpace(f.EmployeeCode))
	f.LicenseNumber = strings.ToUpper(strings.TrimSpace(f.LicenseNumber))
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("Driver not found")
		}
		if f.Status != StatusActive && cur.ActiveAssignments > 0 {
			return apperr.Conflict("Reassign or finish this driver's active assignments before deactivating them")
		}
		if err := s.repo.Update(ctx, tx, id, f); err != nil {
			return mapConflict(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "driver.updated", EntityType: audit.EntityDriver, EntityID: audit.ID(id),
			Changes: map[string]any{
				"status":       map[string]any{"from": cur.Status, "to": f.Status},
				"availability": map[string]any{"from": cur.Availability, "to": f.Availability},
			},
		})
	})
	if err != nil {
		return Driver{}, apperr.As(err)
	}
	return s.Get(ctx, id)
}

func (s *Service) Me(ctx context.Context, actor security.Principal) (Driver, error) {
	if actor.DriverID == nil {
		return Driver{}, apperr.NotFound("No driver profile is linked to this account")
	}
	return s.Get(ctx, *actor.DriverID)
}

// SetMyAvailability lets a driver go on or off duty. Drivers on an active
// delivery cannot go off duty.
func (s *Service) SetMyAvailability(ctx context.Context, actor security.Principal, availability string) (Driver, error) {
	d, err := s.Me(ctx, actor)
	if err != nil {
		return Driver{}, err
	}
	if availability == OffDuty && d.Availability == OnDelivery {
		return Driver{}, apperr.Conflict("Finish your current delivery before going off duty")
	}
	if availability == Available && d.Availability == OnDelivery {
		return d, nil
	}
	err = s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		if err := s.repo.SetAvailability(ctx, tx, d.ID, availability); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "driver.availability_changed", EntityType: audit.EntityDriver, EntityID: audit.ID(d.ID),
			Changes: map[string]any{"from": d.Availability, "to": availability},
		})
	})
	if err != nil {
		return Driver{}, apperr.As(err)
	}
	return s.Get(ctx, d.ID)
}
