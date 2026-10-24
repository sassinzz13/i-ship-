package customers

import (
	"context"
	"fmt"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Customer, int, error)
	Get(ctx context.Context, q database.DBTX, id int64) (*Customer, error)
	Insert(ctx context.Context, q database.DBTX, f Fields, userID *int64) (int64, error)
	Update(ctx context.Context, q database.DBTX, id int64, f Fields) error
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const cols = `id, customer_code, user_id, customer_type, full_name, company_name, email, phone, notes, is_active, user_id IS NOT NULL, created_at, updated_at`

func scan(row interface{ Scan(...any) error }) (Customer, error) {
	var c Customer
	err := row.Scan(&c.ID, &c.CustomerCode, &c.UserID, &c.CustomerType, &c.FullName, &c.CompanyName, &c.Email,
		&c.Phone, &c.Notes, &c.IsActive, &c.HasPortal, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Customer, int, error) {
	where := []string{"TRUE"}
	var args []any
	if f.Search != "" {
		args = append(args, utilities.LikePattern(f.Search))
		n := len(args)
		where = append(where, fmt.Sprintf("(full_name ILIKE $%[1]d OR customer_code ILIKE $%[1]d OR email ILIKE $%[1]d OR phone ILIKE $%[1]d OR company_name ILIKE $%[1]d)", n))
	}
	if f.CustomerType != "" {
		args = append(args, f.CustomerType)
		where = append(where, fmt.Sprintf("customer_type = $%d", len(args)))
	}
	if f.Active != nil {
		args = append(args, *f.Active)
		where = append(where, fmt.Sprintf("is_active = $%d", len(args)))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*) FROM customers WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, p.Limit(), p.Offset())
	rows, err := q.Query(ctx, fmt.Sprintf(`SELECT %s FROM customers WHERE %s ORDER BY %s, id LIMIT $%d OFFSET $%d`,
		cols, cond, s.SQL(), len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Customer{}
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, c)
	}
	return out, total, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64) (*Customer, error) {
	c, err := scan(q.QueryRow(ctx, `SELECT `+cols+` FROM customers WHERE id = $1`, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &c, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, f Fields, userID *int64) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO customers (customer_code, user_id, customer_type, full_name, company_name, email, phone, notes, is_active)
		VALUES ('CUS-' || lpad(nextval('customer_code_seq')::text, 6, '0'), $1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id`,
		userID, f.CustomerType, f.FullName, f.CompanyName, f.Email, f.Phone, f.Notes, f.IsActive).Scan(&id)
	return id, err
}

func (PGRepository) Update(ctx context.Context, q database.DBTX, id int64, f Fields) error {
	_, err := q.Exec(ctx, `
		UPDATE customers SET customer_type = $2, full_name = $3, company_name = $4, email = $5, phone = $6, notes = $7, is_active = $8
		WHERE id = $1`, id, f.CustomerType, f.FullName, f.CompanyName, f.Email, f.Phone, f.Notes, f.IsActive)
	return err
}
