// Package assignments owns delivery assignments: which driver and vehicle
// carry a shipment, and the assignment lifecycle. A shipment may have many
// historical assignments but at most one active one.
package assignments

import "time"

type Status string

const (
	StatusAssigned   Status = "ASSIGNED"
	StatusAccepted   Status = "ACCEPTED"
	StatusInProgress Status = "IN_PROGRESS"
	StatusCompleted  Status = "COMPLETED"
	StatusCancelled  Status = "CANCELLED"
	StatusRejected   Status = "REJECTED"
)

var ActiveStatuses = []Status{StatusAssigned, StatusAccepted, StatusInProgress}

func (s Status) Active() bool {
	return s == StatusAssigned || s == StatusAccepted || s == StatusInProgress
}

type ShipmentInfo struct {
	ID                  int64      `json:"id"`
	TrackingNumber      string     `json:"trackingNumber"`
	CurrentStatus       string     `json:"currentStatus"`
	ServiceType         string     `json:"serviceType"`
	TotalWeight         float64    `json:"totalWeight"`
	TotalQuantity       int        `json:"totalQuantity"`
	RecipientName       string     `json:"recipientName"`
	RecipientPhone      string     `json:"recipientPhone"`
	RecipientAddress    string     `json:"recipientAddress"`
	RecipientCity       string     `json:"recipientCity"`
	SpecialInstructions *string    `json:"specialInstructions"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
}

type DriverInfo struct {
	ID           int64  `json:"id"`
	FullName     string `json:"fullName"`
	EmployeeCode string `json:"employeeCode"`
	Phone        string `json:"phone"`
}

type VehicleInfo struct {
	ID          int64  `json:"id"`
	PlateNumber string `json:"plateNumber"`
	VehicleType string `json:"vehicleType"`
	Brand       string `json:"brand"`
	Model       string `json:"model"`
}

type UserRef struct {
	ID       int64  `json:"id"`
	FullName string `json:"fullName"`
}

type Assignment struct {
	ID          int64       `json:"id"`
	ShipmentID  int64       `json:"shipmentId"`
	DriverID    int64       `json:"driverId"`
	VehicleID   int64       `json:"vehicleId"`
	Status      Status      `json:"status"`
	Notes       *string     `json:"notes"`
	AssignedAt  time.Time   `json:"assignedAt"`
	AcceptedAt  *time.Time  `json:"acceptedAt"`
	StartedAt   *time.Time  `json:"startedAt"`
	CompletedAt *time.Time  `json:"completedAt"`
	CancelledAt *time.Time  `json:"cancelledAt"`
	Shipment    ShipmentInfo `json:"shipment"`
	Driver      DriverInfo  `json:"driver"`
	Vehicle     VehicleInfo `json:"vehicle"`
	AssignedBy  *UserRef    `json:"assignedBy"`

	DriverUserID int64 `json:"-"`
}

type ListFilter struct {
	Status     Status
	DriverID   *int64
	ShipmentID *int64
	ActiveOnly bool
	Statuses   []Status
}
