package users

type CreateUserRequest struct {
	Email    string  `json:"email" binding:"required,email,max=254"`
	Password string  `json:"password" binding:"required,min=8,max=72"`
	FullName string  `json:"fullName" binding:"required,min=1,max=120"`
	Phone    *string `json:"phone" binding:"omitempty,max=30"`
	Role     string  `json:"role" binding:"required,oneof=ADMIN DISPATCHER STAFF DRIVER CUSTOMER"`
}

type UpdateUserRequest struct {
	FullName string  `json:"fullName" binding:"required,min=1,max=120"`
	Phone    *string `json:"phone" binding:"omitempty,max=30"`
	Role     string  `json:"role" binding:"required,oneof=ADMIN DISPATCHER STAFF DRIVER CUSTOMER"`
	IsActive *bool   `json:"isActive" binding:"required"`
}

type ResetPasswordRequest struct {
	Password string `json:"password" binding:"required,min=8,max=72"`
}

type ListQuery struct {
	Search string `form:"search" binding:"omitempty,max=100"`
	Role   string `form:"role" binding:"omitempty,oneof=ADMIN DISPATCHER STAFF DRIVER CUSTOMER"`
	Active string `form:"active" binding:"omitempty,oneof=true false"`
}
