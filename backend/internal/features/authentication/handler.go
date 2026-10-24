package authentication

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

const (
	RefreshCookieName = "iship_refresh"
	refreshCookiePath = "/api/v1/auth"
)

type Handler struct {
	svc          *Service
	cookieSecure bool
}

func NewHandler(svc *Service, cookieSecure bool) *Handler {
	return &Handler{svc: svc, cookieSecure: cookieSecure}
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	sess, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Error(c, err)
		return
	}
	h.setRefreshCookie(c, sess.RefreshToken, sess.RefreshExpiresAt)
	response.OK(c, toSessionResponse(sess))
}

func (h *Handler) Refresh(c *gin.Context) {
	raw, _ := c.Cookie(RefreshCookieName)
	sess, err := h.svc.Refresh(c.Request.Context(), raw)
	if err != nil {
		h.clearRefreshCookie(c)
		response.Error(c, err)
		return
	}
	h.setRefreshCookie(c, sess.RefreshToken, sess.RefreshExpiresAt)
	response.OK(c, toSessionResponse(sess))
}

func (h *Handler) Logout(c *gin.Context) {
	raw, _ := c.Cookie(RefreshCookieName)
	if err := h.svc.Logout(c.Request.Context(), raw); err != nil {
		response.Error(c, err)
		return
	}
	h.clearRefreshCookie(c)
	response.OK(c, gin.H{"loggedOut": true})
}

func (h *Handler) Me(c *gin.Context) {
	p, _ := security.FromGin(c)
	acct, err := h.svc.Me(c.Request.Context(), p.UserID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, toUserResponse(acct))
}

func (h *Handler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	p, _ := security.FromGin(c)
	if err := h.svc.ChangePassword(c.Request.Context(), p.UserID, req.CurrentPassword, req.NewPassword); err != nil {
		response.Error(c, err)
		return
	}
	h.clearRefreshCookie(c)
	response.OK(c, gin.H{"passwordChanged": true})
}

func (h *Handler) setRefreshCookie(c *gin.Context, value string, exp time.Time) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name: RefreshCookieName, Value: value, Path: refreshCookiePath,
		Expires: exp, MaxAge: int(time.Until(exp).Seconds()),
		HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteStrictMode,
	})
}

func (h *Handler) clearRefreshCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name: RefreshCookieName, Value: "", Path: refreshCookiePath, MaxAge: -1,
		HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteStrictMode,
	})
}

