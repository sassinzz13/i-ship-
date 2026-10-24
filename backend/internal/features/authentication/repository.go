package authentication

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

// Repository is the persistence the authentication service needs.
type Repository interface {
	FindAccountByEmail(ctx context.Context, q database.DBTX, email string) (*Account, error)
	FindAccountByID(ctx context.Context, q database.DBTX, id int64) (*Account, error)
	UpdatePassword(ctx context.Context, q database.DBTX, userID int64, hash string) error
	TouchLastLogin(ctx context.Context, q database.DBTX, userID int64) error
	InsertRefreshToken(ctx context.Context, q database.DBTX, userID int64, hash []byte, family uuid.UUID, expires time.Time, ua, ip string) (int64, error)
	// LockRefreshToken returns the token with the given hash, locking its row.
	LockRefreshToken(ctx context.Context, q database.DBTX, hash []byte) (*RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, q database.DBTX, id int64, replacedBy *int64) error
	RevokeFamily(ctx context.Context, q database.DBTX, family uuid.UUID) error
	RevokeAllForUser(ctx context.Context, q database.DBTX, userID int64) error
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const accountSelect = `
	SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, r.name, u.is_active,
	       c.id, d.id, u.last_login_at
	FROM users u
	JOIN roles r ON r.id = u.role_id
	LEFT JOIN customers c ON c.user_id = u.id
	LEFT JOIN drivers d ON d.user_id = u.id`

func scanAccount(row interface{ Scan(...any) error }) (*Account, error) {
	var a Account
	var role string
	if err := row.Scan(&a.ID, &a.Email, &a.PasswordHash, &a.FullName, &a.Phone, &role, &a.IsActive,
		&a.CustomerID, &a.DriverID, &a.LastLoginAt); err != nil {
		if database.IsNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	a.Role = security.Role(role)
	return &a, nil
}

func (PGRepository) FindAccountByEmail(ctx context.Context, q database.DBTX, email string) (*Account, error) {
	return scanAccount(q.QueryRow(ctx, accountSelect+` WHERE u.email = $1`, email))
}

func (PGRepository) FindAccountByID(ctx context.Context, q database.DBTX, id int64) (*Account, error) {
	return scanAccount(q.QueryRow(ctx, accountSelect+` WHERE u.id = $1`, id))
}

func (PGRepository) UpdatePassword(ctx context.Context, q database.DBTX, userID int64, hash string) error {
	_, err := q.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, hash)
	return err
}

func (PGRepository) TouchLastLogin(ctx context.Context, q database.DBTX, userID int64) error {
	_, err := q.Exec(ctx, `UPDATE users SET last_login_at = now() WHERE id = $1`, userID)
	return err
}

func (PGRepository) InsertRefreshToken(ctx context.Context, q database.DBTX, userID int64, hash []byte, family uuid.UUID, expires time.Time, ua, ip string) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, '')) RETURNING id`,
		userID, hash, family, expires, ua, ip).Scan(&id)
	return id, err
}

func (PGRepository) LockRefreshToken(ctx context.Context, q database.DBTX, hash []byte) (*RefreshToken, error) {
	var t RefreshToken
	err := q.QueryRow(ctx, `
		SELECT id, user_id, family_id, expires_at, revoked_at
		FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`, hash).
		Scan(&t.ID, &t.UserID, &t.FamilyID, &t.ExpiresAt, &t.RevokedAt)
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &t, err
}

func (PGRepository) RevokeRefreshToken(ctx context.Context, q database.DBTX, id int64, replacedBy *int64) error {
	_, err := q.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1 AND revoked_at IS NULL`, id, replacedBy)
	return err
}

func (PGRepository) RevokeFamily(ctx context.Context, q database.DBTX, family uuid.UUID) error {
	_, err := q.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, family)
	return err
}

func (PGRepository) RevokeAllForUser(ctx context.Context, q database.DBTX, userID int64) error {
	_, err := q.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return err
}
