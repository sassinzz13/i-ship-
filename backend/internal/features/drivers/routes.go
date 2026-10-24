package drivers

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/drivers", authenticate)

	me := g.Group("/me", middleware.RequireRoles(security.RoleDriver))
	me.GET("", h.Me)
	me.PUT("/availability", h.SetMyAvailability)

	d := g.Group("", middleware.RequireRoles(security.Dispatch...))
	d.GET("", h.List)
	d.POST("", h.Create)
	d.GET("/:id", h.Get)
	d.PUT("/:id", h.Update)
}
