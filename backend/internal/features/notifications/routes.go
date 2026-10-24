package notifications

import "github.com/gin-gonic/gin"

// Register mounts /notifications. Every signed-in user sees only their own.
func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/notifications", authenticate)
	g.GET("", h.List)
	g.GET("/unread-count", h.UnreadCount)
	g.POST("/read-all", h.MarkAllRead)
	g.POST("/:id/read", h.MarkRead)
}
