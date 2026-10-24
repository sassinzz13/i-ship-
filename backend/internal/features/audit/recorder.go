package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/requestctx"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

// Recorder writes audit entries. Pass the caller's transaction as q.
type Recorder interface {
	Record(ctx context.Context, q database.DBTX, e Entry) error
}

type DBRecorder struct{}

func NewRecorder() *DBRecorder { return &DBRecorder{} }

func (DBRecorder) Record(ctx context.Context, q database.DBTX, e Entry) error {
	actorID, role := e.ActorUserID, e.ActorRole
	if p, ok := security.FromContext(ctx); ok {
		if actorID == nil {
			actorID = &p.UserID
		}
		if role == "" {
			role = string(p.Role)
		}
	}
	changes := e.Changes
	if changes == nil {
		changes = map[string]any{}
	}
	raw, err := json.Marshal(changes)
	if err != nil {
		return fmt.Errorf("marshal audit changes: %w", err)
	}
	m := requestctx.From(ctx)
	_, err = q.Exec(ctx, `
		INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, changes, ip_address, user_agent, request_id)
		VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''))`,
		actorID, role, e.Action, e.EntityType, e.EntityID, raw, m.IP, m.UserAgent, m.RequestID)
	if err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}
	return nil
}
