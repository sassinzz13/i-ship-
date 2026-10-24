// Package tracking serves the public, unauthenticated shipment tracking view.
// It deliberately exposes only non-personal information.
package tracking

import (
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
)

type Place struct {
	City     string `json:"city"`
	Province string `json:"province"`
}

type TimelineEntry struct {
	Status      shipments.Status `json:"status"`
	Description string           `json:"description"`
	Location    *string          `json:"location"`
	At          time.Time        `json:"at"`
}

// PublicTracking is the safe public DTO: no names, phone numbers, street
// addresses, amounts or internal notes.
type PublicTracking struct {
	TrackingNumber      string                `json:"trackingNumber"`
	CurrentStatus       shipments.Status      `json:"currentStatus"`
	ServiceType         shipments.ServiceType `json:"serviceType"`
	Origin              Place                 `json:"origin"`
	Destination         Place                 `json:"destination"`
	TotalQuantity       int                   `json:"totalQuantity"`
	EstimatedDeliveryAt *time.Time            `json:"estimatedDeliveryAt"`
	ActualDeliveryAt    *time.Time            `json:"actualDeliveryAt"`
	CreatedAt           time.Time             `json:"createdAt"`
	Timeline            []TimelineEntry       `json:"timeline"`
}
