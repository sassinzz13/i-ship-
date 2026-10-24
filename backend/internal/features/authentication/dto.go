package authentication

import (
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email,max=254"`
	Password string `json:"password" binding:"required,max=72"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required,max=72"`
	NewPassword     string `json:"newPassword" binding:"required,min=8,max=72"`
}

type UserResponse struct {
	ID          int64         `json:"id"`
	Email       string        `json:"email"`
	FullName    string        `json:"fullName"`
	Phone       *string       `json:"phone"`
	Role        security.Role `json:"role"`
	CustomerID  *int64        `json:"customerId"`
	DriverID    *int64        `json:"driverId"`
	LastLoginAt *time.Time    `json:"lastLoginAt"`
}

type SessionResponse struct {
	AccessToken string       `json:"accessToken"`
	TokenType   string       `json:"tokenType"`
	ExpiresAt   time.Time    `json:"expiresAt"`
	ExpiresIn   int          `json:"expiresIn"`
	User        UserResponse `json:"user"`
}

func toUserResponse(a Account) UserResponse {
	return UserResponse{
		ID: a.ID, Email: a.Email, FullName: a.FullName, Phone: a.Phone, Role: a.Role,
		CustomerID: a.CustomerID, DriverID: a.DriverID, LastLoginAt: a.LastLoginAt,
	}
}

func toSessionResponse(s Session) SessionResponse {
	return SessionResponse{
		AccessToken: s.AccessToken,
		TokenType:   "Bearer",
		ExpiresAt:   s.AccessExpiresAt,
		ExpiresIn:   int(time.Until(s.AccessExpiresAt).Seconds()),
		User:        toUserResponse(s.User),
	}
}
