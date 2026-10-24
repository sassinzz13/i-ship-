package audit

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

type ListQuery struct {
	Action      string `form:"action" binding:"omitempty,max=100"`
	EntityType  string `form:"entityType" binding:"omitempty,max=50"`
	EntityID    int64  `form:"entityId" binding:"omitempty,gt=0"`
	ActorUserID int64  `form:"actorUserId" binding:"omitempty,gt=0"`
	DateFrom    string `form:"dateFrom" binding:"omitempty,datetime=2006-01-02"`
	DateTo      string `form:"dateTo" binding:"omitempty,datetime=2006-01-02"`
}

// Query reads the audit trail (administrators only).
type Query struct{ db database.DBTX }

func NewQuery(db database.DBTX) *Query { return &Query{db: db} }

func (qr *Query) List(ctx context.Context, f ListQuery, p utilities.Pagination) ([]Log, int, error) {
	where := []string{"TRUE"}
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }
	if f.Action != "" {
		where = append(where, "l.action ILIKE "+arg(utilities.LikePattern(f.Action)))
	}
	if f.EntityType != "" {
		where = append(where, "l.entity_type = "+arg(f.EntityType))
	}
	if f.EntityID > 0 {
		where = append(where, "l.entity_id = "+arg(f.EntityID))
	}
	if f.ActorUserID > 0 {
		where = append(where, "l.actor_user_id = "+arg(f.ActorUserID))
	}
	loc, _ := time.LoadLocation("Asia/Manila")
	if f.DateFrom != "" {
		t, _ := time.ParseInLocation("2006-01-02", f.DateFrom, loc)
		where = append(where, "l.created_at >= "+arg(t))
	}
	if f.DateTo != "" {
		t, _ := time.ParseInLocation("2006-01-02", f.DateTo, loc)
		where = append(where, "l.created_at < "+arg(t.AddDate(0, 0, 1)))
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := qr.db.QueryRow(ctx, `SELECT count(*) FROM audit_logs l WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	lim, off := arg(p.Limit()), arg(p.Offset())
	rows, err := qr.db.Query(ctx, `SELECT l.id, l.actor_user_id, u.full_name, u.email, l.actor_role, l.action, l.entity_type,
		l.entity_id, l.changes, l.ip_address, l.user_agent, l.request_id, l.created_at
		FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id
		WHERE `+cond+` ORDER BY l.created_at DESC, l.id DESC LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Log{}
	for rows.Next() {
		var l Log
		if err := rows.Scan(&l.ID, &l.ActorUserID, &l.ActorName, &l.ActorEmail, &l.ActorRole, &l.Action, &l.EntityType,
			&l.EntityID, &l.Changes, &l.IPAddress, &l.UserAgent, &l.RequestID, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, l)
	}
	return out, total, rows.Err()
}

func Register(api *gin.RouterGroup, qr *Query, authenticate gin.HandlerFunc) {
	api.GET("/audit-logs", authenticate, middleware.RequireRoles(security.AdminOnly...), func(c *gin.Context) {
		var f ListQuery
		if err := validation.BindQuery(c, &f); err != nil {
			response.Error(c, err)
			return
		}
		p := utilities.ParsePagination(c)
		items, total, err := qr.List(c.Request.Context(), f, p)
		if err != nil {
			response.Error(c, apperr.Internal(err))
			return
		}
		response.Page(c, items, response.NewPageMeta(p.Page, p.PageSize, total))
	})
}
