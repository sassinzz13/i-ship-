package payments

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Payment, int, error)
	Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Payment, error)
	Insert(ctx context.Context, q database.DBTX, r CreateRequest, by int64) (int64, error)
	SetStatus(ctx context.Context, q database.DBTX, id int64, status string, reference *string) error
	RecomputeShipment(ctx context.Context, q database.DBTX, shipmentID int64) (string, error)
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const cols = `p.id, p.shipment_id, s.tracking_number, c.full_name, p.amount::float8, p.method, p.reference, p.status, p.paid_at,
	p.notes, u.id, u.full_name, p.created_at`

const from = ` FROM payments p JOIN shipments s ON s.id = p.shipment_id JOIN customers c ON c.id = s.customer_id
	LEFT JOIN users u ON u.id = p.recorded_by`

func scan(row interface{ Scan(...any) error }) (Payment, error) {
	var p Payment
	var uid *int64
	var uname *string
	err := row.Scan(&p.ID, &p.ShipmentID, &p.TrackingNumber, &p.CustomerName, &p.Amount, &p.Method, &p.Reference, &p.Status,
		&p.PaidAt, &p.Notes, &uid, &uname, &p.CreatedAt)
	if uid != nil && uname != nil {
		p.RecordedBy = &UserRef{ID: *uid, FullName: *uname}
	}
	return p, err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Payment, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.Search != "" {
		n := arg(utilities.LikePattern(f.Search))
		where = append(where, fmt.Sprintf("(s.tracking_number ILIKE %[1]s OR c.full_name ILIKE %[1]s OR p.reference ILIKE %[1]s)", n))
	}
	if f.Status != "" {
		where = append(where, "p.status = "+arg(f.Status))
	}
	if f.Method != "" {
		where = append(where, "p.method = "+arg(f.Method))
	}
	if f.ShipmentID > 0 {
		where = append(where, "p.shipment_id = "+arg(f.ShipmentID))
	}
	if f.CustomerID != nil {
		where = append(where, "s.customer_id = "+arg(*f.CustomerID))
	}
	loc, _ := time.LoadLocation("Asia/Manila")
	if f.DateFrom != "" {
		t, _ := time.ParseInLocation("2006-01-02", f.DateFrom, loc)
		where = append(where, "p.created_at >= "+arg(t))
	}
	if f.DateTo != "" {
		t, _ := time.ParseInLocation("2006-01-02", f.DateTo, loc)
		where = append(where, "p.created_at < "+arg(t.AddDate(0, 0, 1)))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*)`+from+` WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := q.Query(ctx, `SELECT `+cols+from+` WHERE `+cond+` ORDER BY `+s.SQL()+`, p.id DESC LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Payment{}
	for rows.Next() {
		pm, err := scan(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, pm)
	}
	return out, total, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Payment, error) {
	sql := `SELECT ` + cols + from + ` WHERE p.id = $1`
	if forUpdate {
		sql += ` FOR UPDATE OF p`
	}
	pm, err := scan(q.QueryRow(ctx, sql, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &pm, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, r CreateRequest, by int64) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `INSERT INTO payments (shipment_id, amount, method, reference, status, paid_at, notes, recorded_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		r.ShipmentID, r.Amount, r.Method, r.Reference, r.Status, r.PaidAt, r.Notes, by).Scan(&id)
	return id, err
}

func (PGRepository) SetStatus(ctx context.Context, q database.DBTX, id int64, status string, reference *string) error {
	_, err := q.Exec(ctx, `UPDATE payments SET status = $2, reference = COALESCE($3, reference),
		paid_at = CASE WHEN $2 = 'PAID' THEN COALESCE(paid_at, now()) ELSE paid_at END WHERE id = $1`, id, status, reference)
	return err
}

// RecomputeShipment derives shipments.payment_status from its payments.
func (PGRepository) RecomputeShipment(ctx context.Context, q database.DBTX, shipmentID int64) (string, error) {
	var st string
	err := q.QueryRow(ctx, `
		WITH t AS (
			SELECT COALESCE(sum(amount) FILTER (WHERE status = 'PAID'), 0) AS paid,
			       count(*) FILTER (WHERE status = 'REFUNDED') AS refunds
			FROM payments WHERE shipment_id = $1)
		UPDATE shipments s SET payment_status = CASE
			WHEN t.paid <= 0 AND t.refunds > 0 THEN 'REFUNDED'
			WHEN t.paid <= 0 THEN 'UNPAID'
			WHEN t.paid < s.shipping_fee THEN 'PARTIALLY_PAID'
			ELSE 'PAID' END
		FROM t WHERE s.id = $1 RETURNING s.payment_status`, shipmentID).Scan(&st)
	return st, err
}
