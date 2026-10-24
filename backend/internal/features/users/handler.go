package users

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

var sortable = map[string]string{
	"email": "u.email", "fullName": "u.full_name", "role": "r.name", "createdAt": "u.created_at", "lastLoginAt": "u.last_login_at",
}

func (h *Handler) List(c *gin.Context) {
	var q ListQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	f := ListFilter{Search: q.Search, Role: security.Role(q.Role)}
	if q.Active != "" {
		v := q.Active == "true"
		f.Active = &v
	}
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), f, p,
		utilities.ParseSort(c, sortable, utilities.Sort{Column: "u.created_at", Desc: true}))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, items, response.NewPageMeta(p.Page, p.PageSize, total))
}

func (h *Handler) Get(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	u, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, u)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateUserRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	u, err := h.svc.Create(c.Request.Context(), NewUser{
		Email: req.Email, Password: req.Password, FullName: req.FullName, Phone: req.Phone, Role: security.Role(req.Role),
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, u)
}

func (h *Handler) Update(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req UpdateUserRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	u, err := h.svc.Update(c.Request.Context(), actor, id, UpdateInput{
		FullName: req.FullName, Phone: req.Phone, Role: security.Role(req.Role), IsActive: *req.IsActive,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, u)
}

func (h *Handler) ResetPassword(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req ResetPasswordRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	if err := h.svc.ResetPassword(c.Request.Context(), id, req.Password); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"passwordReset": true})
}
