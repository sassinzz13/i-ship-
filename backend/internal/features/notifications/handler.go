package notifications

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *gin.Context) {
	p, _ := security.FromGin(c)
	page := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), p.UserID, c.Query("unread") == "true", page)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, items, response.NewPageMeta(page.Page, page.PageSize, total))
}

func (h *Handler) UnreadCount(c *gin.Context) {
	p, _ := security.FromGin(c)
	n, err := h.svc.UnreadCount(c.Request.Context(), p.UserID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"unread": n})
}

func (h *Handler) MarkRead(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	p, _ := security.FromGin(c)
	if err := h.svc.MarkRead(c.Request.Context(), p.UserID, id); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"read": true})
}

func (h *Handler) MarkAllRead(c *gin.Context) {
	p, _ := security.FromGin(c)
	if err := h.svc.MarkAllRead(c.Request.Context(), p.UserID); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"read": true})
}
