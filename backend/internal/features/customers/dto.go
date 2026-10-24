package customers

type PortalAccountRequest struct {
	Email    string `json:"email" binding:"required,email,max=254"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

type CreateCustomerRequest struct {
	CustomerType  string                `json:"customerType" binding:"omitempty,oneof=INDIVIDUAL BUSINESS"`
	FullName      string                `json:"fullName" binding:"required,min=1,max=120"`
	CompanyName   *string               `json:"companyName" binding:"omitempty,max=160"`
	Email         *string               `json:"email" binding:"omitempty,email,max=254"`
	Phone         string                `json:"phone" binding:"required,min=5,max=30"`
	Notes         *string               `json:"notes" binding:"omitempty,max=1000"`
	PortalAccount *PortalAccountRequest `json:"portalAccount" binding:"omitempty"`
}

type UpdateCustomerRequest struct {
	CustomerType string  `json:"customerType" binding:"required,oneof=INDIVIDUAL BUSINESS"`
	FullName     string  `json:"fullName" binding:"required,min=1,max=120"`
	CompanyName  *string `json:"companyName" binding:"omitempty,max=160"`
	Email        *string `json:"email" binding:"omitempty,email,max=254"`
	Phone        string  `json:"phone" binding:"required,min=5,max=30"`
	Notes        *string `json:"notes" binding:"omitempty,max=1000"`
	IsActive     *bool   `json:"isActive" binding:"required"`
}

// UpdateProfileRequest is what customers may change about themselves.
type UpdateProfileRequest struct {
	FullName    string  `json:"fullName" binding:"required,min=1,max=120"`
	CompanyName *string `json:"companyName" binding:"omitempty,max=160"`
	Phone       string  `json:"phone" binding:"required,min=5,max=30"`
}

type ListQuery struct {
	Search       string `form:"search" binding:"omitempty,max=100"`
	CustomerType string `form:"customerType" binding:"omitempty,oneof=INDIVIDUAL BUSINESS"`
	Active       string `form:"active" binding:"omitempty,oneof=true false"`
}
