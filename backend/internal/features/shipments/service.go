package shipments

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/addresses"
	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/notifications"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

// AddressLookup resolves addresses (implemented by addresses.Service).
type AddressLookup interface {
	Lookup(ctx context.Context, q database.DBTX, id int64) (*addresses.Address, error)
}

// DriverAccess tells whether a driver is (or was) assigned to a shipment.
// Implemented by the assignments feature and injected after construction to
// avoid an import cycle.
type DriverAccess interface {
	DriverHasShipment(ctx context.Context, q database.DBTX, driverID, shipmentID int64) (bool, error)
}

type Service struct {
	db        database.DBTX
	tx        database.Transactor
	repo      Repository
	addresses AddressLookup
	notifier  notifications.Notifier
	audit     audit.Recorder
	drivers   DriverAccess
	now       func() time.Time
}

type Deps struct {
	DB        database.DBTX
	Tx        database.Transactor
	Repo      Repository
	Addresses AddressLookup
	Notifier  notifications.Notifier
	Audit     audit.Recorder
}

func NewService(d Deps) *Service {
	return &Service{db: d.DB, tx: d.Tx, repo: d.Repo, addresses: d.Addresses, notifier: d.Notifier, audit: d.Audit, now: time.Now}
}

func (s *Service) SetDriverAccess(da DriverAccess) { s.drivers = da }

// List returns shipments visible to the actor. Customers are always scoped to
// their own customer record regardless of the filter they send.
func (s *Service) List(ctx context.Context, actor security.Principal, f ListFilter, p utilities.Pagination, sort utilities.Sort) ([]Summary, int, error) {
	switch {
	case actor.IsStaffSide():
	case actor.Role == security.RoleCustomer && actor.CustomerID != nil:
		f.CustomerID = actor.CustomerID
	default:
		return nil, 0, apperr.Forbidden("You do not have access to shipments")
	}
	out, total, err := s.repo.List(ctx, s.db, f, p, sort)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

// authorize enforces read access to one shipment. Unauthorized callers get
// NOT_FOUND so shipment existence is not disclosed.
func (s *Service) authorize(ctx context.Context, actor security.Principal, sh *Shipment) error {
	notFound := apperr.NotFound("Shipment not found")
	if sh == nil {
		return notFound
	}
	switch {
	case actor.IsStaffSide():
		return nil
	case actor.Role == security.RoleCustomer:
		if actor.CustomerID != nil && *actor.CustomerID == sh.CustomerID {
			return nil
		}
	case actor.Role == security.RoleDriver:
		if actor.DriverID != nil && s.drivers != nil {
			ok, err := s.drivers.DriverHasShipment(ctx, s.db, *actor.DriverID, sh.ID)
			if err != nil {
				return apperr.Internal(err)
			}
			if ok {
				return nil
			}
		}
	}
	return notFound
}

// Get returns a shipment with items and the manual transitions the actor may
// perform.
func (s *Service) Get(ctx context.Context, actor security.Principal, id int64) (Shipment, error) {
	sh, err := s.repo.Get(ctx, s.db, id, false)
	if err != nil {
		return Shipment{}, apperr.Internal(err)
	}
	if err := s.authorize(ctx, actor, sh); err != nil {
		return Shipment{}, err
	}
	if sh.Items, err = s.repo.Items(ctx, s.db, id); err != nil {
		return Shipment{}, apperr.Internal(err)
	}
	sh.AllowedTransitions = []Status{}
	if actor.IsStaffSide() {
		sh.AllowedTransitions = ManualTransitions(sh.CurrentStatus)
	}
	return *sh, nil
}

// Authorize checks the actor may view the shipment; other features (e.g.
// deliveries, payments) reuse the shipment's ownership rules through it.
func (s *Service) Authorize(ctx context.Context, actor security.Principal, shipmentID int64) error {
	sh, err := s.repo.Get(ctx, s.db, shipmentID, false)
	if err != nil {
		return apperr.Internal(err)
	}
	return s.authorize(ctx, actor, sh)
}

// Lookup loads a shipment inside the caller's transaction without
// authorization, optionally locking it.
func (s *Service) Lookup(ctx context.Context, q database.DBTX, id int64, forUpdate bool) (*Shipment, error) {
	return s.repo.Get(ctx, q, id, forUpdate)
}

func (s *Service) History(ctx context.Context, actor security.Principal, id int64) ([]HistoryEntry, error) {
	if err := s.Authorize(ctx, actor, id); err != nil {
		return nil, err
	}
	h, err := s.repo.History(ctx, s.db, id)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return h, nil
}

// validateAddresses checks that both addresses exist, are active and belong
// to the shipment's customer.
func (s *Service) validateAddresses(ctx context.Context, q database.DBTX, in Input) error {
	if in.SenderAddressID == in.RecipientAddressID {
		return apperr.Validation("Sender and recipient must be different addresses", map[string]any{"recipientAddressId": "must differ from the sender address"})
	}
	for field, id := range map[string]int64{"senderAddressId": in.SenderAddressID, "recipientAddressId": in.RecipientAddressID} {
		a, err := s.addresses.Lookup(ctx, q, id)
		if err != nil {
			return apperr.Internal(err)
		}
		if a == nil || a.CustomerID != in.CustomerID {
			return apperr.Validation("Address does not belong to this customer", map[string]any{field: "must be one of the customer's addresses"})
		}
		if a.ArchivedAt != nil {
			return apperr.Validation("Address is archived", map[string]any{field: "is archived"})
		}
	}
	return nil
}

func pricing(in Input) (Totals, float64, float64) {
	t := ComputeTotals(in.Items)
	fee := QuoteFee(in.ServiceType, t.Weight)
	if in.ShippingFee != nil {
		fee = *in.ShippingFee
	}
	declared := t.DeclaredValue
	if in.DeclaredValue != nil {
		declared = *in.DeclaredValue
	}
	return t, fee, declared
}

// Create registers a shipment: tracking number, items, the initial PENDING
// history entry, audit log and customer notification in one transaction.
func (s *Service) Create(ctx context.Context, actor security.Principal, in Input) (Shipment, error) {
	if err := validateInput(&in); err != nil {
		return Shipment{}, err
	}
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		if err := s.validateAddresses(ctx, tx, in); err != nil {
			return err
		}
		t, fee, declared := pricing(in)
		tn, err := NextTrackingNumber(ctx, tx, s.now())
		if err != nil {
			return apperr.Internal(err)
		}
		if id, err = s.repo.Insert(ctx, tx, tn, in, t, fee, declared, actor.UserID); err != nil {
			if code, _ := database.PgErrorCode(err); code == database.ForeignKeyViolation {
				return apperr.Validation("Customer not found", map[string]any{"customerId": "does not exist"})
			}
			return apperr.Internal(err)
		}
		if err := s.repo.ReplaceItems(ctx, tx, id, in.Items); err != nil {
			return apperr.Internal(err)
		}
		note := "Shipment created"
		if err := s.repo.InsertHistory(ctx, tx, id, nil, StatusPending, &note, nil, &actor.UserID); err != nil {
			return apperr.Internal(err)
		}
		if err := s.audit.Record(ctx, tx, audit.Entry{
			Action: "shipment.created", EntityType: audit.EntityShipment, EntityID: audit.ID(id),
			Changes: map[string]any{"trackingNumber": tn, "serviceType": in.ServiceType, "shippingFee": fee, "totalWeight": t.Weight},
		}); err != nil {
			return err
		}
		sh, err := s.repo.Get(ctx, tx, id, false)
		if err != nil {
			return apperr.Internal(err)
		}
		return s.notifyCustomer(ctx, tx, sh, StatusPending)
	})
	if err != nil {
		return Shipment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// Update edits a shipment while it has not been picked up.
func (s *Service) Update(ctx context.Context, actor security.Principal, id int64, in Input) (Shipment, error) {
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("Shipment not found")
		}
		if cur.CurrentStatus != StatusPending && cur.CurrentStatus != StatusConfirmed {
			return apperr.Conflict("Shipments can only be edited before pickup")
		}
		in.CustomerID = cur.CustomerID
		if err := validateInput(&in); err != nil {
			return err
		}
		if err := s.validateAddresses(ctx, tx, in); err != nil {
			return err
		}
		t, fee, declared := pricing(in)
		if err := s.repo.Update(ctx, tx, id, in, t, fee, declared); err != nil {
			return apperr.Internal(err)
		}
		if err := s.repo.ReplaceItems(ctx, tx, id, in.Items); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "shipment.updated", EntityType: audit.EntityShipment, EntityID: audit.ID(id),
			Changes: map[string]any{"shippingFee": map[string]any{"from": cur.ShippingFee, "to": fee}, "totalWeight": map[string]any{"from": cur.TotalWeight, "to": t.Weight}},
		})
	})
	if err != nil {
		return Shipment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// TransitionInput describes one status change.
type TransitionInput struct {
	To       Status
	Notes    *string
	Location *string
}

// ChangeStatus is the operator-facing (manual) status change.
func (s *Service) ChangeStatus(ctx context.Context, actor security.Principal, id int64, in TransitionInput) (Shipment, error) {
	if !in.To.Valid() {
		return Shipment{}, apperr.Validation("Unknown status", map[string]any{"status": "is invalid"})
	}
	if in.To == StatusCancelled && (in.Notes == nil || strings.TrimSpace(*in.Notes) == "") {
		return Shipment{}, apperr.Validation("A cancellation reason is required", map[string]any{"notes": "is required when cancelling"})
	}
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		cur, err := s.repo.Get(ctx, tx, id, true)
		if err != nil {
			return apperr.Internal(err)
		}
		if cur == nil {
			return apperr.NotFound("Shipment not found")
		}
		if systemOnly[in.To] && CanTransition(cur.CurrentStatus, in.To) {
			return apperr.InvalidTransition(fmt.Sprintf("%s is set by the delivery workflow, not manually", in.To),
				map[string]any{"from": cur.CurrentStatus, "to": in.To})
		}
		_, err = s.transitionLocked(ctx, tx, cur, in)
		return err
	})
	if err != nil {
		return Shipment{}, apperr.As(err)
	}
	return s.Get(ctx, actor, id)
}

// Transition changes status inside the caller's transaction (used by the
// assignments and deliveries features). It locks the shipment row.
func (s *Service) Transition(ctx context.Context, q database.DBTX, id int64, in TransitionInput) (*Shipment, error) {
	cur, err := s.repo.Get(ctx, q, id, true)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if cur == nil {
		return nil, apperr.NotFound("Shipment not found")
	}
	return s.transitionLocked(ctx, q, cur, in)
}

// AdvanceTo walks the forward path to target, recording each intermediate
// status. It is a no-op when the shipment is already at target.
func (s *Service) AdvanceTo(ctx context.Context, q database.DBTX, id int64, target Status, notes *string) (*Shipment, error) {
	cur, err := s.repo.Get(ctx, q, id, true)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if cur == nil {
		return nil, apperr.NotFound("Shipment not found")
	}
	if cur.CurrentStatus == target {
		return cur, nil
	}
	path := PathTo(cur.CurrentStatus, target)
	if path == nil {
		return nil, apperr.InvalidTransition(fmt.Sprintf("Cannot move shipment from %s to %s", cur.CurrentStatus, target),
			map[string]any{"from": cur.CurrentStatus, "to": target})
	}
	for _, st := range path {
		if cur, err = s.transitionLocked(ctx, q, cur, TransitionInput{To: st, Notes: notes}); err != nil {
			return nil, err
		}
	}
	return cur, nil
}

// transitionLocked performs a validated status change on a locked row:
// update status, append history, audit and notify — all on q.
func (s *Service) transitionLocked(ctx context.Context, q database.DBTX, cur *Shipment, in TransitionInput) (*Shipment, error) {
	from := cur.CurrentStatus
	if !CanTransition(from, in.To) {
		return nil, apperr.InvalidTransition(fmt.Sprintf("Cannot change status from %s to %s", from, in.To),
			map[string]any{"from": from, "to": in.To, "allowed": transitions[from]})
	}
	var reason *string
	if in.To == StatusCancelled {
		reason = in.Notes
	}
	if err := s.repo.SetStatus(ctx, q, cur.ID, in.To, reason); err != nil {
		return nil, apperr.Internal(err)
	}
	var by *int64
	if p, ok := security.FromContext(ctx); ok {
		by = &p.UserID
	}
	if err := s.repo.InsertHistory(ctx, q, cur.ID, &from, in.To, in.Notes, in.Location, by); err != nil {
		return nil, apperr.Internal(err)
	}
	if err := s.audit.Record(ctx, q, audit.Entry{
		Action: "shipment.status_changed", EntityType: audit.EntityShipment, EntityID: audit.ID(cur.ID),
		Changes: map[string]any{"from": from, "to": in.To, "notes": in.Notes},
	}); err != nil {
		return nil, err
	}
	next := *cur
	next.CurrentStatus = in.To
	if err := s.notifyCustomer(ctx, q, &next, in.To); err != nil {
		return nil, err
	}
	return &next, nil
}

var statusMessages = map[Status]string{
	StatusPending:        "has been created and is awaiting confirmation",
	StatusConfirmed:      "has been confirmed",
	StatusPickedUp:       "has been picked up",
	StatusInTransit:      "is in transit",
	StatusOutForDelivery: "is out for delivery",
	StatusDelivered:      "has been delivered",
	StatusFailedDelivery: "could not be delivered; we will try again",
	StatusReturned:       "has been returned to the sender",
	StatusCancelled:      "has been cancelled",
}

func (s *Service) notifyCustomer(ctx context.Context, q database.DBTX, sh *Shipment, st Status) error {
	if sh == nil || sh.CustomerUserID == nil || s.notifier == nil {
		return nil
	}
	err := s.notifier.Notify(ctx, q, *sh.CustomerUserID, notifications.Message{
		Type:       "SHIPMENT_" + string(st),
		Title:      "Shipment " + strings.ToLower(strings.ReplaceAll(string(st), "_", " ")),
		Message:    fmt.Sprintf("Your shipment %s %s.", sh.TrackingNumber, statusMessages[st]),
		EntityType: audit.EntityShipment,
		EntityID:   sh.ID,
	})
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

// FindByTrackingNumber loads a shipment and its history without
// authorization; the tracking feature uses it to build the public view.
func (s *Service) FindByTrackingNumber(ctx context.Context, tn string) (*Shipment, []HistoryEntry, error) {
	sh, err := s.repo.GetByTrackingNumber(ctx, s.db, tn)
	if err != nil || sh == nil {
		return nil, nil, err
	}
	h, err := s.repo.History(ctx, s.db, sh.ID)
	return sh, h, err
}
