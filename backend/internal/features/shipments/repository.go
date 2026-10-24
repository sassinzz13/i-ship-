package shipments

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Summary, int, error)
	Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Shipment, error)
	GetByTrackingNumber(ctx context.Context, q database.DBTX, tn string) (*Shipment, error)
	Items(ctx context.Context, q database.DBTX, shipmentID int64) ([]Item, error)
	Insert(ctx context.Context, q database.DBTX, tn string, in Input, t Totals, fee, declared float64, createdBy int64) (int64, error)
	Update(ctx context.Context, q database.DBTX, id int64, in Input, t Totals, fee, declared float64) error
	ReplaceItems(ctx context.Context, q database.DBTX, shipmentID int64, items []ItemInput) error
	SetStatus(ctx context.Context, q database.DBTX, id int64, to Status, cancellationReason *string) error
	InsertHistory(ctx context.Context, q database.DBTX, shipmentID int64, from *Status, to Status, notes, location *string, by *int64) error
	History(ctx context.Context, q database.DBTX, shipmentID int64) ([]HistoryEntry, error)
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const summaryCols = `s.id, s.tracking_number, s.customer_id, c.full_name, ra.contact_name, ra.city, ra.province,
	s.service_type, s.current_status, s.payment_status, s.total_weight::float8, s.total_quantity,
	s.shipping_fee::float8, s.estimated_delivery_at, s.created_at`

const summaryFrom = ` FROM shipments s
	JOIN customers c ON c.id = s.customer_id
	JOIN addresses ra ON ra.id = s.recipient_address_id`

func scanSummary(row interface{ Scan(...any) error }, s *Summary) error {
	return row.Scan(&s.ID, &s.TrackingNumber, &s.CustomerID, &s.CustomerName, &s.RecipientName, &s.RecipientCity,
		&s.RecipientProvince, &s.ServiceType, &s.CurrentStatus, &s.PaymentStatus, &s.TotalWeight, &s.TotalQuantity,
		&s.ShippingFee, &s.EstimatedDeliveryAt, &s.CreatedAt)
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Summary, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if f.Search != "" {
		n := arg(utilities.LikePattern(f.Search))
		where = append(where, fmt.Sprintf("(s.tracking_number ILIKE %[1]s OR c.full_name ILIKE %[1]s OR ra.contact_name ILIKE %[1]s)", n))
	}
	if f.Status != "" {
		where = append(where, "s.current_status = "+arg(string(f.Status)))
	}
	if f.ServiceType != "" {
		where = append(where, "s.service_type = "+arg(string(f.ServiceType)))
	}
	if f.PaymentStatus != "" {
		where = append(where, "s.payment_status = "+arg(f.PaymentStatus))
	}
	if f.CustomerID != nil {
		where = append(where, "s.customer_id = "+arg(*f.CustomerID))
	}
	if f.DateFrom != nil {
		where = append(where, "s.created_at >= "+arg(*f.DateFrom))
	}
	if f.DateTo != nil {
		where = append(where, "s.created_at < "+arg(*f.DateTo))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*)`+summaryFrom+` WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := q.Query(ctx, `SELECT `+summaryCols+summaryFrom+` WHERE `+cond+` ORDER BY `+s.SQL()+`, s.id DESC LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Summary{}
	for rows.Next() {
		var sm Summary
		if err := scanSummary(rows, &sm); err != nil {
			return nil, 0, err
		}
		out = append(out, sm)
	}
	return out, total, rows.Err()
}

const addrCols = `%[1]s.id, %[1]s.customer_id, %[1]s.label, %[1]s.contact_name, %[1]s.contact_phone, %[1]s.line1, %[1]s.line2,
	%[1]s.barangay, %[1]s.city, %[1]s.province, %[1]s.postal_code, %[1]s.country, %[1]s.latitude::float8, %[1]s.longitude::float8`

var detailSelect = `SELECT ` + summaryCols + `,
	c.customer_code, c.phone, c.email, c.user_id,
	s.sender_address_id, s.recipient_address_id, s.declared_value::float8, s.special_instructions, s.cancellation_reason,
	s.scheduled_pickup_at, s.actual_delivery_at, s.updated_at, ` +
	fmt.Sprintf(addrCols, "sa") + `, ` + fmt.Sprintf(addrCols, "ra") +
	summaryFrom + ` JOIN addresses sa ON sa.id = s.sender_address_id`

func scanAddr(a *AddressView) []any {
	return []any{&a.ID, &a.CustomerID, &a.Label, &a.ContactName, &a.ContactPhone, &a.Line1, &a.Line2, &a.Barangay,
		&a.City, &a.Province, &a.PostalCode, &a.Country, &a.Latitude, &a.Longitude}
}

func scanDetail(row pgx.Row) (*Shipment, error) {
	var sh Shipment
	dst := []any{&sh.ID, &sh.TrackingNumber, &sh.CustomerID, &sh.CustomerName, &sh.RecipientName, &sh.RecipientCity,
		&sh.RecipientProvince, &sh.ServiceType, &sh.CurrentStatus, &sh.PaymentStatus, &sh.TotalWeight, &sh.TotalQuantity,
		&sh.ShippingFee, &sh.EstimatedDeliveryAt, &sh.CreatedAt,
		&sh.Customer.CustomerCode, &sh.Customer.Phone, &sh.Customer.Email, &sh.CustomerUserID,
		&sh.SenderAddressID, &sh.RecipientAddressID, &sh.DeclaredValue, &sh.SpecialInstructions, &sh.CancellationReason,
		&sh.ScheduledPickupAt, &sh.ActualDeliveryAt, &sh.UpdatedAt}
	dst = append(dst, scanAddr(&sh.Sender)...)
	dst = append(dst, scanAddr(&sh.Recipient)...)
	if err := row.Scan(dst...); err != nil {
		if database.IsNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	sh.Customer.ID = sh.CustomerID
	sh.Customer.FullName = sh.CustomerName
	return &sh, nil
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Shipment, error) {
	sql := detailSelect + ` WHERE s.id = $1`
	if forUpdate {
		sql += ` FOR UPDATE OF s`
	}
	return scanDetail(q.QueryRow(ctx, sql, id))
}

func (PGRepository) GetByTrackingNumber(ctx context.Context, q database.DBTX, tn string) (*Shipment, error) {
	return scanDetail(q.QueryRow(ctx, detailSelect+` WHERE s.tracking_number = $1`, tn))
}

func (PGRepository) Items(ctx context.Context, q database.DBTX, shipmentID int64) ([]Item, error) {
	rows, err := q.Query(ctx, `SELECT id, description, quantity, weight_kg::float8, length_cm::float8, width_cm::float8,
		height_cm::float8, declared_value::float8 FROM shipment_items WHERE shipment_id = $1 ORDER BY id`, shipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Description, &it.Quantity, &it.WeightKg, &it.LengthCm, &it.WidthCm, &it.HeightCm, &it.DeclaredValue); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, tn string, in Input, t Totals, fee, declared float64, createdBy int64) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO shipments (tracking_number, customer_id, sender_address_id, recipient_address_id, service_type,
			total_weight, total_quantity, declared_value, shipping_fee, special_instructions,
			scheduled_pickup_at, estimated_delivery_at, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
		tn, in.CustomerID, in.SenderAddressID, in.RecipientAddressID, string(in.ServiceType),
		t.Weight, t.Quantity, declared, fee, in.SpecialInstructions, in.ScheduledPickupAt, in.EstimatedDeliveryAt, createdBy).Scan(&id)
	return id, err
}

func (PGRepository) Update(ctx context.Context, q database.DBTX, id int64, in Input, t Totals, fee, declared float64) error {
	_, err := q.Exec(ctx, `
		UPDATE shipments SET sender_address_id=$2, recipient_address_id=$3, service_type=$4, total_weight=$5,
			total_quantity=$6, declared_value=$7, shipping_fee=$8, special_instructions=$9,
			scheduled_pickup_at=$10, estimated_delivery_at=$11
		WHERE id = $1`,
		id, in.SenderAddressID, in.RecipientAddressID, string(in.ServiceType), t.Weight, t.Quantity, declared, fee,
		in.SpecialInstructions, in.ScheduledPickupAt, in.EstimatedDeliveryAt)
	return err
}

func (PGRepository) ReplaceItems(ctx context.Context, q database.DBTX, shipmentID int64, items []ItemInput) error {
	if _, err := q.Exec(ctx, `DELETE FROM shipment_items WHERE shipment_id = $1`, shipmentID); err != nil {
		return err
	}
	for _, it := range items {
		if _, err := q.Exec(ctx, `INSERT INTO shipment_items (shipment_id, description, quantity, weight_kg, length_cm, width_cm, height_cm, declared_value)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, shipmentID, it.Description, it.Quantity, it.WeightKg, it.LengthCm, it.WidthCm,
			it.HeightCm, it.DeclaredValue); err != nil {
			return err
		}
	}
	return nil
}

func (PGRepository) SetStatus(ctx context.Context, q database.DBTX, id int64, to Status, cancellationReason *string) error {
	_, err := q.Exec(ctx, `
		UPDATE shipments SET current_status = $2,
			actual_delivery_at = CASE WHEN $2 = 'DELIVERED' THEN now() ELSE NULL END,
			cancellation_reason = CASE WHEN $2 = 'CANCELLED' THEN $3 ELSE cancellation_reason END
		WHERE id = $1`, id, string(to), cancellationReason)
	return err
}

func (PGRepository) InsertHistory(ctx context.Context, q database.DBTX, shipmentID int64, from *Status, to Status, notes, location *string, by *int64) error {
	var fromS *string
	if from != nil {
		v := string(*from)
		fromS = &v
	}
	_, err := q.Exec(ctx, `INSERT INTO shipment_status_history (shipment_id, from_status, to_status, notes, location, changed_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())`, shipmentID, fromS, string(to), notes, location, by)
	return err
}

func (PGRepository) History(ctx context.Context, q database.DBTX, shipmentID int64) ([]HistoryEntry, error) {
	rows, err := q.Query(ctx, `SELECT h.id, h.from_status, h.to_status, h.notes, h.location, u.id, u.full_name, h.created_at
		FROM shipment_status_history h LEFT JOIN users u ON u.id = h.changed_by
		WHERE h.shipment_id = $1 ORDER BY h.created_at, h.id`, shipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HistoryEntry{}
	for rows.Next() {
		var h HistoryEntry
		var uid *int64
		var uname *string
		if err := rows.Scan(&h.ID, &h.FromStatus, &h.ToStatus, &h.Notes, &h.Location, &uid, &uname, &h.CreatedAt); err != nil {
			return nil, err
		}
		if uid != nil && uname != nil {
			h.ChangedBy = &UserRef{ID: *uid, FullName: *uname}
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

