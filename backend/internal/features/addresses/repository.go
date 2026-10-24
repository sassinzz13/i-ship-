package addresses

import (
	"context"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
)

type Repository interface {
	ListByCustomer(ctx context.Context, q database.DBTX, customerID int64, includeArchived bool) ([]Address, error)
	Get(ctx context.Context, q database.DBTX, id int64) (*Address, error)
	Insert(ctx context.Context, q database.DBTX, customerID int64, f Fields) (int64, error)
	Update(ctx context.Context, q database.DBTX, id int64, f Fields) error
	ClearDefault(ctx context.Context, q database.DBTX, customerID, exceptID int64) error
	Archive(ctx context.Context, q database.DBTX, id int64) error
	CustomerExists(ctx context.Context, q database.DBTX, customerID int64) (bool, error)
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const cols = `id, customer_id, label, contact_name, contact_phone, line1, line2, barangay, city, province, postal_code,
	country, latitude::float8, longitude::float8, is_default, archived_at, created_at, updated_at`

func scan(row interface{ Scan(...any) error }) (Address, error) {
	var a Address
	err := row.Scan(&a.ID, &a.CustomerID, &a.Label, &a.ContactName, &a.ContactPhone, &a.Line1, &a.Line2, &a.Barangay,
		&a.City, &a.Province, &a.PostalCode, &a.Country, &a.Latitude, &a.Longitude, &a.IsDefault, &a.ArchivedAt,
		&a.CreatedAt, &a.UpdatedAt)
	return a, err
}

func (PGRepository) ListByCustomer(ctx context.Context, q database.DBTX, customerID int64, includeArchived bool) ([]Address, error) {
	rows, err := q.Query(ctx, `SELECT `+cols+` FROM addresses WHERE customer_id = $1 AND ($2 OR archived_at IS NULL)
		ORDER BY is_default DESC, created_at`, customerID, includeArchived)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Address{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64) (*Address, error) {
	a, err := scan(q.QueryRow(ctx, `SELECT `+cols+` FROM addresses WHERE id = $1`, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &a, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, customerID int64, f Fields) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO addresses (customer_id, label, contact_name, contact_phone, line1, line2, barangay, city, province,
			postal_code, country, latitude, longitude, is_default)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
		customerID, f.Label, f.ContactName, f.ContactPhone, f.Line1, f.Line2, f.Barangay, f.City, f.Province,
		f.PostalCode, f.Country, f.Latitude, f.Longitude, f.IsDefault).Scan(&id)
	return id, err
}

func (PGRepository) Update(ctx context.Context, q database.DBTX, id int64, f Fields) error {
	_, err := q.Exec(ctx, `
		UPDATE addresses SET label=$2, contact_name=$3, contact_phone=$4, line1=$5, line2=$6, barangay=$7, city=$8,
			province=$9, postal_code=$10, country=$11, latitude=$12, longitude=$13, is_default=$14
		WHERE id = $1`,
		id, f.Label, f.ContactName, f.ContactPhone, f.Line1, f.Line2, f.Barangay, f.City, f.Province,
		f.PostalCode, f.Country, f.Latitude, f.Longitude, f.IsDefault)
	return err
}

func (PGRepository) ClearDefault(ctx context.Context, q database.DBTX, customerID, exceptID int64) error {
	_, err := q.Exec(ctx, `UPDATE addresses SET is_default = FALSE WHERE customer_id = $1 AND id <> $2 AND is_default`, customerID, exceptID)
	return err
}

func (PGRepository) Archive(ctx context.Context, q database.DBTX, id int64) error {
	_, err := q.Exec(ctx, `UPDATE addresses SET archived_at = now(), is_default = FALSE WHERE id = $1 AND archived_at IS NULL`, id)
	return err
}

func (PGRepository) CustomerExists(ctx context.Context, q database.DBTX, customerID int64) (bool, error) {
	var ok bool
	err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM customers WHERE id = $1)`, customerID).Scan(&ok)
	return ok, err
}
