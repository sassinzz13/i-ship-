package authentication

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
)

type RouteDeps struct {
	Handler        *Handler
	Authenticate   gin.HandlerFunc
	LoginLimiter   *middleware.RateLimiter
	RefreshLimiter *middleware.RateLimiter
}

// Register mounts /auth routes on the versioned API group.
func Register(api *gin.RouterGroup, d RouteDeps) {
	g := api.Group("/auth")
	g.POST("/login", d.LoginLimiter.Middleware(), d.Handler.Login)
	g.POST("/refresh", d.RefreshLimiter.Middleware(), d.Handler.Refresh)
	g.POST("/logout", d.Handler.Logout)

	authed := g.Group("", d.Authenticate)
	authed.GET("/me", d.Handler.Me)
	authed.PUT("/password", d.Handler.ChangePassword)
}
