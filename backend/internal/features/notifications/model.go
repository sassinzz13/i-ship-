// Package notifications stores in-app notifications and exposes them to their
// recipients. Other features create notifications through Notifier inside
// their own transactions; delivery channels such as SMS or email can be added
// behind the same interface later.
package notifications

import "time"

type Notification struct {
	ID         int64      `json:"id"`
	Type       string     `json:"type"`
	Title      string     `json:"title"`
	Message    string     `json:"message"`
	EntityType *string    `json:"entityType"`
	EntityID   *int64     `json:"entityId"`
	ReadAt     *time.Time `json:"readAt"`
	CreatedAt  time.Time  `json:"createdAt"`
}

// Message is a notification to create.
type Message struct {
	Type       string
	Title      string
	Message    string
	EntityType string
	EntityID   int64
}
