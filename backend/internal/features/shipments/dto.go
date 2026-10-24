package shipments

import "time"

type ItemRequest struct {
	Description   string   `json:"description" binding:"required,min=1,max=200"`
	Quantity      int      `json:"quantity" binding:"required,gt=0,lte=10000"`
	WeightKg      float64  `json:"weightKg" binding:"required,gt=0,lte=10000"`
	LengthCm      *float64 `json:"lengthCm" binding:"omitempty,gt=0,lte=1000"`
	WidthCm       *float64 `json:"widthCm" binding:"omitempty,gt=0,lte=1000"`
	HeightCm      *float64 `json:"heightCm" binding:"omitempty,gt=0,lte=1000"`
	DeclaredValue *float64 `json:"declaredValue" binding:"omitempty,gte=0"`
}

type ShipmentRequest struct {
	CustomerID          int64         `json:"customerId"`
	SenderAddressID     int64         `json:"senderAddressId" binding:"required,gt=0"`
	RecipientAddressID  int64         `json:"recipientAddressId" binding:"required,gt=0"`
	ServiceType         string        `json:"serviceType" binding:"required,oneof=STANDARD EXPRESS SAME_DAY NEXT_DAY"`
	DeclaredValue       *float64      `json:"declaredValue" binding:"omitempty,gte=0"`
	ShippingFee         *float64      `json:"shippingFee" binding:"omitempty,gte=0"`
	SpecialInstructions *string       `json:"specialInstructions" binding:"omitempty,max=1000"`
	ScheduledPickupAt   *time.Time    `json:"scheduledPickupAt"`
	EstimatedDeliveryAt *time.Time    `json:"estimatedDeliveryAt"`
	Items               []ItemRequest `json:"items" binding:"required,min=1,max=50,dive"`
}

func (r ShipmentRequest) input() Input {
	in := Input{
		CustomerID: r.CustomerID, SenderAddressID: r.SenderAddressID, RecipientAddressID: r.RecipientAddressID,
		ServiceType: ServiceType(r.ServiceType), DeclaredValue: r.DeclaredValue, ShippingFee: r.ShippingFee,
		SpecialInstructions: r.SpecialInstructions, ScheduledPickupAt: r.ScheduledPickupAt, EstimatedDeliveryAt: r.EstimatedDeliveryAt,
	}
	for _, it := range r.Items {
		dv := 0.0
		if it.DeclaredValue != nil {
			dv = *it.DeclaredValue
		}
		in.Items = append(in.Items, ItemInput{
			Description: it.Description, Quantity: it.Quantity, WeightKg: it.WeightKg,
			LengthCm: it.LengthCm, WidthCm: it.WidthCm, HeightCm: it.HeightCm, DeclaredValue: dv,
		})
	}
	return in
}

type StatusRequest struct {
	Status   string  `json:"status" binding:"required"`
	Notes    *string `json:"notes" binding:"omitempty,max=500"`
	Location *string `json:"location" binding:"omitempty,max=200"`
}

type ListQuery struct {
	Search        string `form:"search" binding:"omitempty,max=100"`
	Status        string `form:"status" binding:"omitempty,oneof=PENDING CONFIRMED PICKED_UP IN_TRANSIT OUT_FOR_DELIVERY DELIVERED FAILED_DELIVERY RETURNED CANCELLED"`
	ServiceType   string `form:"serviceType" binding:"omitempty,oneof=STANDARD EXPRESS SAME_DAY NEXT_DAY"`
	PaymentStatus string `form:"paymentStatus" binding:"omitempty,oneof=UNPAID PARTIALLY_PAID PAID REFUNDED"`
	CustomerID    int64  `form:"customerId" binding:"omitempty,gt=0"`
	DateFrom      string `form:"dateFrom" binding:"omitempty,datetime=2006-01-02"`
	DateTo        string `form:"dateTo" binding:"omitempty,datetime=2006-01-02"`
}

type QuoteQuery struct {
	ServiceType string  `form:"serviceType" binding:"required,oneof=STANDARD EXPRESS SAME_DAY NEXT_DAY"`
	Weight      float64 `form:"weight" binding:"required,gt=0,lte=100000"`
}
