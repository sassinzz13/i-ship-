package drivers

import (
	"context"
	"fmt"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Driver, int, error)
	Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Driver, error)
	Insert(ctx context.Context, q database.DBTX, userID int64, f Fields) (int64, error)
	Update(ctx context.Context, q database.DBTX, id int64, f Fields) error
	SetAvailability(ctx context.Context, q database.DBTX, id int64, availability string) error
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const cols = `d.id, d.user_id, u.full_name, u.email, d.employee_code, d.license_number, to_char(d.license_expiry, 'YYYY-MM-DD'),
	d.license_expiry < current_date, d.phone, d.emergency_contact_name, d.emergency_contact_phone, d.status, d.availability,
	(SELECT count(*) FROM delivery_assignments a WHERE a.driver_id = d.id AND a.status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')),
	d.created_at, d.updated_at`

const from = ` FROM drivers d JOIN users u ON u.id = d.user_id`

func scan(row interface{ Scan(...any) error }) (Driver, error) {
	var d Driver
	err := row.Scan(&d.ID, &d.UserID, &d.FullName, &d.Email, &d.EmployeeCode, &d.LicenseNumber, &d.LicenseExpiry,
		&d.LicenseExpired, &d.Phone, &d.EmergencyContactName, &d.EmergencyContactPhone, &d.Status, &d.Availability,
		&d.ActiveAssignments, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Driver, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.Search != "" {
		n := arg(utilities.LikePattern(f.Search))
		where = append(where, fmt.Sprintf("(u.full_name ILIKE %[1]s OR d.employee_code ILIKE %[1]s OR d.license_number ILIKE %[1]s OR d.phone ILIKE %[1]s)", n))
	}
	if f.Status != "" {
		where = append(where, "d.status = "+arg(f.Status))
	}
	if f.Availability != "" {
		where = append(where, "d.availability = "+arg(f.Availability))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*)`+from+` WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := q.Query(ctx, `SELECT `+cols+from+` WHERE `+cond+` ORDER BY `+s.SQL()+`, d.id LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Driver{}
	for rows.Next() {
		d, err := scan(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, d)
	}
	return out, total, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Driver, error) {
	sql := `SELECT ` + cols + from + ` WHERE d.id = $1`
	if forUpdate {
		sql += ` FOR UPDATE OF d`
	}
	d, err := scan(q.QueryRow(ctx, sql, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &d, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, userID int64, f Fields) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `INSERT INTO drivers (user_id, employee_code, license_number, license_expiry, phone,
		emergency_contact_name, emergency_contact_phone, status, availability)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		userID, f.EmployeeCode, f.LicenseNumber, f.LicenseExpiry, f.Phone, f.EmergencyContactName, f.EmergencyContactPhone,
		f.Status, f.Availability).Scan(&id)
	return id, err
}

func (PGRepository) Update(ctx context.Context, q database.DBTX, id int64, f Fields) error {
	if _, err := q.Exec(ctx, `UPDATE drivers SET employee_code=$2, license_number=$3, license_expiry=$4, phone=$5,
		emergency_contact_name=$6, emergency_contact_phone=$7, status=$8, availability=$9 WHERE id = $1`,
		id, f.EmployeeCode, f.LicenseNumber, f.LicenseExpiry, f.Phone, f.EmergencyContactName, f.EmergencyContactPhone,
		f.Status, f.Availability); err != nil {
		return err
	}
	_, err := q.Exec(ctx, `UPDATE users SET full_name = $2, phone = $3 WHERE id = (SELECT user_id FROM drivers WHERE id = $1)`,
		id, f.FullName, f.Phone)
	return err
}

func (PGRepository) SetAvailability(ctx context.Context, q database.DBTX, id int64, availability string) error {
	_, err := q.Exec(ctx, `UPDATE drivers SET availability = $2 WHERE id = $1`, id, availability)
	return err
}
