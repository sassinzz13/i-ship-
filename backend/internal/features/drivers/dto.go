package drivers

type CreateDriverRequest struct {
	FullName              string  `json:"fullName" binding:"required,min=1,max=120"`
	Email                 string  `json:"email" binding:"required,email,max=254"`
	Password              string  `json:"password" binding:"required,min=8,max=72"`
	Phone                 string  `json:"phone" binding:"required,min=5,max=30"`
	EmployeeCode          string  `json:"employeeCode" binding:"required,min=1,max=30"`
	LicenseNumber         string  `json:"licenseNumber" binding:"required,min=1,max=40"`
	LicenseExpiry         string  `json:"licenseExpiry" binding:"required,datetime=2006-01-02"`
	EmergencyContactName  *string `json:"emergencyContactName" binding:"omitempty,max=120"`
	EmergencyContactPhone *string `json:"emergencyContactPhone" binding:"omitempty,max=30"`
}

type UpdateDriverRequest struct {
	FullName              string  `json:"fullName" binding:"required,min=1,max=120"`
	Phone                 string  `json:"phone" binding:"required,min=5,max=30"`
	EmployeeCode          string  `json:"employeeCode" binding:"required,min=1,max=30"`
	LicenseNumber         string  `json:"licenseNumber" binding:"required,min=1,max=40"`
	LicenseExpiry         string  `json:"licenseExpiry" binding:"required,datetime=2006-01-02"`
	EmergencyContactName  *string `json:"emergencyContactName" binding:"omitempty,max=120"`
	EmergencyContactPhone *string `json:"emergencyContactPhone" binding:"omitempty,max=30"`
	Status                string  `json:"status" binding:"required,oneof=ACTIVE INACTIVE ON_LEAVE SUSPENDED"`
	Availability          string  `json:"availability" binding:"required,oneof=AVAILABLE ON_DELIVERY OFF_DUTY"`
}

type AvailabilityRequest struct {
	Availability string `json:"availability" binding:"required,oneof=AVAILABLE OFF_DUTY"`
}

type ListQuery struct {
	Search       string `form:"search" binding:"omitempty,max=100"`
	Status       string `form:"status" binding:"omitempty,oneof=ACTIVE INACTIVE ON_LEAVE SUSPENDED"`
	Availability string `form:"availability" binding:"omitempty,oneof=AVAILABLE ON_DELIVERY OFF_DUTY"`
}
