package drivers

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
	"fullName": "u.full_name", "employeeCode": "d.employee_code", "licenseExpiry": "d.license_expiry", "createdAt": "d.created_at",
}

func (h *Handler) List(c *gin.Context) {
	var q ListQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), ListFilter(q), p, utilities.ParseSort(c, sortable, utilities.Sort{Column: "u.full_name"}))
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
	d, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, d)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateDriverRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	exp, err := parseDate("licenseExpiry", req.LicenseExpiry)
	if err != nil {
		response.Error(c, err)
		return
	}
	d, err := h.svc.Create(c.Request.Context(), CreateInput{
		Email: req.Email, Password: req.Password,
		Fields: Fields{FullName: req.FullName, Phone: req.Phone, EmployeeCode: req.EmployeeCode, LicenseNumber: req.LicenseNumber,
			LicenseExpiry: exp, EmergencyContactName: req.EmergencyContactName, EmergencyContactPhone: req.EmergencyContactPhone},
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, d)
}

func (h *Handler) Update(c *gin.Context) {
	id, err := utilities.ParseID(c, "id")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req UpdateDriverRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	exp, err := parseDate("licenseExpiry", req.LicenseExpiry)
	if err != nil {
		response.Error(c, err)
		return
	}
	d, err := h.svc.Update(c.Request.Context(), id, Fields{
		FullName: req.FullName, Phone: req.Phone, EmployeeCode: req.EmployeeCode, LicenseNumber: req.LicenseNumber,
		LicenseExpiry: exp, EmergencyContactName: req.EmergencyContactName, EmergencyContactPhone: req.EmergencyContactPhone,
		Status: req.Status, Availability: req.Availability,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, d)
}

func (h *Handler) Me(c *gin.Context) {
	actor, _ := security.FromGin(c)
	d, err := h.svc.Me(c.Request.Context(), actor)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, d)
}

func (h *Handler) SetMyAvailability(c *gin.Context) {
	var req AvailabilityRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	d, err := h.svc.SetMyAvailability(c.Request.Context(), actor, req.Availability)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, d)
}
