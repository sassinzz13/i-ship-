// Package addresses owns customers' address books. Shipments reference
// addresses for sender and recipient, so addresses are archived rather than
// deleted once created.
package addresses

import "time"

type Address struct {
	ID           int64      `json:"id"`
	CustomerID   int64      `json:"customerId"`
	Label        string     `json:"label"`
	ContactName  string     `json:"contactName"`
	ContactPhone string     `json:"contactPhone"`
	Line1        string     `json:"line1"`
	Line2        *string    `json:"line2"`
	Barangay     *string    `json:"barangay"`
	City         string     `json:"city"`
	Province     string     `json:"province"`
	PostalCode   *string    `json:"postalCode"`
	Country      string     `json:"country"`
	Latitude     *float64   `json:"latitude"`
	Longitude    *float64   `json:"longitude"`
	IsDefault    bool       `json:"isDefault"`
	ArchivedAt   *time.Time `json:"archivedAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type Fields struct {
	Label        string
	ContactName  string
	ContactPhone string
	Line1        string
	Line2        *string
	Barangay     *string
	City         string
	Province     string
	PostalCode   *string
	Country      string
	Latitude     *float64
	Longitude    *float64
	IsDefault    bool
}
