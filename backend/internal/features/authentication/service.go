package authentication

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/requestctx"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

var (
	errInvalidCredentials = apperr.Unauthorized("Invalid email or password")
	errInvalidRefresh     = apperr.Unauthorized("Session expired, please sign in again")
)

type Service struct {
	db         database.DBTX
	tx         database.Transactor
	repo       Repository
	tokens     *security.TokenManager
	audit      audit.Recorder
	refreshTTL time.Duration
	now        func() time.Time
}

type ServiceDeps struct {
	DB         database.DBTX
	Tx         database.Transactor
	Repo       Repository
	Tokens     *security.TokenManager
	Audit      audit.Recorder
	RefreshTTL time.Duration
}

func NewService(d ServiceDeps) *Service {
	return &Service{db: d.DB, tx: d.Tx, repo: d.Repo, tokens: d.Tokens, audit: d.Audit, refreshTTL: d.RefreshTTL, now: time.Now}
}

// Login verifies credentials and starts a new refresh-token family.
func (s *Service) Login(ctx context.Context, email, password string) (Session, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	acct, err := s.repo.FindAccountByEmail(ctx, s.db, email)
	if err != nil {
		return Session{}, apperr.Internal(err)
	}
	if acct == nil {
		security.CheckDummy(password)
		return Session{}, errInvalidCredentials
	}
	if !security.CheckPassword(acct.PasswordHash, password) {
		_ = s.audit.Record(ctx, s.db, audit.Entry{
			Action: "auth.login_failed", EntityType: audit.EntitySession, EntityID: audit.ID(acct.ID),
			ActorUserID: audit.ID(acct.ID), ActorRole: string(acct.Role),
		})
		return Session{}, errInvalidCredentials
	}
	if !acct.IsActive {
		return Session{}, apperr.Forbidden("This account has been deactivated")
	}

	var sess Session
	err = s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		var err error
		sess, err = s.issue(ctx, tx, *acct, uuid.New())
		if err != nil {
			return err
		}
		if err := s.repo.TouchLastLogin(ctx, tx, acct.ID); err != nil {
			return err
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "auth.login", EntityType: audit.EntitySession, EntityID: audit.ID(acct.ID),
			ActorUserID: audit.ID(acct.ID), ActorRole: string(acct.Role),
		})
	})
	if err != nil {
		return Session{}, apperr.As(err)
	}
	return sess, nil
}

// Refresh rotates a refresh token. Presenting a token that was already
// rotated indicates theft, so the entire token family is revoked.
func (s *Service) Refresh(ctx context.Context, raw string) (Session, error) {
	if raw == "" {
		return Session{}, errInvalidRefresh
	}
	var sess Session
	var reuse bool
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		tok, err := s.repo.LockRefreshToken(ctx, tx, hashToken(raw))
		if err != nil {
			return err
		}
		if tok == nil {
			return errInvalidRefresh
		}
		if tok.RevokedAt != nil {
			reuse = true
			if err := s.repo.RevokeFamily(ctx, tx, tok.FamilyID); err != nil {
				return err
			}
			return s.audit.Record(ctx, tx, audit.Entry{
				Action: "auth.refresh_reuse_detected", EntityType: audit.EntitySession,
				EntityID: audit.ID(tok.UserID), ActorUserID: audit.ID(tok.UserID),
			})
		}
		if !s.now().Before(tok.ExpiresAt) {
			return errInvalidRefresh
		}
		acct, err := s.repo.FindAccountByID(ctx, tx, tok.UserID)
		if err != nil {
			return err
		}
		if acct == nil || !acct.IsActive {
			if err := s.repo.RevokeFamily(ctx, tx, tok.FamilyID); err != nil {
				return err
			}
			return errInvalidRefresh
		}
		sess, err = s.issue(ctx, tx, *acct, tok.FamilyID)
		if err != nil {
			return err
		}
		return s.repo.RevokeRefreshToken(ctx, tx, tok.ID, &sess.refreshID)
	})
	if err != nil {
		return Session{}, apperr.As(err)
	}
	if reuse {
		// The family revocation above has committed; reject the request.
		return Session{}, errInvalidRefresh
	}
	return sess, nil
}

// Logout revokes the presented refresh token. It never fails for unknown
// tokens so that logout is idempotent.
func (s *Service) Logout(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	return s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		tok, err := s.repo.LockRefreshToken(ctx, tx, hashToken(raw))
		if err != nil || tok == nil {
			return err
		}
		if err := s.repo.RevokeFamily(ctx, tx, tok.FamilyID); err != nil {
			return err
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "auth.logout", EntityType: audit.EntitySession, EntityID: audit.ID(tok.UserID),
			ActorUserID: audit.ID(tok.UserID),
		})
	})
}

// Me returns the current account.
func (s *Service) Me(ctx context.Context, userID int64) (Account, error) {
	acct, err := s.repo.FindAccountByID(ctx, s.db, userID)
	if err != nil {
		return Account{}, apperr.Internal(err)
	}
	if acct == nil || !acct.IsActive {
		return Account{}, apperr.Unauthorized("Account not found or inactive")
	}
	return *acct, nil
}

// ChangePassword updates the caller's password and signs out every session.
func (s *Service) ChangePassword(ctx context.Context, userID int64, current, next string) error {
	acct, err := s.repo.FindAccountByID(ctx, s.db, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if acct == nil || !security.CheckPassword(acct.PasswordHash, current) {
		return apperr.Validation("Current password is incorrect", map[string]any{"currentPassword": "is incorrect"})
	}
	if current == next {
		return apperr.Validation("New password must differ from the current one", map[string]any{"newPassword": "must differ from the current password"})
	}
	hash, err := security.HashPassword(next)
	if err != nil {
		return apperr.Validation("Invalid password", map[string]any{"newPassword": err.Error()})
	}
	return s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		if err := s.repo.UpdatePassword(ctx, tx, userID, hash); err != nil {
			return err
		}
		if err := s.repo.RevokeAllForUser(ctx, tx, userID); err != nil {
			return err
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "auth.password_changed", EntityType: audit.EntityUser, EntityID: audit.ID(userID)})
	})
}

func (s *Service) issue(ctx context.Context, q database.DBTX, acct Account, family uuid.UUID) (Session, error) {
	access, accessExp, err := s.tokens.Issue(acct.Principal())
	if err != nil {
		return Session{}, fmt.Errorf("issue access token: %w", err)
	}
	raw, err := newRefreshToken()
	if err != nil {
		return Session{}, err
	}
	exp := s.now().Add(s.refreshTTL)
	meta := requestctx.From(ctx)
	id, err := s.repo.InsertRefreshToken(ctx, q, acct.ID, hashToken(raw), family, exp, meta.UserAgent, meta.IP)
	if err != nil {
		return Session{}, fmt.Errorf("store refresh token: %w", err)
	}
	return Session{
		AccessToken: access, AccessExpiresAt: accessExp,
		RefreshToken: raw, RefreshExpiresAt: exp, User: acct, refreshID: id,
	}, nil
}

func newRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", errors.New("generate refresh token")
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(raw string) []byte {
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}
