package tracking

import (
	"context"
	"regexp"
	"strings"

	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

// ShipmentFinder is implemented by shipments.Service.
type ShipmentFinder interface {
	FindByTrackingNumber(ctx context.Context, tn string) (*shipments.Shipment, []shipments.HistoryEntry, error)
}

var trackingPattern = regexp.MustCompile(`^ISH-\d{8}-\d{6}$`)

var descriptions = map[shipments.Status]string{
	shipments.StatusPending:        "Shipment information received",
	shipments.StatusConfirmed:      "Shipment confirmed and awaiting pickup",
	shipments.StatusPickedUp:       "Parcel picked up",
	shipments.StatusInTransit:      "In transit to the destination hub",
	shipments.StatusOutForDelivery: "Out for delivery",
	shipments.StatusDelivered:      "Delivered",
	shipments.StatusFailedDelivery: "Delivery attempt unsuccessful",
	shipments.StatusReturned:       "Returned to sender",
	shipments.StatusCancelled:      "Shipment cancelled",
}

type Service struct{ finder ShipmentFinder }

func NewService(f ShipmentFinder) *Service { return &Service{finder: f} }

func (s *Service) Track(ctx context.Context, raw string) (PublicTracking, error) {
	tn := strings.ToUpper(strings.TrimSpace(raw))
	if !trackingPattern.MatchString(tn) {
		return PublicTracking{}, apperr.NotFound("No shipment found with that tracking number")
	}
	sh, history, err := s.finder.FindByTrackingNumber(ctx, tn)
	if err != nil {
		return PublicTracking{}, apperr.Internal(err)
	}
	if sh == nil {
		return PublicTracking{}, apperr.NotFound("No shipment found with that tracking number")
	}
	return ToPublic(sh, history), nil
}

// ToPublic maps a shipment to the public view. Free-text notes are dropped
// because operators may write personal details in them.
func ToPublic(sh *shipments.Shipment, history []shipments.HistoryEntry) PublicTracking {
	out := PublicTracking{
		TrackingNumber: sh.TrackingNumber, CurrentStatus: sh.CurrentStatus, ServiceType: sh.ServiceType,
		Origin:              Place{City: sh.Sender.City, Province: sh.Sender.Province},
		Destination:         Place{City: sh.Recipient.City, Province: sh.Recipient.Province},
		TotalQuantity:       sh.TotalQuantity,
		EstimatedDeliveryAt: sh.EstimatedDeliveryAt, ActualDeliveryAt: sh.ActualDeliveryAt, CreatedAt: sh.CreatedAt,
		Timeline: make([]TimelineEntry, 0, len(history)),
	}
	for i := len(history) - 1; i >= 0; i-- {
		h := history[i]
		out.Timeline = append(out.Timeline, TimelineEntry{
			Status: h.ToStatus, Description: descriptions[h.ToStatus], Location: h.Location, At: h.CreatedAt,
		})
	}
	return out
}
