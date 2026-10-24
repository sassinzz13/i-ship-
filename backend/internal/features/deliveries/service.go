package deliveries

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/assignments"
	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/notifications"
	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/platform/storage"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type ShipmentOps interface {
	Authorize(ctx context.Context, actor security.Principal, shipmentID int64) error
	Transition(ctx context.Context, q database.DBTX, id int64, in shipments.TransitionInput) (*shipments.Shipment, error)
}

type AssignmentOps interface {
	ActiveForShipment(ctx context.Context, q database.DBTX, shipmentID int64) (*assignments.Assignment, error)
	Complete(ctx context.Context, q database.DBTX, a *assignments.Assignment) error
}

type Service struct {
	db          database.DBTX
	tx          database.Transactor
	repo        Repository
	shipments   ShipmentOps
	assignments AssignmentOps
	files       storage.FileStore
	notifier    notifications.Notifier
	audit       audit.Recorder
}

type Deps struct {
	DB          database.DBTX
	Tx          database.Transactor
	Repo        Repository
	Shipments   ShipmentOps
	Assignments AssignmentOps
	Files       storage.FileStore
	Notifier    notifications.Notifier
	Audit       audit.Recorder
}

func NewService(d Deps) *Service {
	return &Service{db: d.DB, tx: d.Tx, repo: d.Repo, shipments: d.Shipments, assignments: d.Assignments,
		files: d.Files, notifier: d.Notifier, audit: d.Audit}
}

func (s *Service) List(ctx context.Context, f ListFilter, p utilities.Pagination) ([]Attempt, int, error) {
	out, total, err := s.repo.List(ctx, s.db, f, p)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return out, total, nil
}

// Get returns attempts and proof for a shipment the actor can view.
func (s *Service) Get(ctx context.Context, actor security.Principal, shipmentID int64) (Record, error) {
	if err := s.shipments.Authorize(ctx, actor, shipmentID); err != nil {
		return Record{}, err
	}
	attempts, err := s.repo.Attempts(ctx, s.db, shipmentID)
	if err != nil {
		return Record{}, apperr.Internal(err)
	}
	proof, err := s.repo.Proof(ctx, s.db, shipmentID)
	if err != nil {
		return Record{}, apperr.Internal(err)
	}
	return Record{Attempts: attempts, Proof: proof}, nil
}

// activeRun returns the in-progress assignment the actor may record against.
func (s *Service) activeRun(ctx context.Context, q database.DBTX, actor security.Principal, shipmentID int64) (*assignments.Assignment, error) {
	a, err := s.assignments.ActiveForShipment(ctx, q, shipmentID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if actor.Role == security.RoleDriver && (a == nil || actor.DriverID == nil || *actor.DriverID != a.DriverID) {
		return nil, apperr.NotFound("No active delivery for this shipment")
	}
	if a == nil {
		return nil, apperr.Conflict("This shipment has no active delivery assignment")
	}
	if a.Status != assignments.StatusInProgress {
		return nil, apperr.Conflict("Start the delivery before recording an attempt")
	}
	return a, nil
}

// RecordFailedAttempt logs an unsuccessful attempt: the shipment becomes
// FAILED_DELIVERY and the run is closed so dispatch can reassign it.
func (s *Service) RecordFailedAttempt(ctx context.Context, actor security.Principal, shipmentID int64, in AttemptInput) (Attempt, error) {
	if in.Outcome == OutcomeSuccessful {
		return Attempt{}, apperr.Validation("Use proof of delivery to record a successful delivery", map[string]any{"outcome": "cannot be SUCCESSFUL here"})
	}
	if in.Outcome == OutcomeOther && (in.Notes == nil || strings.TrimSpace(*in.Notes) == "") {
		return Attempt{}, apperr.Validation("Describe what happened", map[string]any{"notes": "is required when the outcome is OTHER"})
	}
	var id int64
	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		a, err := s.activeRun(ctx, tx, actor, shipmentID)
		if err != nil {
			return err
		}
		if id, err = s.repo.InsertAttempt(ctx, tx, shipmentID, a.ID, in, actor.UserID); err != nil {
			return apperr.Internal(err)
		}
		note := "Delivery attempt failed: " + strings.ToLower(strings.ReplaceAll(string(in.Outcome), "_", " "))
		if _, err := s.shipments.Transition(ctx, tx, shipmentID, shipments.TransitionInput{To: shipments.StatusFailedDelivery, Notes: &note}); err != nil {
			return err
		}
		if err := s.assignments.Complete(ctx, tx, a); err != nil {
			return err
		}
		if err := s.notifier.NotifyRoles(ctx, tx, []string{"ADMIN", "DISPATCHER"}, notifications.Message{
			Type: "DELIVERY_FAILED", Title: "Delivery failed",
			Message:    fmt.Sprintf("%s: %s (driver %s)", a.Shipment.TrackingNumber, note, a.Driver.FullName),
			EntityType: audit.EntityShipment, EntityID: shipmentID,
		}); err != nil {
			return apperr.Internal(err)
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "delivery.attempt_failed", EntityType: audit.EntityAttempt, EntityID: audit.ID(id),
			Changes: map[string]any{"shipmentId": shipmentID, "outcome": in.Outcome},
		})
	})
	if err != nil {
		return Attempt{}, apperr.As(err)
	}
	attempts, err := s.repo.Attempts(ctx, s.db, shipmentID)
	if err != nil {
		return Attempt{}, apperr.Internal(err)
	}
	for _, a := range attempts {
		if a.ID == id {
			return a, nil
		}
	}
	return Attempt{}, apperr.Internal(fmt.Errorf("attempt %d not found after insert", id))
}

// Upload is an uploaded proof image.
type Upload struct {
	Reader      io.Reader
	ContentType string
}

var imageExt = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}

// SubmitProof stores images, then in one transaction records the successful
// attempt and proof, marks the shipment DELIVERED and completes the run.
// Stored files are removed again if the transaction fails.
func (s *Service) SubmitProof(ctx context.Context, actor security.Principal, shipmentID int64, in ProofInput, signature, photo *Upload) (Record, error) {
	in.RecipientName = strings.TrimSpace(in.RecipientName)
	if in.RecipientName == "" {
		return Record{}, apperr.Validation("Recipient name is required", map[string]any{"recipientName": "is required"})
	}
	if !Relationships[in.RecipientRelationship] {
		return Record{}, apperr.Validation("Invalid relationship", map[string]any{"recipientRelationship": "is invalid"})
	}
	if signature == nil && photo == nil {
		return Record{}, apperr.Validation("A signature or photo is required", map[string]any{"signature": "provide a signature or a photo"})
	}
	var saved []string
	cleanup := func() {
		for _, k := range saved {
			_ = s.files.Delete(context.WithoutCancel(ctx), k)
		}
	}
	for _, f := range []struct {
		up   *Upload
		dst  **string
		name string
	}{{signature, &in.SignatureKey, "signature"}, {photo, &in.PhotoKey, "photo"}} {
		if f.up == nil {
			continue
		}
		key, err := s.files.Save(ctx, "pod", imageExt[f.up.ContentType], f.up.Reader)
		if err != nil {
			cleanup()
			return Record{}, apperr.Internal(fmt.Errorf("store %s: %w", f.name, err))
		}
		saved = append(saved, key)
		*f.dst = &key
	}

	err := s.tx.WithTx(ctx, func(tx pgx.Tx) error {
		a, err := s.activeRun(ctx, tx, actor, shipmentID)
		if err != nil {
			return err
		}
		attemptID, err := s.repo.InsertAttempt(ctx, tx, shipmentID, a.ID,
			AttemptInput{Outcome: OutcomeSuccessful, Notes: in.Notes, Latitude: in.Latitude, Longitude: in.Longitude}, actor.UserID)
		if err != nil {
			return apperr.Internal(err)
		}
		if err := s.repo.InsertProof(ctx, tx, shipmentID, attemptID, in, actor.UserID); err != nil {
			if code, _ := database.PgErrorCode(err); code == database.UniqueViolation {
				return apperr.Conflict("Proof of delivery was already submitted")
			}
			return apperr.Internal(err)
		}
		note := fmt.Sprintf("Received by %s (%s)", in.RecipientName, strings.ToLower(strings.ReplaceAll(in.RecipientRelationship, "_", " ")))
		if _, err := s.shipments.Transition(ctx, tx, shipmentID, shipments.TransitionInput{To: shipments.StatusDelivered, Notes: &note}); err != nil {
			return err
		}
		if err := s.assignments.Complete(ctx, tx, a); err != nil {
			return err
		}
		return s.audit.Record(ctx, tx, audit.Entry{
			Action: "delivery.completed", EntityType: audit.EntityPOD, EntityID: audit.ID(attemptID),
			Changes: map[string]any{"shipmentId": shipmentID, "hasSignature": in.SignatureKey != nil, "hasPhoto": in.PhotoKey != nil},
		})
	})
	if err != nil {
		cleanup()
		return Record{}, apperr.As(err)
	}
	return s.Get(ctx, actor, shipmentID)
}

// ProofImage opens a stored proof image after checking access.
func (s *Service) ProofImage(ctx context.Context, actor security.Principal, shipmentID int64, kind string) (io.ReadCloser, error) {
	if err := s.shipments.Authorize(ctx, actor, shipmentID); err != nil {
		return nil, err
	}
	p, err := s.repo.Proof(ctx, s.db, shipmentID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	var key *string
	if p != nil {
		if kind == "signature" {
			key = p.SignatureKey
		} else {
			key = p.PhotoKey
		}
	}
	if key == nil {
		return nil, apperr.NotFound("Image not found")
	}
	rc, err := s.files.Open(ctx, *key)
	if err != nil {
		return nil, apperr.NotFound("Image not found")
	}
	return rc, nil
}
