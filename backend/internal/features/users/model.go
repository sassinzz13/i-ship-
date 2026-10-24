// Package users owns user accounts and role assignment (admin only), and
// exposes account creation to features that onboard drivers and customers.
package users

import (
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

type User struct {
	ID          int64         `json:"id"`
	Email       string        `json:"email"`
	FullName    string        `json:"fullName"`
	Phone       *string       `json:"phone"`
	Role        security.Role `json:"role"`
	IsActive    bool          `json:"isActive"`
	LastLoginAt *time.Time    `json:"lastLoginAt"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// NewUser is the input for creating an account.
type NewUser struct {
	Email    string
	Password string
	FullName string
	Phone    *string
	Role     security.Role
}

type ListFilter struct {
	Search string
	Role   security.Role
	Active *bool
}
