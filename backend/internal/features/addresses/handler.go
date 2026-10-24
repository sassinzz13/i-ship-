package addresses

import (
	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.List(c.Request.Context(), actor, id, c.Query("includeArchived") == "true")
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) ListMine(c *gin.Context) {
	actor, _ := security.FromGin(c)
	if actor.CustomerID == nil {
		response.Error(c, apperr.NotFound("No customer profile is linked to this account"))
		return
	}
	out, err := h.svc.List(c.Request.Context(), actor, *actor.CustomerID, false)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) Create(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req AddressRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	out, err := h.svc.Create(c.Request.Context(), id, req.fields())
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
	var req AddressRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	out, err := h.svc.Update(c.Request.Context(), id, req.fields())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) Archive(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	if err := h.svc.Archive(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"archived": true})
}
