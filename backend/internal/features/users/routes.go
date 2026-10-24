package users

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

// Register mounts /users (administrators only).
func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/users", authenticate, middleware.RequireRoles(security.AdminOnly...))
	g.GET("", h.List)
	g.POST("", h.Create)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
	g.PUT("/:id/password", h.ResetPassword)
}
