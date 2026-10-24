// Package vehicles owns the fleet: vehicle records, capacity and status.
package vehicles

import "time"

const (
	StatusAvailable   = "AVAILABLE"
	StatusInUse       = "IN_USE"
	StatusMaintenance = "MAINTENANCE"
	StatusRetired     = "RETIRED"
)

type Vehicle struct {
	ID               int64     `json:"id"`
	PlateNumber      string    `json:"plateNumber"`
	VehicleType      string    `json:"vehicleType"`
	Brand            string    `json:"brand"`
	Model            string    `json:"model"`
	Year             *int      `json:"year"`
	WeightCapacityKg float64   `json:"weightCapacityKg"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type VehicleRequest struct {
	PlateNumber      string  `json:"plateNumber" binding:"required,min=2,max=15"`
	VehicleType      string  `json:"vehicleType" binding:"required,oneof=MOTORCYCLE CAR VAN TRUCK"`
	Brand            string  `json:"brand" binding:"required,min=1,max=60"`
	Model            string  `json:"model" binding:"required,min=1,max=60"`
	Year             *int    `json:"year" binding:"omitempty,gte=1980,lte=2100"`
	WeightCapacityKg float64 `json:"weightCapacityKg" binding:"required,gt=0,lte=100000"`
	Status           string  `json:"status" binding:"omitempty,oneof=AVAILABLE IN_USE MAINTENANCE RETIRED"`
}

type ListFilter struct {
	Search      string `form:"search" binding:"omitempty,max=100"`
	Status      string `form:"status" binding:"omitempty,oneof=AVAILABLE IN_USE MAINTENANCE RETIRED"`
	VehicleType string `form:"vehicleType" binding:"omitempty,oneof=MOTORCYCLE CAR VAN TRUCK"`
}
