package assignments

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/drivers"
	"github.com/sassinzz13/i-ship/backend/internal/features/notifications"
	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	"github.com/sassinzz13/i-ship/backend/internal/features/vehicles"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

// Collaborators, implemented by the shipments, drivers and vehicles services.
type ShipmentOps interface {
	Lookup(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*shipments.Shipment, error)
	AdvanceTo(ctx context.Context, q database.DBTX, id int64, target shipments.Status, notes *string) (*shipments.Shipment, error)
}

type DriverOps interface {
	Lookup(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*drivers.Driver, error)
	SetAvailability(ctx context.Context, q database.DBTX, id int64, availability string) error
}

type VehicleOps interface {
	Lookup(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*vehicles.Vehicle, error)
	SetStatus(ctx context.Context, q database.DBTX, id int64, status string) error
}

type Service struct {
	db        database.DBTX
	tx        database.Transactor
	repo      Repository
	shipments ShipmentOps
	drivers   DriverOps
	vehicles  VehicleOps
	notifier  notifications.Notifier
	audit     audit.Recorder
	today     func() time.Time
}

type Deps struct {
	DB        database.DBTX
	Tx        database.Transactor
	Repo      Repository
	Shipments ShipmentOps
	Drivers   DriverOps
	Vehicles  VehicleOps
	Notifier  notifications.Notifier
	Audit     audit.Recorder
}

func NewService(d Deps) *Service {
	return &Service{db: d.DB, tx: d.Tx, repo: d.Repo, shipments: d.Shipments, drivers: d.Drivers, vehicles: d.Vehicles,
		notifier: d.Notifier, audit: d.Audit, today: time.Now}
}

// AssignableStatuses are the shipment states a driver can be assigned in.
var AssignableStatuses = map[shipments.Status]bool{
	shipments.StatusConfirmed: true, shipments.StatusPickedUp: true,
	shipments.StatusInTransit: true, shipments.StatusFailedDelivery: true,
}

func (s *Service) List(ctx context.Context, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]Assignment, int, error) {
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

// Get returns an assignment; drivers may only read their own.
func (s *Service) Get(ctx context.Context, actor security.Principal, id int64) (Assignment, error) {
	a, err := s.repo.Get(ctx, s.db, id, false)
	if err != nil {
		return Assignment{}, apperr.Internal(err)
	}
	if a == nil || (actor.Role == security.RoleDriver && (actor.DriverID == nil || *actor.DriverID != a.DriverID)) {
		return Assignment{}, apperr.NotFound("Assignment not found")
	}
	return *a, nil
}

// Mine lists the calling driver's active assignments, or recent history.
func (s *Service) Mine(ctx context.Context, actor security.Principal, history bool) ([]Assignment, error) {
	if actor.DriverID == nil {
		return nil, apperr.NotFound("No driver profile is linked to this account")
	}
	f := ListFilter{DriverID: actor.DriverID, ActiveOnly: !history}
	sort := utilities.Sort{Column: "a.assigned_at"}
	if history {
		f.Statuses = []Status{StatusCompleted, StatusCancelled, StatusRejected}
		sort.Desc = true
	}
	out, _, err := s.repo.List(ctx, s.db, f, utilities.Pagination{Page: 1, PageSize: 50}, sort)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return out, nil
}

// DriverHasShipment implements shipments.DriverAccess.
func (s *Service) DriverHasShipment(ctx context.Context, q database.DBTX, driverID, shipmentID int64) (bool, error) {
	return s.repo.DriverHasShipment(ctx, q, driverID, shipmentID)
}

type CreateInput struct {
	ShipmentID int64
	DriverID   int64
	VehicleID  int64
	Notes      *string
}

// Create assigns a driver and vehicle to a shipment after checking every
// business rule, inside one transaction with the shipment row locked.
func (s *Service) Create(ctx context.Context, actor security.Principal, in CreateInput) (Assignment, error) {
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		sh, err := s.shipments.Lookup(ctx, tx, in.ShipmentID, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if sh == nil {
			return apperr.Validation("Shipment not found", map[string]any{"shipmentId": "does not exist"})
		}
		if !AssignableStatuses[sh.CurrentStatus] {
			return apperr.Conflict(fmt.Sprintf("Shipments in status %s cannot be assigned", sh.CurrentStatus))
		}
		existing, err := s.repo.ActiveForShipment(ctx, tx, sh.ID, false)
		if err != nil {
			return apperr.Internal(err)
		}
		if existing != nil {
			return apperr.Conflict("This shipment already has an active assignment")
		}
		if err := s.checkDriver(ctx, tx, in.DriverID); err != nil {
			return err
		}
		if err := s.checkVehicle(ctx, tx, in.VehicleID, sh.TotalWeight); err != nil {
			return err
		}
		id, err = s.repo.Insert(ctx, tx, sh.ID, in.DriverID, in.VehicleID, actor.UserID, in.Notes)
		if err != nil {
			if code, _ := database.PgErrorCode(err); code == database.UniqueViolation {
				return apperr.Conflict("This shipment already has an active assignment")
			}
			return apperr.Internal(err)
		}
		if err := s.audit.Record(ctx, tx, audit.Entry{
			Action: "assignment.created", EntityType: audit.EntityAssignment, EntityID: audit.ID(id),
			Changes: map[string]any{"shipmentId": sh.ID, "trackingNumber": sh.TrackingNumber, "driverId": in.DriverID, "vehicleId": in.VehicleID},
		}); err != nil {
			return err
		}
		a, err := s.repo.Get(ctx, tx, id, false)
		if err != nil {
			return apperr.Internal(err)
		}
		return s.notifier.Notify(ctx, tx, a.DriverUserID, notifications.Message{
			Type: "ASSIGNMENT_CREATED", Title: "New delivery assigned",
			Message:    fmt.Sprintf("%s to %s (%s).", sh.TrackingNumber, a.Shipment.RecipientName, a.Shipment.RecipientCity),
			EntityType: audit.EntityAssignment, EntityID: id,
		})
	})
	if err != nil {
		return Assignment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

func (s *Service) checkDriver(ctx context.Context, q database.DBTX, id int64) error {
	d, err := s.drivers.Lookup(ctx, q, id, true)
	if err != nil {
		return apperr.Internal(err)
	}
	switch {
	case d == nil:
		return apperr.Validation("Driver not found", map[string]any{"driverId": "does not exist"})
	case d.Status != drivers.StatusActive:
		return apperr.Validation("Driver is not active", map[string]any{"driverId": "driver status is " + d.Status})
	case d.LicenseExpired:
		return apperr.Validation("Driver's license has expired", map[string]any{"driverId": "license expired on " + d.LicenseExpiry})
	case d.Availability == drivers.OffDuty:
		return apperr.Validation("Driver is off duty", map[string]any{"driverId": "driver is off duty"})
	}
	return nil
}

func (s *Service) checkVehicle(ctx context.Context, q database.DBTX, id int64, weight float64) error {
	v, err := s.vehicles.Lookup(ctx, q, id, true)
	if err != nil {
		return apperr.Internal(err)
	}
	switch {
	case v == nil:
		return apperr.Validation("Vehicle not found", map[string]any{"vehicleId": "does not exist"})
	case v.Status != vehicles.StatusAvailable && v.Status != vehicles.StatusInUse:
		return apperr.Validation("Vehicle is not available", map[string]any{"vehicleId": "vehicle status is " + v.Status})
	case v.WeightCapacityKg < weight:
		return apperr.Validation("Vehicle capacity is too small",
			map[string]any{"vehicleId": fmt.Sprintf("capacity %.0f kg is below shipment weight %.2f kg", v.WeightCapacityKg, weight)})
	}
	return nil
}

// lockOwn loads an assignment for update and verifies the calling driver owns it.
func (s *Service) lockOwn(ctx context.Context, q database.DBTX, actor security.Principal, id int64) (*Assignment, error) {
	a, err := s.repo.Get(ctx, q, id, true)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if a == nil || actor.DriverID == nil || *actor.DriverID != a.DriverID {
		return nil, apperr.NotFound("Assignment not found")
	}
	return a, nil
}

func invalid(a *Assignment, action string) error {
	return apperr.InvalidTransition(fmt.Sprintf("Cannot %s an assignment that is %s", action, a.Status),
		map[string]any{"status": a.Status})
}

func (s *Service) Accept(ctx context.Context, actor security.Principal, id int64) (Assignment, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		a, err := s.lockOwn(ctx, tx, actor, id)
		if err != nil {
			return err
		}
		if a.Status != StatusAssigned {
			return invalid(a, "accept")
		}
		if err := s.repo.SetStatus(ctx, tx, id, StatusAccepted, nil); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "assignment.accepted", EntityType: audit.EntityAssignment, EntityID: audit.ID(id)})
	})
	if err != nil {
		return Assignment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

func (s *Service) Reject(ctx context.Context, actor security.Principal, id int64, reason string) (Assignment, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		a, err := s.lockOwn(ctx, tx, actor, id)
		if err != nil {
			return err
		}
		if a.Status != StatusAssigned && a.Status != StatusAccepted {
			return invalid(a, "reject")
		}
		note := "Rejected by driver: " + reason
		if err := s.repo.SetStatus(ctx, tx, id, StatusRejected, &note); err != nil {
			return apperr.Internal(err)
		}
		if err := s.notifier.NotifyRoles(ctx, tx, []string{"ADMIN", "DISPATCHER"}, notifications.Message{
			Type: "ASSIGNMENT_REJECTED", Title: "Assignment rejected",
			Message:    fmt.Sprintf("%s rejected %s: %s", a.Driver.FullName, a.Shipment.TrackingNumber, reason),
			EntityType: audit.EntityShipment, EntityID: a.ShipmentID,
		}); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "assignment.rejected", EntityType: audit.EntityAssignment,
			EntityID: audit.ID(id), Changes: map[string]any{"reason": reason}})
	})
	if err != nil {
		return Assignment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// Start begins the delivery run: the shipment advances (recording each step)
// to OUT_FOR_DELIVERY, the driver goes ON_DELIVERY and the vehicle IN_USE.
func (s *Service) Start(ctx context.Context, actor security.Principal, id int64) (Assignment, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		a, err := s.lockOwn(ctx, tx, actor, id)
		if err != nil {
			return err
		}
		if a.Status != StatusAccepted {
			return invalid(a, "start")
		}
		note := fmt.Sprintf("Out for delivery with %s (%s)", a.Driver.FullName, a.Vehicle.PlateNumber)
		if _, err := s.shipments.AdvanceTo(ctx, tx, a.ShipmentID, shipments.StatusOutForDelivery, &note); err != nil {
			return err
		}
		if err := s.repo.SetStatus(ctx, tx, id, StatusInProgress, nil); err != nil {
			return apperr.Internal(err)
		}
		if err := s.drivers.SetAvailability(ctx, tx, a.DriverID, drivers.OnDelivery); err != nil {
			return apperr.Internal(err)
		}
		if err := s.vehicles.SetStatus(ctx, tx, a.VehicleID, vehicles.StatusInUse); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "assignment.started", EntityType: audit.EntityAssignment, EntityID: audit.ID(id)})
	})
	if err != nil {
		return Assignment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// Cancel ends an active assignment (dispatcher action).
func (s *Service) Cancel(ctx context.Context, actor security.Principal, id int64, reason *string) (Assignment, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		a, err := s.repo.Get(ctx, tx, id, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if a == nil {
			return apperr.NotFound("Assignment not found")
		}
		if !a.Status.Active() {
			return invalid(a, "cancel")
		}
		if err := s.repo.SetStatus(ctx, tx, id, StatusCancelled, reason); err != nil {
			return apperr.Internal(err)
		}
		if err := s.release(ctx, tx, a); err != nil {
			return err
		}
		if err := s.notifier.Notify(ctx, tx, a.DriverUserID, notifications.Message{
			Type: "ASSIGNMENT_CANCELLED", Title: "Assignment cancelled",
			Message:    fmt.Sprintf("Your assignment for %s was cancelled.", a.Shipment.TrackingNumber),
			EntityType: audit.EntityAssignment, EntityID: id,
		}); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{Action: "assignment.cancelled", EntityType: audit.EntityAssignment,
			EntityID: audit.ID(id), Changes: map[string]any{"reason": reason}})
	})
	if err != nil {
		return Assignment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// ActiveForShipment returns the locked active assignment of a shipment, for
// the deliveries feature.
func (s *Service) ActiveForShipment(ctx context.Context, q database.DBTX, shipmentID int64) (*Assignment, error) {
	return s.repo.ActiveForShipment(ctx, q, shipmentID, true)
}

// Complete closes an assignment after a delivery attempt and frees the
// driver and vehicle when they have no other run in progress.
func (s *Service) Complete(ctx context.Context, q database.DBTX, a *Assignment) error {
	if err := s.repo.SetStatus(ctx, q, a.ID, StatusCompleted, nil); err != nil {
		return apperr.Internal(err)
	}
	if err := s.release(ctx, q, a); err != nil {
		return err
	}
	return s.audit.Record(ctx, q, audit.Entry{Action: "assignment.completed", EntityType: audit.EntityAssignment, EntityID: audit.ID(a.ID)})
}

func (s *Service) release(ctx context.Context, q database.DBTX, a *Assignment) error {
	if a.Status != StatusInProgress {
		return nil
	}
	d, v, err := s.repo.CountInProgress(ctx, q, a.DriverID, a.VehicleID, a.ID)
	if err != nil {
		return apperr.Internal(err)
	}
	if d == 0 {
		if err := s.drivers.SetAvailability(ctx, q, a.DriverID, drivers.Available); err != nil {
			return apperr.Internal(err)
		}
	}
	if v == 0 {
		if err := s.vehicles.SetStatus(ctx, q, a.VehicleID, vehicles.StatusAvailable); err != nil {
			return apperr.Internal(err)
		}
	}
	return nil
}
