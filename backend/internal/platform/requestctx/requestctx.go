// Package requestctx carries per-request metadata (client IP, user agent,
// request ID) on the context so that services can record it in audit logs
// without depending on HTTP types.
package requestctx

import (
	"context"

	"github.com/gin-gonic/gin"
)

type Meta struct {
	IP        string
	UserAgent string
	RequestID string
}

type ctxKey struct{}

func With(ctx context.Context, m Meta) context.Context { return context.WithValue(ctx, ctxKey{}, m) }

func From(ctx context.Context) Meta {
	m, _ := ctx.Value(ctxKey{}).(Meta)
	return m
}

// Middleware stores Meta on the request context. Run after RequestID.
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ua := c.Request.UserAgent()
		if len(ua) > 255 {
			ua = ua[:255]
		}
		m := Meta{IP: c.ClientIP(), UserAgent: ua, RequestID: c.GetString("request_id")}
		c.Request = c.Request.WithContext(With(c.Request.Context(), m))
		c.Next()
	}
}
