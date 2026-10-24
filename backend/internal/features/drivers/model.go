// Package drivers owns driver profiles, their login accounts, status and
// availability.
package drivers

import "time"

const (
	StatusActive    = "ACTIVE"
	StatusInactive  = "INACTIVE"
	StatusOnLeave   = "ON_LEAVE"
	StatusSuspended = "SUSPENDED"

	Available  = "AVAILABLE"
	OnDelivery = "ON_DELIVERY"
	OffDuty    = "OFF_DUTY"
)

type Driver struct {
	ID                    int64     `json:"id"`
	UserID                int64     `json:"userId"`
	FullName              string    `json:"fullName"`
	Email                 string    `json:"email"`
	EmployeeCode          string    `json:"employeeCode"`
	LicenseNumber         string    `json:"licenseNumber"`
	LicenseExpiry         string    `json:"licenseExpiry"`
	LicenseExpired        bool      `json:"licenseExpired"`
	Phone                 string    `json:"phone"`
	EmergencyContactName  *string   `json:"emergencyContactName"`
	EmergencyContactPhone *string   `json:"emergencyContactPhone"`
	Status                string    `json:"status"`
	Availability          string    `json:"availability"`
	ActiveAssignments     int       `json:"activeAssignments"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}

type Fields struct {
	FullName              string
	Phone                 string
	EmployeeCode          string
	LicenseNumber         string
	LicenseExpiry         time.Time
	EmergencyContactName  *string
	EmergencyContactPhone *string
	Status                string
	Availability          string
}

type ListFilter struct {
	Search       string
	Status       string
	Availability string
}
