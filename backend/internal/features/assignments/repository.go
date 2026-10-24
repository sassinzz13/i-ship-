package assignments

import (
	"context"
	"fmt"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Assignment, int, error)
	Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Assignment, error)
	ActiveForShipment(ctx context.Context, q database.DBTX, shipmentID int64, forUpdate bool) (*Assignment, error)
	Insert(ctx context.Context, q database.DBTX, shipmentID, driverID, vehicleID, assignedBy int64, notes *string) (int64, error)
	SetStatus(ctx context.Context, q database.DBTX, id int64, to Status, notes *string) error
	CountInProgress(ctx context.Context, q database.DBTX, driverID, vehicleID int64, exceptID int64) (driver, vehicle int, err error)
	DriverHasShipment(ctx context.Context, q database.DBTX, driverID, shipmentID int64) (bool, error)
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const cols = `a.id, a.shipment_id, a.driver_id, a.vehicle_id, a.status, a.notes, a.assigned_at, a.accepted_at, a.started_at,
	a.completed_at, a.cancelled_at,
	s.tracking_number, s.current_status, s.service_type, s.total_weight::float8, s.total_quantity,
	ra.contact_name, ra.contact_phone,
	concat_ws(', ', ra.line1, ra.line2, ra.barangay, ra.city, ra.province), ra.city, s.special_instructions, s.estimated_delivery_at,
	du.full_name, d.employee_code, d.phone, d.user_id,
	v.plate_number, v.vehicle_type, v.brand, v.model,
	ab.id, ab.full_name`

const from = ` FROM delivery_assignments a
	JOIN shipments s ON s.id = a.shipment_id
	JOIN addresses ra ON ra.id = s.recipient_address_id
	JOIN drivers d ON d.id = a.driver_id
	JOIN users du ON du.id = d.user_id
	JOIN vehicles v ON v.id = a.vehicle_id
	LEFT JOIN users ab ON ab.id = a.assigned_by`

func scan(row interface{ Scan(...any) error }) (Assignment, error) {
	var a Assignment
	var abID *int64
	var abName *string
	err := row.Scan(&a.ID, &a.ShipmentID, &a.DriverID, &a.VehicleID, &a.Status, &a.Notes, &a.AssignedAt, &a.AcceptedAt,
		&a.StartedAt, &a.CompletedAt, &a.CancelledAt,
		&a.Shipment.TrackingNumber, &a.Shipment.CurrentStatus, &a.Shipment.ServiceType, &a.Shipment.TotalWeight, &a.Shipment.TotalQuantity,
		&a.Shipment.RecipientName, &a.Shipment.RecipientPhone, &a.Shipment.RecipientAddress, &a.Shipment.RecipientCity,
		&a.Shipment.SpecialInstructions, &a.Shipment.EstimatedDeliveryAt,
		&a.Driver.FullName, &a.Driver.EmployeeCode, &a.Driver.Phone, &a.DriverUserID,
		&a.Vehicle.PlateNumber, &a.Vehicle.VehicleType, &a.Vehicle.Brand, &a.Vehicle.Model,
		&abID, &abName)
	if err != nil {
		return a, err
	}
	a.Shipment.ID, a.Driver.ID, a.Vehicle.ID = a.ShipmentID, a.DriverID, a.VehicleID
	if abID != nil && abName != nil {
		a.AssignedBy = &UserRef{ID: *abID, FullName: *abName}
	}
	return a, nil
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination, s utilities.Sort) ([]Assignment, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.Status != "" {
		where = append(where, "a.status = "+arg(string(f.Status)))
	}
	if len(f.Statuses) > 0 {
		ss := make([]string, len(f.Statuses))
		for i, x := range f.Statuses {
			ss[i] = string(x)
		}
		where = append(where, "a.status = ANY("+arg(ss)+")")
	}
	if f.ActiveOnly {
		where = append(where, "a.status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')")
	}
	if f.DriverID != nil {
		where = append(where, "a.driver_id = "+arg(*f.DriverID))
	}
	if f.ShipmentID != nil {
		where = append(where, "a.shipment_id = "+arg(*f.ShipmentID))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*) FROM delivery_assignments a WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := q.Query(ctx, `SELECT `+cols+from+` WHERE `+cond+` ORDER BY `+s.SQL()+`, a.id DESC LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Assignment{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}

func (PGRepository) Get(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Assignment, error) {
	sql := `SELECT ` + cols + from + ` WHERE a.id = $1`
	if forUpdate {
		sql += ` FOR UPDATE OF a`
	}
	a, err := scan(q.QueryRow(ctx, sql, id))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &a, err
}

func (PGRepository) ActiveForShipment(ctx context.Context, q database.DBTX, shipmentID int64, forUpdate bool) (*Assignment, error) {
	sql := `SELECT ` + cols + from + ` WHERE a.shipment_id = $1 AND a.status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')`
	if forUpdate {
		sql += ` FOR UPDATE OF a`
	}
	a, err := scan(q.QueryRow(ctx, sql, shipmentID))
	if database.IsNoRows(err) {
		return nil, nil
	}
	return &a, err
}

func (PGRepository) Insert(ctx context.Context, q database.DBTX, shipmentID, driverID, vehicleID, assignedBy int64, notes *string) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `INSERT INTO delivery_assignments (shipment_id, driver_id, vehicle_id, assigned_by, notes)
		VALUES ($1,$2,$3,$4,$5) RETURNING id`, shipmentID, driverID, vehicleID, assignedBy, notes).Scan(&id)
	return id, err
}

func (PGRepository) SetStatus(ctx context.Context, q database.DBTX, id int64, to Status, notes *string) error {
	_, err := q.Exec(ctx, `UPDATE delivery_assignments SET status = $2,
		accepted_at  = CASE WHEN $2 = 'ACCEPTED' THEN now() ELSE accepted_at END,
		started_at   = CASE WHEN $2 = 'IN_PROGRESS' THEN now() ELSE started_at END,
		completed_at = CASE WHEN $2 = 'COMPLETED' THEN now() ELSE completed_at END,
		cancelled_at = CASE WHEN $2 IN ('CANCELLED','REJECTED') THEN now() ELSE cancelled_at END,
		notes = COALESCE($3, notes)
		WHERE id = $1`, id, string(to), notes)
	return err
}

func (PGRepository) CountInProgress(ctx context.Context, q database.DBTX, driverID, vehicleID int64, exceptID int64) (int, int, error) {
	var d, v int
	err := q.QueryRow(ctx, `SELECT
		count(*) FILTER (WHERE driver_id = $1),
		count(*) FILTER (WHERE vehicle_id = $2)
		FROM delivery_assignments WHERE status = 'IN_PROGRESS' AND id <> $3`, driverID, vehicleID, exceptID).Scan(&d, &v)
	return d, v, err
}

func (PGRepository) DriverHasShipment(ctx context.Context, q database.DBTX, driverID, shipmentID int64) (bool, error) {
	var ok bool
	err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM delivery_assignments WHERE driver_id = $1 AND shipment_id = $2
		AND status <> 'REJECTED')`, driverID, shipmentID).Scan(&ok)
	return ok, err
}
