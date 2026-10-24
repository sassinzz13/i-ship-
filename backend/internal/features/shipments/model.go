// Package shipments owns shipments, their items and status history, the
// status state machine and tracking-number generation.
package shipments

import "time"

type ServiceType string

const (
	ServiceStandard ServiceType = "STANDARD"
	ServiceNextDay  ServiceType = "NEXT_DAY"
	ServiceExpress  ServiceType = "EXPRESS"
	ServiceSameDay  ServiceType = "SAME_DAY"
)

// rates are base fee and per-kg fee in PHP.
var rates = map[ServiceType][2]float64{
	ServiceStandard: {80, 15},
	ServiceNextDay:  {120, 20},
	ServiceExpress:  {150, 25},
	ServiceSameDay:  {250, 30},
}

// QuoteFee computes the default shipping fee for a service and weight.
func QuoteFee(st ServiceType, weightKg float64) float64 {
	r, ok := rates[st]
	if !ok {
		r = rates[ServiceStandard]
	}
	fee := r[0] + r[1]*weightKg
	return float64(int64(fee*100+0.5)) / 100
}

type Summary struct {
	ID                  int64       `json:"id"`
	TrackingNumber      string      `json:"trackingNumber"`
	CustomerID          int64       `json:"customerId"`
	CustomerName        string      `json:"customerName"`
	RecipientName       string      `json:"recipientName"`
	RecipientCity       string      `json:"recipientCity"`
	RecipientProvince   string      `json:"recipientProvince"`
	ServiceType         ServiceType `json:"serviceType"`
	CurrentStatus       Status      `json:"currentStatus"`
	PaymentStatus       string      `json:"paymentStatus"`
	TotalWeight         float64     `json:"totalWeight"`
	TotalQuantity       int         `json:"totalQuantity"`
	ShippingFee         float64     `json:"shippingFee"`
	EstimatedDeliveryAt *time.Time  `json:"estimatedDeliveryAt"`
	CreatedAt           time.Time   `json:"createdAt"`
}

type CustomerRef struct {
	ID           int64   `json:"id"`
	CustomerCode string  `json:"customerCode"`
	FullName     string  `json:"fullName"`
	Phone        string  `json:"phone"`
	Email        *string `json:"email"`
}

// AddressView is the address snapshot embedded in a shipment.
type AddressView struct {
	ID           int64    `json:"id"`
	CustomerID   int64    `json:"customerId"`
	Label        string   `json:"label"`
	ContactName  string   `json:"contactName"`
	ContactPhone string   `json:"contactPhone"`
	Line1        string   `json:"line1"`
	Line2        *string  `json:"line2"`
	Barangay     *string  `json:"barangay"`
	City         string   `json:"city"`
	Province     string   `json:"province"`
	PostalCode   *string  `json:"postalCode"`
	Country      string   `json:"country"`
	Latitude     *float64 `json:"latitude"`
	Longitude    *float64 `json:"longitude"`
}

type Item struct {
	ID            int64    `json:"id"`
	Description   string   `json:"description"`
	Quantity      int      `json:"quantity"`
	WeightKg      float64  `json:"weightKg"`
	LengthCm      *float64 `json:"lengthCm"`
	WidthCm       *float64 `json:"widthCm"`
	HeightCm      *float64 `json:"heightCm"`
	DeclaredValue float64  `json:"declaredValue"`
}

type Shipment struct {
	Summary
	Customer            CustomerRef `json:"customer"`
	Sender              AddressView `json:"sender"`
	Recipient           AddressView `json:"recipient"`
	SenderAddressID     int64       `json:"senderAddressId"`
	RecipientAddressID  int64       `json:"recipientAddressId"`
	DeclaredValue       float64     `json:"declaredValue"`
	SpecialInstructions *string     `json:"specialInstructions"`
	CancellationReason  *string     `json:"cancellationReason"`
	ScheduledPickupAt   *time.Time  `json:"scheduledPickupAt"`
	ActualDeliveryAt    *time.Time  `json:"actualDeliveryAt"`
	UpdatedAt           time.Time   `json:"updatedAt"`
	Items               []Item      `json:"items"`
	AllowedTransitions  []Status    `json:"allowedTransitions"`

	// CustomerUserID is the customer's portal login, used for notifications.
	CustomerUserID *int64 `json:"-"`
}

type UserRef struct {
	ID       int64  `json:"id"`
	FullName string `json:"fullName"`
}

type HistoryEntry struct {
	ID         int64     `json:"id"`
	FromStatus *Status   `json:"fromStatus"`
	ToStatus   Status    `json:"toStatus"`
	Notes      *string   `json:"notes"`
	Location   *string   `json:"location"`
	ChangedBy  *UserRef  `json:"changedBy"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Input is a validated create/update request.
type Input struct {
	CustomerID          int64
	SenderAddressID     int64
	RecipientAddressID  int64
	ServiceType         ServiceType
	DeclaredValue       *float64
	ShippingFee         *float64
	SpecialInstructions *string
	ScheduledPickupAt   *time.Time
	EstimatedDeliveryAt *time.Time
	Items               []ItemInput
}

type ItemInput struct {
	Description   string
	Quantity      int
	WeightKg      float64
	LengthCm      *float64
	WidthCm       *float64
	HeightCm      *float64
	DeclaredValue float64
}

// Totals are derived from the items.
type Totals struct {
	Weight        float64
	Quantity      int
	DeclaredValue float64
}

func ComputeTotals(items []ItemInput) Totals {
	var t Totals
	for _, it := range items {
		t.Weight += float64(it.Quantity) * it.WeightKg
		t.Quantity += it.Quantity
		t.DeclaredValue += it.DeclaredValue
	}
	t.Weight = float64(int64(t.Weight*100+0.5)) / 100
	return t
}

type ListFilter struct {
	Search        string
	Status        Status
	ServiceType   ServiceType
	PaymentStatus string
	CustomerID    *int64
	DateFrom      *time.Time
	DateTo        *time.Time // exclusive
}
