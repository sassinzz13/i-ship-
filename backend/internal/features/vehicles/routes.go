package vehicles

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/vehicles", authenticate, middleware.RequireRoles(security.Dispatch...))
	g.GET("", h.List)
	g.POST("", h.Create)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
}
