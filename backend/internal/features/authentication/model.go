// Package authentication owns login, refresh-token rotation, logout and the
// current-user endpoint.
package authentication

import (
	"time"

	"github.com/google/uuid"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

// Account is the user record as seen by authentication.
type Account struct {
	ID           int64
	Email        string
	PasswordHash string
	FullName     string
	Phone        *string
	Role         security.Role
	IsActive     bool
	CustomerID   *int64
	DriverID     *int64
	LastLoginAt  *time.Time
}

func (a Account) Principal() security.Principal {
	return security.Principal{UserID: a.ID, Email: a.Email, Role: a.Role, CustomerID: a.CustomerID, DriverID: a.DriverID}
}

// RefreshToken is a stored (hashed) refresh token.
type RefreshToken struct {
	ID        int64
	UserID    int64
	FamilyID  uuid.UUID
	ExpiresAt time.Time
	RevokedAt *time.Time
}

// Session is the result of a successful login or refresh.
type Session struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
	User             Account

	refreshID int64
}
