package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
)

// Authenticate requires a valid bearer access token.
func Authenticate(tm *security.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		token, ok := strings.CutPrefix(h, "Bearer ")
		if !ok || token == "" {
			response.Error(c, apperr.Unauthorized("Authentication required"))
			return
		}
		p, err := tm.Verify(strings.TrimSpace(token))
		if err != nil {
			response.Error(c, apperr.Unauthorized("Invalid or expired access token"))
			return
		}
		security.SetPrincipal(c, p)
		c.Next()
	}
}

// RequireRoles allows only principals holding one of roles. It must run after
// Authenticate.
func RequireRoles(roles ...security.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		p, ok := security.FromGin(c)
		if !ok {
			response.Error(c, apperr.Unauthorized("Authentication required"))
			return
		}
		if !p.HasRole(roles...) {
			response.Error(c, apperr.Forbidden("You do not have permission to perform this action"))
			return
		}
		c.Next()
	}
}
