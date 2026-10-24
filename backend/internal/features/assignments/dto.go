package assignments

type CreateRequest struct {
	ShipmentID int64   `json:"shipmentId" binding:"required,gt=0"`
	DriverID   int64   `json:"driverId" binding:"required,gt=0"`
	VehicleID  int64   `json:"vehicleId" binding:"required,gt=0"`
	Notes      *string `json:"notes" binding:"omitempty,max=500"`
}

type ReasonRequest struct {
	Reason *string `json:"reason" binding:"omitempty,max=500"`
}

type RejectRequest struct {
	Reason string `json:"reason" binding:"required,min=2,max=500"`
}

type ListQuery struct {
	Status     string `form:"status" binding:"omitempty,oneof=ASSIGNED ACCEPTED IN_PROGRESS COMPLETED CANCELLED REJECTED"`
	DriverID   int64  `form:"driverId" binding:"omitempty,gt=0"`
	ShipmentID int64  `form:"shipmentId" binding:"omitempty,gt=0"`
	Active     string `form:"active" binding:"omitempty,oneof=true false"`
}
