package assignments

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

var sortable = map[string]string{"assignedAt": "a.assigned_at", "status": "a.status"}

func (h *Handler) List(c *gin.Context) {
	var q ListQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	f := ListFilter{Status: Status(q.Status), ActiveOnly: q.Active == "true"}
	if q.DriverID > 0 {
		f.DriverID = &q.DriverID
	}
	if q.ShipmentID > 0 {
		f.ShipmentID = &q.ShipmentID
	}
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), f, p, utilities.ParseSort(c, sortable, utilities.Sort{Column: "a.assigned_at", Desc: true}))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, items, response.NewPageMeta(p.Page, p.PageSize, total))
}

func (h *Handler) Mine(c *gin.Context) {
	actor, _ := security.FromGin(c)
	out, err := h.svc.Mine(c.Request.Context(), actor, c.Query("scope") == "history")
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
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
	var req CreateRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.Create(c.Request.Context(), actor, CreateInput(req))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, out)
}

// action wraps the id-only lifecycle endpoints.
func (h *Handler) action(fn func(c *gin.Context, actor security.Principal, id int64) (Assignment, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := utilities.ParseID(c, "id")
		if err != nil {
			response.Error(c, err)
			return
		}
		actor, _ := security.FromGin(c)
		out, err := fn(c, actor, id)
		if err != nil {
			response.Error(c, err)
			return
		}
		response.OK(c, out)
	}
}

func (h *Handler) Accept() gin.HandlerFunc {
	return h.action(func(c *gin.Context, a security.Principal, id int64) (Assignment, error) {
		return h.svc.Accept(c.Request.Context(), a, id)
	})
}

func (h *Handler) Start() gin.HandlerFunc {
	return h.action(func(c *gin.Context, a security.Principal, id int64) (Assignment, error) {
		return h.svc.Start(c.Request.Context(), a, id)
	})
}

func (h *Handler) Reject() gin.HandlerFunc {
	return h.action(func(c *gin.Context, a security.Principal, id int64) (Assignment, error) {
		var req RejectRequest
		if err := validation.BindJSON(c, &req); err != nil {
			return Assignment{}, err
		}
		return h.svc.Reject(c.Request.Context(), a, id, req.Reason)
	})
}

func (h *Handler) Cancel() gin.HandlerFunc {
	return h.action(func(c *gin.Context, a security.Principal, id int64) (Assignment, error) {
		var req ReasonRequest
		_ = c.ShouldBindJSON(&req)
		return h.svc.Cancel(c.Request.Context(), a, id, req.Reason)
	})
}
