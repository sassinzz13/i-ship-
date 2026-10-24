package shipments

import (
	"context"
	"fmt"
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
)

// Manila is the business timezone used for tracking-number dates.
var Manila = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Manila")
	if err != nil {
		return time.FixedZone("PHT", 8*60*60)
	}
	return loc
}()

// FormatTrackingNumber renders ISH-YYYYMMDD-NNNNNN.
func FormatTrackingNumber(day time.Time, seq int) string {
	return fmt.Sprintf("ISH-%s-%06d", day.In(Manila).Format("20060102"), seq)
}

// NextTrackingNumber atomically increments the per-day counter. Running it
// inside the shipment-creation transaction holds the counter row lock until
// commit, so concurrent creators queue instead of colliding, and a rolled
// back creation releases its number.
func NextTrackingNumber(ctx context.Context, q database.DBTX, now time.Time) (string, error) {
	day := now.In(Manila)
	var seq int
	err := q.QueryRow(ctx, `
		INSERT INTO tracking_sequences (day, last_value) VALUES ($1::date, 1)
		ON CONFLICT (day) DO UPDATE SET last_value = tracking_sequences.last_value + 1
		RETURNING last_value`, day.Format("2006-01-02")).Scan(&seq)
	if err != nil {
		return "", fmt.Errorf("next tracking sequence: %w", err)
	}
	return FormatTrackingNumber(day, seq), nil
}
