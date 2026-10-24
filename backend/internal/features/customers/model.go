// Package customers owns customer records, their optional portal login and
// the customer's own profile endpoints.
package customers

import "time"

const (
	TypeIndividual = "INDIVIDUAL"
	TypeBusiness   = "BUSINESS"
)

type Customer struct {
	ID           int64     `json:"id"`
	CustomerCode string    `json:"customerCode"`
	UserID       *int64    `json:"userId"`
	CustomerType string    `json:"customerType"`
	FullName     string    `json:"fullName"`
	CompanyName  *string   `json:"companyName"`
	Email        *string   `json:"email"`
	Phone        string    `json:"phone"`
	Notes        *string   `json:"notes"`
	IsActive     bool      `json:"isActive"`
	HasPortal    bool      `json:"hasPortalAccount"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Fields are the editable attributes of a customer.
type Fields struct {
	CustomerType string
	FullName     string
	CompanyName  *string
	Email        *string
	Phone        string
	Notes        *string
	IsActive     bool
}

type ListFilter struct {
	Search       string
	CustomerType string
	Active       *bool
}
