package shipments

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

var sortable = map[string]string{
	"createdAt": "s.created_at", "trackingNumber": "s.tracking_number", "estimatedDeliveryAt": "s.estimated_delivery_at",
	"shippingFee": "s.shipping_fee", "currentStatus": "s.current_status",
}

func (h *Handler) List(c *gin.Context) {
	var q ListQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	f := ListFilter{Search: q.Search, Status: Status(q.Status), ServiceType: ServiceType(q.ServiceType), PaymentStatus: q.PaymentStatus}
	if q.CustomerID > 0 {
		f.CustomerID = &q.CustomerID
	}
	if q.DateFrom != "" {
		t, _ := time.ParseInLocation("2006-01-02", q.DateFrom, Manila)
		f.DateFrom = &t
	}
	if q.DateTo != "" {
		t, _ := time.ParseInLocation("2006-01-02", q.DateTo, Manila)
		t = t.AddDate(0, 0, 1)
		f.DateTo = &t
	}
	actor, _ := security.FromGin(c)
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), actor, f, p, utilities.ParseSort(c, sortable, utilities.Sort{Column: "s.created_at", Desc: true}))
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
	var req ShipmentRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	if req.CustomerID <= 0 {
		response.Error(c, apperr.Validation("Request validation failed", map[string]any{"customerId": "is required"}))
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.Create(c.Request.Context(), actor, req.input())
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
	var req ShipmentRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.Update(c.Request.Context(), actor, id, req.input())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) History(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	out, err := h.svc.History(c.Request.Context(), actor, id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) ChangeStatus(c *gin.Context) {
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
	actor, _ := security.FromGin(c)
	out, err := h.svc.ChangeStatus(c.Request.Context(), actor, id, TransitionInput{To: Status(req.Status), Notes: req.Notes, Location: req.Location})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, out)
}

func (h *Handler) Quote(c *gin.Context) {
	var q QuoteQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"serviceType": q.ServiceType, "weight": q.Weight, "shippingFee": QuoteFee(ServiceType(q.ServiceType), q.Weight)})
}
