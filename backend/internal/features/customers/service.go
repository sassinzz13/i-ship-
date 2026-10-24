package customers

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/users"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

// AccountCreator creates login accounts (implemented by users.Service).
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

func (s *Service) List(ctx context.Context, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]Customer, int, error) {
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

// Get returns a customer. Customers may only read their own record.
func (s *Service) Get(ctx context.Context, actor security.Principal, id int64) (Customer, error) {
	if actor.Role == security.RoleCustomer && (actor.CustomerID == nil || *actor.CustomerID != id) {
		return Customer{}, apperr.NotFound("Customer not found")
	}
	if !actor.IsStaffSide() && actor.Role != security.RoleCustomer {
		return Customer{}, apperr.Forbidden("You do not have access to customers")
	}
	c, err := s.repo.Get(ctx, s.db, id)
	if err != nil {
		return Customer{}, apperr.Internal(err)
	}
	if c == nil {
		return Customer{}, apperr.NotFound("Customer not found")
	}
	return *c, nil
}

// Portal is the optional login account created with a customer.
type Portal struct {
	Email    string
	Password string
}

// Create adds a customer, optionally with a CUSTOMER login account, in one
// transaction.
func (s *Service) Create(ctx context.Context, actor security.Principal, f Fields, portal *Portal) (Customer, error) {
	f.IsActive = true
	if err := normalize(&f); err != nil {
		return Customer{}, err
	}
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		var userID *int64
		if portal != nil {
			uid, err := s.accounts.CreateInTx(ctx, tx, users.NewUser{
				Email: portal.Email, Password: portal.Password, FullName: f.FullName, Phone: &f.Phone, Role: security.RoleCustomer,
			})
			if err != nil {
				return err
			}
			userID = &uid
			if f.Email == nil {
				e := portal.Email
				f.Email = &e
			}
		}
		var err error
		id, err = s.repo.Insert(ctx, tx, f, userID)
		if err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "customer.created", EntityType: audit.EntityCustomer, EntityID: audit.ID(id),
			Changes: map[string]any{"fullName": f.FullName, "customerType": f.CustomerType, "portalAccount": portal != nil},
		})
	})
	if err != nil {
		return Customer{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

func (s *Service) Update(ctx context.Context, actor security.Principal, id int64, f Fields) (Customer, error) {
	if err := normalize(&f); err != nil {
		return Customer{}, err
	}
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("Customer not found")
		}
		if err := s.repo.Update(ctx, tx, id, f); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "customer.updated", EntityType: audit.EntityCustomer, EntityID: audit.ID(id),
			Changes: diff(*cur, f),
		})
	})
	if err != nil {
		return Customer{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// Me returns the calling customer's own record.
func (s *Service) Me(ctx context.Context, actor security.Principal) (Customer, error) {
	if actor.CustomerID == nil {
		return Customer{}, apperr.NotFound("No customer profile is linked to this account")
	}
	return s.Get(ctx, actor, *actor.CustomerID)
}

// UpdateMe lets a customer edit their own name, company and phone.
func (s *Service) UpdateMe(ctx context.Context, actor security.Principal, fullName string, company *string, phone string) (Customer, error) {
	cur, err := s.Me(ctx, actor)
	if err != nil {
		return Customer{}, err
	}
	return s.Update(ctx, actor, cur.ID, Fields{
		CustomerType: cur.CustomerType, FullName: fullName, CompanyName: company, Email: cur.Email,
		Phone: phone, Notes: cur.Notes, IsActive: cur.IsActive,
	})
}

func diff(cur Customer, f Fields) map[string]any {
	ch := map[string]any{}
	if cur.FullName != f.FullName {
		ch["fullName"] = map[string]any{"from": cur.FullName, "to": f.FullName}
	}
	if cur.Phone != f.Phone {
		ch["phone"] = "changed"
	}
	if cur.CustomerType != f.CustomerType {
		ch["customerType"] = map[string]any{"from": cur.CustomerType, "to": f.CustomerType}
	}
	if cur.IsActive != f.IsActive {
		ch["isActive"] = map[string]any{"from": cur.IsActive, "to": f.IsActive}
	}
	if !eq(cur.Email, f.Email) {
		ch["email"] = "changed"
	}
	return ch
}

func eq(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}
