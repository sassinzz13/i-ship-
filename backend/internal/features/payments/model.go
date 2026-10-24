// Package payments records shipment payments and keeps the shipment's
// payment status in sync.
package payments

import "time"

type UserRef struct {
	ID       int64  `json:"id"`
	FullName string `json:"fullName"`
}

type Payment struct {
	ID             int64      `json:"id"`
	ShipmentID     int64      `json:"shipmentId"`
	TrackingNumber string     `json:"trackingNumber"`
	CustomerName   string     `json:"customerName"`
	Amount         float64    `json:"amount"`
	Method         string     `json:"method"`
	Reference      *string    `json:"reference"`
	Status         string     `json:"status"`
	PaidAt         *time.Time `json:"paidAt"`
	Notes          *string    `json:"notes"`
	RecordedBy     *UserRef   `json:"recordedBy"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type CreateRequest struct {
	ShipmentID int64      `json:"shipmentId" binding:"required,gt=0"`
	Amount     float64    `json:"amount" binding:"required,gt=0,lte=10000000"`
	Method     string     `json:"method" binding:"required,oneof=CASH BANK_TRANSFER GCASH MAYA OTHER"`
	Reference  *string    `json:"reference" binding:"omitempty,max=100"`
	Status     string     `json:"status" binding:"required,oneof=PENDING PAID"`
	PaidAt     *time.Time `json:"paidAt"`
	Notes      *string    `json:"notes" binding:"omitempty,max=500"`
}

type StatusRequest struct {
	Status    string  `json:"status" binding:"required,oneof=PAID FAILED REFUNDED"`
	Reference *string `json:"reference" binding:"omitempty,max=100"`
}

type ListFilter struct {
	Search     string `form:"search" binding:"omitempty,max=100"`
	Status     string `form:"status" binding:"omitempty,oneof=PENDING PAID FAILED REFUNDED"`
	Method     string `form:"method" binding:"omitempty,oneof=CASH BANK_TRANSFER GCASH MAYA OTHER"`
	ShipmentID int64  `form:"shipmentId" binding:"omitempty,gt=0"`
	DateFrom   string `form:"dateFrom" binding:"omitempty,datetime=2006-01-02"`
	DateTo     string `form:"dateTo" binding:"omitempty,datetime=2006-01-02"`
	CustomerID *int64 `form:"-"`
}
