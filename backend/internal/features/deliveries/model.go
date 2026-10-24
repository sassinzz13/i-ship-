// Package deliveries owns delivery attempts and proof of delivery. Attempts
// are append-only; a successful attempt always comes with proof of delivery.
package deliveries

import "time"

type Outcome string

const (
	OutcomeSuccessful           Outcome = "SUCCESSFUL"
	OutcomeRecipientUnavailable Outcome = "RECIPIENT_UNAVAILABLE"
	OutcomeWrongAddress         Outcome = "WRONG_ADDRESS"
	OutcomeRefused              Outcome = "REFUSED"
	OutcomeDamagedPackage       Outcome = "DAMAGED_PACKAGE"
	OutcomeOther                Outcome = "OTHER"
)

var Relationships = map[string]bool{
	"SELF": true, "FAMILY": true, "FRIEND": true, "NEIGHBOR": true, "COLLEAGUE": true, "SECURITY_GUARD": true, "OTHER": true,
}

type UserRef struct {
	ID       int64  `json:"id"`
	FullName string `json:"fullName"`
}

type Attempt struct {
	ID             int64     `json:"id"`
	ShipmentID     int64     `json:"shipmentId"`
	TrackingNumber string    `json:"trackingNumber"`
	AssignmentID   int64     `json:"assignmentId"`
	AttemptNumber  int       `json:"attemptNumber"`
	Outcome        Outcome   `json:"outcome"`
	Notes          *string   `json:"notes"`
	Latitude       *float64  `json:"latitude"`
	Longitude      *float64  `json:"longitude"`
	AttemptedAt    time.Time `json:"attemptedAt"`
	DriverName     *string   `json:"driverName"`
	RecordedBy     *UserRef  `json:"recordedBy"`
}

type Proof struct {
	ID                    int64     `json:"id"`
	ShipmentID            int64     `json:"shipmentId"`
	AttemptID             int64     `json:"attemptId"`
	RecipientName         string    `json:"recipientName"`
	RecipientRelationship string    `json:"recipientRelationship"`
	Notes                 *string   `json:"notes"`
	DeliveredAt           time.Time `json:"deliveredAt"`
	HasSignature          bool      `json:"hasSignature"`
	HasPhoto              bool      `json:"hasPhoto"`
	CreatedBy             *UserRef  `json:"createdBy"`

	SignatureKey *string `json:"-"`
	PhotoKey     *string `json:"-"`
}

type Record struct {
	Attempts []Attempt `json:"attempts"`
	Proof    *Proof    `json:"proof"`
}

type AttemptInput struct {
	Outcome   Outcome
	Notes     *string
	Latitude  *float64
	Longitude *float64
}

type ProofInput struct {
	RecipientName         string
	RecipientRelationship string
	Notes                 *string
	Latitude              *float64
	Longitude             *float64
	SignatureKey          *string
	PhotoKey              *string
}

type ListFilter struct {
	Outcome  Outcome
	DriverID *int64
	Search   string
	DateFrom *time.Time
	DateTo   *time.Time
}
