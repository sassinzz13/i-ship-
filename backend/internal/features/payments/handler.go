package payments

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

var sortable = map[string]string{"createdAt": "p.created_at", "amount": "p.amount", "paidAt": "p.paid_at"}

func (h *Handler) List(c *gin.Context) {
	var f ListFilter
	if err := validation.BindQuery(c, &f); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), actor, f, p, utilities.ParseSort(c, sortable, utilities.Sort{Column: "p.created_at", Desc: true}))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, items, response.NewPageMeta(p.Page, p.PageSize, total))
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.Create(c.Request.Context(), actor, req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, out)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req StatusRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	out, err := h.svc.UpdateStatus(c.Request.Context(), id, req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func Register(api *gin.RouterGroup, h *Handler, authenticate gin.HandlerFunc) {
	g := api.Group("/payments", authenticate)
	ops := middleware.RequireRoles(security.Operations...)
	g.GET("", middleware.RequireRoles(security.RoleAdmin, security.RoleDispatcher, security.RoleStaff, security.RoleCustomer), h.List)
	g.POST("", ops, h.Create)
	g.PUT("/:id/status", ops, h.UpdateStatus)
}
