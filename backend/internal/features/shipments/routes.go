package shipments

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

// Register mounts /shipments. Read endpoints are open to every signed-in
// role and scoped by the service (customers: own, drivers: assigned).
func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/shipments", authenticate)
	ops := middleware.RequireRoles(security.Operations...)

	g.GET("", middleware.RequireRoles(security.RoleAdmin, security.RoleDispatcher, security.RoleStaff, security.RoleCustomer), h.List)
	g.GET("/quote", ops, h.Quote)
	g.POST("", ops, h.Create)
	g.GET("/:id", h.Get)
	g.PUT("/:id", ops, h.Update)
	g.GET("/:id/history", h.History)
	g.POST("/:id/status", ops, h.ChangeStatus)
}
