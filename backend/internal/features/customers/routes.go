package customers

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

// Register mounts /customers. Operations staff manage customers; customers
// read and edit their own profile via /customers/me.
func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/customers", authenticate)

	me := g.Group("/me", middleware.RequireRoles(security.RoleCustomer))
	me.GET("", h.Me)
	me.PUT("", h.UpdateMe)

	ops := g.Group("", middleware.RequireRoles(security.Operations...))
	ops.GET("", h.List)
	ops.POST("", h.Create)
	ops.GET("/:id", h.Get)
	ops.PUT("/:id", h.Update)
}
