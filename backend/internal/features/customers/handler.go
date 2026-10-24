package customers

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
	"fullName": "full_name", "customerCode": "customer_code", "createdAt": "created_at", "customerType": "customer_type",
}

func (h *Handler) List(c *gin.Context) {
	var q ListQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	f := ListFilter{Search: q.Search, CustomerType: q.CustomerType}
	if q.Active != "" {
		v := q.Active == "true"
		f.Active = &v
	}
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), f, p, utilities.ParseSort(c, sortable, utilities.Sort{Column: "created_at", Desc: true}))
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
	actor, _ := security.FromGin(c)
	out, err := h.svc.Get(c.Request.Context(), actor, id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateCustomerRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	var portal *Portal
	if req.PortalAccount != nil {
		portal = &Portal{Email: req.PortalAccount.Email, Password: req.PortalAccount.Password}
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.Create(c.Request.Context(), actor, Fields{
		CustomerType: req.CustomerType, FullName: req.FullName, CompanyName: req.CompanyName,
		Email: req.Email, Phone: req.Phone, Notes: req.Notes,
	}, portal)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, out)
}

func (h *Handler) Update(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req UpdateCustomerRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.Update(c.Request.Context(), actor, id, Fields{
		CustomerType: req.CustomerType, FullName: req.FullName, CompanyName: req.CompanyName,
		Email: req.Email, Phone: req.Phone, Notes: req.Notes, IsActive: *req.IsActive,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) Me(c *gin.Context) {
	actor, _ := security.FromGin(c)
	out, err := h.svc.Me(c.Request.Context(), actor)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) UpdateMe(c *gin.Context) {
	var req UpdateProfileRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.UpdateMe(c.Request.Context(), actor, req.FullName, req.CompanyName, req.Phone)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}
