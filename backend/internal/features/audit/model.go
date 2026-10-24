// Package audit records and exposes the audit trail. Every feature writes
// audit entries through Recorder inside the same transaction as the change
// being audited, so an audit row exists if and only if the change committed.
package audit

import (
	"encoding/json"
	"time"
)

// Entity types used across features.
const (
	EntityUser       = "user"
	EntityCustomer   = "customer"
	EntityAddress    = "address"
	EntityShipment   = "shipment"
	EntityDriver     = "driver"
	EntityVehicle    = "vehicle"
	EntityAssignment = "assignment"
	EntityAttempt    = "delivery_attempt"
	EntityPOD        = "proof_of_delivery"
	EntityPayment    = "payment"
	EntitySession    = "session"
)

// Entry is a single audited action.
type Entry struct {
	Action     string         // e.g. "shipment.status_changed"
	EntityType string         // one of the Entity* constants
	EntityID   *int64         // nil for actions without a target row
	Changes    map[string]any // non-sensitive before/after values
	// ActorUserID overrides the principal on the context (used by login,
	// where no principal exists yet).
	ActorUserID *int64
	ActorRole   string
}

// Log is a stored audit entry.
type Log struct {
	ID          int64           `json:"id"`
	ActorUserID *int64          `json:"actorUserId"`
	ActorName   *string         `json:"actorName"`
	ActorEmail  *string         `json:"actorEmail"`
	ActorRole   *string         `json:"actorRole"`
	Action      string          `json:"action"`
	EntityType  string          `json:"entityType"`
	EntityID    *int64          `json:"entityId"`
	Changes     json.RawMessage `json:"changes"`
	IPAddress   *string         `json:"ipAddress"`
	UserAgent   *string         `json:"userAgent"`
	RequestID   *string         `json:"requestId"`
	CreatedAt   time.Time       `json:"createdAt"`
}

func ID(v int64) *int64 { return &v }
