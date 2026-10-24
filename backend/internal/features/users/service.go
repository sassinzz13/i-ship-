package users

import (
	"context"
	"log/slog"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
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

func (s *Service) List(ctx context.Context, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]User, int, error) {
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

func (s *Service) Get(ctx context.Context, id int64) (User, error) {
	u, err := s.repo.Get(ctx, s.db, id)
	if err != nil {
		return User{}, apperr.Internal(err)
	}
	if u == nil {
		return User{}, apperr.NotFound("User not found")
	}
	return *u, nil
}

// Create creates a user in its own transaction.
func (s *Service) Create(ctx context.Context, in NewUser) (User, error) {
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		var err error
		id, err = s.CreateInTx(ctx, tx, in)
		return err
	})
	if err != nil {
		return User{}, err
	}
	return s.Get(ctx, id)
}

// CreateInTx creates a user inside the caller's transaction. Drivers and
// customers use it to onboard a login account together with their profile.
func (s *Service) CreateInTx(ctx context.Context, q database.DBTX, in NewUser) (int64, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.FullName = strings.TrimSpace(in.FullName)
	if !in.Role.Valid() {
		return 0, apperr.Validation("Invalid role", map[string]any{"role": "is invalid"})
	}
	if len(in.Password) < security.MinPasswordLength {
		return 0, apperr.Validation("Password too short", map[string]any{"password": "must be at least 8 characters"})
	}
	hash, err := security.HashPassword(in.Password)
	if err != nil {
		return 0, apperr.Validation("Invalid password", map[string]any{"password": err.Error()})
	}
	id, err := s.repo.Insert(ctx, q, in, hash)
	if err != nil {
		if code, _ := database.PgErrorCode(err); code == database.UniqueViolation {
			return 0, apperr.Conflict("A user with this email already exists").WithDetails(map[string]any{"email": "is already registered"})
		}
		return 0, apperr.Internal(err)
	}
	if err := s.audit.Record(ctx, q, audit.Entry{
		Action: "user.created", EntityType: audit.EntityUser, EntityID: audit.ID(id),
		Changes: map[string]any{"email": in.Email, "role": in.Role},
	}); err != nil {
		return 0, apperr.Internal(err)
	}
	return id, nil
}

type UpdateInput struct {
	FullName string
	Phone    *string
	Role     security.Role
	IsActive bool
}

func (s *Service) Update(ctx context.Context, actor security.Principal, id int64, in UpdateInput) (User, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("User not found")
		}
		if actor.UserID == id && (in.Role != cur.Role || !in.IsActive) {
			return apperr.Forbidden("You cannot change your own role or deactivate yourself")
		}
		if cur.Role == security.RoleAdmin && cur.IsActive && (in.Role != security.RoleAdmin || !in.IsActive) {
			n, err := s.repo.CountActiveAdmins(ctx, tx)
			if err != nil {
				return apperr.Internal(err)
			}
			if n <= 1 {
				return apperr.Conflict("At least one active administrator is required")
			}
		}
		if err := s.repo.Update(ctx, tx, id, strings.TrimSpace(in.FullName), in.Phone, in.Role, in.IsActive); err != nil {
			return apperr.Internal(err)
		}
		if !in.IsActive || in.Role != cur.Role {
			if err := s.repo.RevokeSessions(ctx, tx, id); err != nil {
				return apperr.Internal(err)
			}
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "user.updated", EntityType: audit.EntityUser, EntityID: audit.ID(id),
			Changes: map[string]any{
				"role":     map[string]any{"from": cur.Role, "to": in.Role},
				"isActive": map[string]any{"from": cur.IsActive, "to": in.IsActive},
				"fullName": in.FullName,
			},
		})
	})
	if err != nil {
		return User{}, apperr.As(err)
	}
	return s.Get(ctx, id)
}

func (s *Service) ResetPassword(ctx context.Context, id int64, password string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return apperr.Validation("Invalid password", map[string]any{"password": err.Error()})
	}
	return s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		if err := s.repo.SetPassword(ctx, tx, id, hash); err != nil {
			return err
		}
		if err := s.repo.RevokeSessions(ctx, tx, id); err != nil {
			return err
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "user.password_reset", EntityType: audit.EntityUser, EntityID: audit.ID(id)})
	})
}

// EnsureAdmin creates the bootstrap administrator when no active admin
// exists. It is a no-op when email or password is empty.
func (s *Service) EnsureAdmin(ctx context.Context, email, password string) error {
	if email == "" || password == "" {
		return nil
	}
	n, err := s.repo.CountActiveAdmins(ctx, s.db)
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	_, err = s.Create(ctx, NewUser{Email: email, Password: password, FullName: "System Administrator", Role: security.RoleAdmin})
	if err != nil && !apperr.Is(err, apperr.CodeConflict) {
		return err
	}
	slog.Info("bootstrap administrator ensured")
	return nil
}
