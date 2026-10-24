package deliveries

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/deliveries", authenticate)
	recorders := middleware.RequireRoles(security.RoleAdmin, security.RoleDispatcher, security.RoleDriver)

	g.GET("", middleware.RequireRoles(security.Dispatch...), h.List)
	g.GET("/:shipmentId", h.Get)
	g.POST("/:shipmentId/attempts", recorders, h.RecordAttempt)
	g.POST("/:shipmentId/proof", recorders, h.SubmitProof)
	g.GET("/:shipmentId/proof/signature", h.ProofImage("signature"))
	g.GET("/:shipmentId/proof/photo", h.ProofImage("photo"))
}
