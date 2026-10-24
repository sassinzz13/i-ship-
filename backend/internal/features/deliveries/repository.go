package deliveries

import (
	"context"
	"fmt"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Repository interface {
	List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination) ([]Attempt, int, error)
	Attempts(ctx context.Context, q database.DBTX, shipmentID int64) ([]Attempt, error)
	Proof(ctx context.Context, q database.DBTX, shipmentID int64) (*Proof, error)
	InsertAttempt(ctx context.Context, q database.DBTX, shipmentID, assignmentID int64, in AttemptInput, by int64) (int64, error)
	InsertProof(ctx context.Context, q database.DBTX, shipmentID, attemptID int64, in ProofInput, by int64) error
}

type PGRepository struct{}

func NewRepository() *PGRepository { return &PGRepository{} }

const attemptCols = `t.id, t.shipment_id, s.tracking_number, t.assignment_id, t.attempt_number, t.outcome, t.notes,
	t.latitude::float8, t.longitude::float8, t.attempted_at, du.full_name, rb.id, rb.full_name`

const attemptFrom = ` FROM delivery_attempts t
	JOIN shipments s ON s.id = t.shipment_id
	JOIN delivery_assignments a ON a.id = t.assignment_id
	JOIN drivers d ON d.id = a.driver_id
	JOIN users du ON du.id = d.user_id
	LEFT JOIN users rb ON rb.id = t.recorded_by`

func scanAttempt(row interface{ Scan(...any) error }) (Attempt, error) {
	var a Attempt
	var rbID *int64
	var rbName *string
	err := row.Scan(&a.ID, &a.ShipmentID, &a.TrackingNumber, &a.AssignmentID, &a.AttemptNumber, &a.Outcome, &a.Notes,
		&a.Latitude, &a.Longitude, &a.AttemptedAt, &a.DriverName, &rbID, &rbName)
	if rbID != nil && rbName != nil {
		a.RecordedBy = &UserRef{ID: *rbID, FullName: *rbName}
	}
	return a, err
}

func (PGRepository) List(ctx context.Context, q database.DBTX, f ListFilter, p utilities.Pagination) ([]Attempt, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.Outcome != "" {
		where = append(where, "t.outcome = "+arg(string(f.Outcome)))
	}
	if f.DriverID != nil {
		where = append(where, "a.driver_id = "+arg(*f.DriverID))
	}
	if f.Search != "" {
		n := arg(utilities.LikePattern(f.Search))
		where = append(where, fmt.Sprintf("(s.tracking_number ILIKE %[1]s OR du.full_name ILIKE %[1]s)", n))
	}
	if f.DateFrom != nil {
		where = append(where, "t.attempted_at >= "+arg(*f.DateFrom))
	}
	if f.DateTo != nil {
		where = append(where, "t.attempted_at < "+arg(*f.DateTo))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := q.QueryRow(ctx, `SELECT count(*)`+attemptFrom+` WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := q.Query(ctx, `SELECT `+attemptCols+attemptFrom+` WHERE `+cond+` ORDER BY t.attempted_at DESC, t.id DESC LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Attempt{}
	for rows.Next() {
		a, err := scanAttempt(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}

func (PGRepository) Attempts(ctx context.Context, q database.DBTX, shipmentID int64) ([]Attempt, error) {
	rows, err := q.Query(ctx, `SELECT `+attemptCols+attemptFrom+` WHERE t.shipment_id = $1 ORDER BY t.attempt_number`, shipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Attempt{}
	for rows.Next() {
		a, err := scanAttempt(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (PGRepository) Proof(ctx context.Context, q database.DBTX, shipmentID int64) (*Proof, error) {
	var p Proof
	var cbID *int64
	var cbName *string
	err := q.QueryRow(ctx, `SELECT p.id, p.shipment_id, p.attempt_id, p.recipient_name, p.recipient_relationship, p.notes,
		p.delivered_at, p.signature_key, p.photo_key, u.id, u.full_name
		FROM proof_of_delivery p LEFT JOIN users u ON u.id = p.created_by WHERE p.shipment_id = $1`, shipmentID).
		Scan(&p.ID, &p.ShipmentID, &p.AttemptID, &p.RecipientName, &p.RecipientRelationship, &p.Notes, &p.DeliveredAt,
			&p.SignatureKey, &p.PhotoKey, &cbID, &cbName)
	if database.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.HasSignature, p.HasPhoto = p.SignatureKey != nil, p.PhotoKey != nil
	if cbID != nil && cbName != nil {
		p.CreatedBy = &UserRef{ID: *cbID, FullName: *cbName}
	}
	return &p, nil
}

func (PGRepository) InsertAttempt(ctx context.Context, q database.DBTX, shipmentID, assignmentID int64, in AttemptInput, by int64) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `INSERT INTO delivery_attempts (shipment_id, assignment_id, attempt_number, outcome, notes, latitude, longitude, recorded_by)
		VALUES ($1, $2, (SELECT COALESCE(max(attempt_number), 0) + 1 FROM delivery_attempts WHERE shipment_id = $1), $3, $4, $5, $6, $7)
		RETURNING id`, shipmentID, assignmentID, string(in.Outcome), in.Notes, in.Latitude, in.Longitude, by).Scan(&id)
	return id, err
}

func (PGRepository) InsertProof(ctx context.Context, q database.DBTX, shipmentID, attemptID int64, in ProofInput, by int64) error {
	_, err := q.Exec(ctx, `INSERT INTO proof_of_delivery (shipment_id, attempt_id, recipient_name, recipient_relationship,
		signature_key, photo_key, notes, delivered_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8)`,
		shipmentID, attemptID, in.RecipientName, in.RecipientRelationship, in.SignatureKey, in.PhotoKey, in.Notes, by)
	return err
}
