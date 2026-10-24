package shipments

import (
	"fmt"
	"strings"

	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

const maxItems = 50

// validateInput applies business rules that struct tags cannot express.
func validateInput(in *Input) error {
	details := map[string]any{}
	if _, ok := rates[in.ServiceType]; !ok {
		details["serviceType"] = "is invalid"
	}
	if len(in.Items) == 0 {
		details["items"] = "at least one item is required"
	}
	if len(in.Items) > maxItems {
		details["items"] = fmt.Sprintf("at most %d items are allowed", maxItems)
	}
	for i := range in.Items {
		it := &in.Items[i]
		it.Description = strings.TrimSpace(it.Description)
		if it.Description == "" {
			details[fmt.Sprintf("items[%d].description", i)] = "is required"
		}
		if it.Quantity <= 0 {
			details[fmt.Sprintf("items[%d].quantity", i)] = "must be greater than 0"
		}
		if it.WeightKg <= 0 {
			details[fmt.Sprintf("items[%d].weightKg", i)] = "must be greater than 0"
		}
	}
	if in.ShippingFee != nil && *in.ShippingFee < 0 {
		details["shippingFee"] = "must not be negative"
	}
	if in.ScheduledPickupAt != nil && in.EstimatedDeliveryAt != nil && in.EstimatedDeliveryAt.Before(*in.ScheduledPickupAt) {
		details["estimatedDeliveryAt"] = "must be after the scheduled pickup"
	}
	if in.SpecialInstructions != nil {
		t := strings.TrimSpace(*in.SpecialInstructions)
		in.SpecialInstructions = &t
		if t == "" {
			in.SpecialInstructions = nil
		}
	}
	if len(details) > 0 {
		return apperr.Validation("Invalid shipment data", details)
	}
	return nil
}
