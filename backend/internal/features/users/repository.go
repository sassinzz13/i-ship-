package users

import (
	"context"
	"fmt"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]User, int, error)
	Get(ctx context.Context, q database.DBTX, id int64) (*User, error)
	Insert(ctx context.Context, q database.DBTX, u NewUser, hash string) (int64, error)
	Update(ctx context.Context, q database.DBTX, id int64, fullName string, phone *string, role security.Role, active bool) error
	SetPassword(ctx context.Context, q database.DBTX, id int64, hash string) error
	RevokeSessions(ctx context.Context, q database.DBTX, id int64) error
	CountActiveAdmins(ctx context.Context, q database.DBTX) (int, error)
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const userCols = `u.id, u.email, u.full_name, u.phone, r.name, u.is_active, u.last_login_at, u.created_at, u.updated_at`

func scanUser(row interface{ Scan(...any) error }) (User, error) {
	var u User
	var role string
	err := row.Scan(&u.ID, &u.Email, &u.FullName, &u.Phone, &role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	u.Role = security.Role(role)
	return u, err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]User, int, error) {
	where := []string{"TRUE"}
	args := []any{}
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if f.Search != "" {
		args = append(args, utilities.LikePattern(f.Search))
		n := len(args)
		where = append(where, fmt.Sprintf("(u.email ILIKE $%d OR u.full_name ILIKE $%d)", n, n))
	}
	if f.Role != "" {
		add("r.name = $%d", string(f.Role))
	}
	if f.Active != nil {
		add("u.is_active = $%d", *f.Active)
	}
	cond := strings.Join(where, " AND ")

	var total int
	if err := q.QueryRow(ctx, `SELECT count(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, p.Limit(), p.Offset())
	rows, err := q.Query(ctx, fmt.Sprintf(`SELECT %s FROM users u JOIN roles r ON r.id = u.role_id WHERE %s ORDER BY %s, u.id LIMIT $%d OFFSET $%d`,
		userCols, cond, s.SQL(), len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, u)
	}
	return out, total, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64) (*User, error) {
	u, err := scanUser(q.QueryRow(ctx, `SELECT `+userCols+` FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &u, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, u NewUser, hash string) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name, phone, role_id)
		VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5)) RETURNING id`,
		u.Email, hash, u.FullName, u.Phone, string(u.Role)).Scan(&id)
	return id, err
}

func (PGRepository) Update(ctx context.Context, q database.DBTX, id int64, fullName string, phone *string, role security.Role, active bool) error {
	_, err := q.Exec(ctx, `
		UPDATE users SET full_name = $2, phone = $3, role_id = (SELECT id FROM roles WHERE name = $4), is_active = $5
		WHERE id = $1`, id, fullName, phone, string(role), active)
	return err
}

func (PGRepository) SetPassword(ctx context.Context, q database.DBTX, id int64, hash string) error {
	_, err := q.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, id, hash)
	return err
}

func (PGRepository) RevokeSessions(ctx context.Context, q database.DBTX, id int64) error {
	_, err := q.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, id)
	return err
}

func (PGRepository) CountActiveAdmins(ctx context.Context, q database.DBTX) (int, error) {
	var n int
	err := q.QueryRow(ctx, `SELECT count(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'ADMIN' AND u.is_active`).Scan(&n)
	return n, err
}
