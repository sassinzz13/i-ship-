// Package security contains cross-cutting authentication primitives: roles,
// the authenticated principal, JWT access tokens and password hashing.
// Login flows and token lifecycle rules live in the authentication feature.
package security

import (
	"context"

	"github.com/gin-gonic/gin"
)

type Role string

const (
	RoleAdmin      Role = "ADMIN"
	RoleDispatcher Role = "DISPATCHER"
	RoleStaff      Role = "STAFF"
	RoleDriver     Role = "DRIVER"
	RoleCustomer   Role = "CUSTOMER"
)

var AllRoles = []Role{RoleAdmin, RoleDispatcher, RoleStaff, RoleDriver, RoleCustomer}

func (r Role) Valid() bool {
	for _, x := range AllRoles {
		if x == r {
			return true
		}
	}
	return false
}

// Role groups used by route registration.
var (
	Operations = []Role{RoleAdmin, RoleDispatcher, RoleStaff}
	Dispatch   = []Role{RoleAdmin, RoleDispatcher}
	AdminOnly  = []Role{RoleAdmin}
)

// Principal is the authenticated caller.
type Principal struct {
	UserID     int64  `json:"userId"`
	Email      string `json:"email"`
	Role       Role   `json:"role"`
	CustomerID *int64 `json:"customerId,omitempty"`
	DriverID   *int64 `json:"driverId,omitempty"`
}

func (p Principal) HasRole(roles ...Role) bool {
	for _, r := range roles {
		if p.Role == r {
			return true
		}
	}
	return false
}

// IsStaffSide reports whether the caller is an internal operator (not a
// driver or customer) and therefore not subject to ownership scoping.
func (p Principal) IsStaffSide() bool { return p.HasRole(Operations...) }

type ctxKey struct{}

const ginKey = "principal"

// SetPrincipal stores p on both the gin context and the request context.
func SetPrincipal(c *gin.Context, p Principal) {
	c.Set(ginKey, p)
	c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), ctxKey{}, p))
}

// FromGin returns the principal set by the authentication middleware.
func FromGin(c *gin.Context) (Principal, bool) {
	v, ok := c.Get(ginKey)
	if !ok {
		return Principal{}, false
	}
	p, ok := v.(Principal)
	return p, ok
}

// FromContext returns the principal stored on a request context.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}
