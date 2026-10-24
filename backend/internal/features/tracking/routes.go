package tracking

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
)

// Register mounts the public tracking endpoint (no authentication, rate
// limited per client IP to deter tracking-number enumeration).
func Register(api *gin.RouterGroup, h *Handler, limiter *middleware.RateLimiter) {
	api.GET("/tracking/:trackingNumber", limiter.Middleware(), h.Track)
}
