package addresses

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	ops := middleware.RequireRoles(security.Operations...)

	api.GET("/customers/me/addresses", authenticate, middleware.RequireRoles(security.RoleCustomer), h.ListMine)
	api.GET("/customers/:id/addresses", authenticate, ops, h.List)
	api.POST("/customers/:id/addresses", authenticate, ops, h.Create)
	api.PUT("/addresses/:id", authenticate, ops, h.Update)
	api.DELETE("/addresses/:id", authenticate, ops, h.Archive)
}
