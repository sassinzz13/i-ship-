package assignments

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/assignments", authenticate)
	dispatch := middleware.RequireRoles(security.Dispatch...)
	driver := middleware.RequireRoles(security.RoleDriver)

	g.GET("", dispatch, h.List)
	g.POST("", dispatch, h.Create)
	g.GET("/mine", driver, h.Mine)
	g.GET("/:id", middleware.RequireRoles(security.RoleAdmin, security.RoleDispatcher, security.RoleDriver), h.Get)
	g.POST("/:id/cancel", dispatch, h.Cancel())
	g.POST("/:id/accept", driver, h.Accept())
	g.POST("/:id/reject", driver, h.Reject())
	g.POST("/:id/start", driver, h.Start())
}
