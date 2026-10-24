package deliveries

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
	"github.com/sassinzz13/i-ship/backend/internal/shared/validation"
)

const (
	maxImageBytes  = 5 << 20
	maxUploadBytes = 12 << 20
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

type ListQuery struct {
	Outcome  string `form:"outcome" binding:"omitempty,oneof=SUCCESSFUL RECIPIENT_UNAVAILABLE WRONG_ADDRESS REFUSED DAMAGED_PACKAGE OTHER"`
	DriverID int64  `form:"driverId" binding:"omitempty,gt=0"`
	Search   string `form:"search" binding:"omitempty,max=100"`
	DateFrom string `form:"dateFrom" binding:"omitempty,datetime=2006-01-02"`
	DateTo   string `form:"dateTo" binding:"omitempty,datetime=2006-01-02"`
}

type AttemptRequest struct {
	Outcome   string   `json:"outcome" binding:"required,oneof=RECIPIENT_UNAVAILABLE WRONG_ADDRESS REFUSED DAMAGED_PACKAGE OTHER SUCCESSFUL"`
	Notes     *string  `json:"notes" binding:"omitempty,max=500"`
	Latitude  *float64 `json:"latitude" binding:"omitempty,gte=-90,lte=90"`
	Longitude *float64 `json:"longitude" binding:"omitempty,gte=-180,lte=180"`
}

func (h *Handler) List(c *gin.Context) {
	var q ListQuery
	if err := validation.BindQuery(c, &q); err != nil {
		response.Error(c, err)
		return
	}
	f := ListFilter{Outcome: Outcome(q.Outcome), Search: q.Search}
	if q.DriverID > 0 {
		f.DriverID = &q.DriverID
	}
	if q.DateFrom != "" {
		t, _ := time.ParseInLocation("2006-01-02", q.DateFrom, shipments.Manila)
		f.DateFrom = &t
	}
	if q.DateTo != "" {
		t, _ := time.ParseInLocation("2006-01-02", q.DateTo, shipments.Manila)
		t = t.AddDate(0, 0, 1)
		f.DateTo = &t
	}
	p := utilities.ParsePagination(c)
	items, total, err := h.svc.List(c.Request.Context(), f, p)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, items, response.NewPageMeta(p.Page, p.PageSize, total))
}

func (h *Handler) Get(c *gin.Context) {
	id, err := utilities.ParseID(c, "shipmentId")
	if err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	rec, err := h.svc.Get(c.Request.Context(), actor, id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, rec)
}

func (h *Handler) RecordAttempt(c *gin.Context) {
	id, err := utilities.ParseID(c, "shipmentId")
	if err != nil {
		response.Error(c, err)
		return
	}
	var req AttemptRequest
	if err := validation.BindJSON(c, &req); err != nil {
		response.Error(c, err)
		return
	}
	actor, _ := security.FromGin(c)
	a, err := h.svc.RecordFailedAttempt(c.Request.Context(), actor, id, AttemptInput{
		Outcome: Outcome(req.Outcome), Notes: req.Notes, Latitude: req.Latitude, Longitude: req.Longitude,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, a)
}

// readImage reads an optional multipart image, enforcing size and sniffing
// the real content type (the client-declared type is ignored).
func readImage(c *gin.Context, field string, allowed map[string]bool) (*Upload, error) {
	fh, err := c.FormFile(field)
	if err != nil {
		return nil, nil
	}
	if fh.Size > maxImageBytes {
		return nil, apperr.Validation("Image too large", map[string]any{field: "must be 5 MB or smaller"})
	}
	f, err := fh.Open()
	if err != nil {
		return nil, apperr.BadRequest("Could not read upload")
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxImageBytes+1))
	if err != nil || len(data) > maxImageBytes {
		return nil, apperr.Validation("Image too large", map[string]any{field: "must be 5 MB or smaller"})
	}
	ct := http.DetectContentType(data)
	if !allowed[ct] {
		return nil, apperr.Validation("Unsupported image type", map[string]any{field: "must be a JPEG, PNG or WebP image"})
	}
	return &Upload{Reader: bytes.NewReader(data), ContentType: ct}, nil
}

func optFloat(c *gin.Context, field string) *float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(c.PostForm(field)), 64)
	if err != nil {
		return nil
	}
	return &v
}

func (h *Handler) SubmitProof(c *gin.Context) {
	id, err := utilities.ParseID(c, "shipmentId")
	if err != nil {
		response.Error(c, err)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes)
	if err := c.Request.ParseMultipartForm(maxUploadBytes); err != nil {
		response.Error(c, apperr.BadRequest("Expected multipart form data of at most 12 MB"))
		return
	}
	sig, err := readImage(c, "signature", map[string]bool{"image/png": true})
	if err != nil {
		response.Error(c, err)
		return
	}
	photo, err := readImage(c, "photo", map[string]bool{"image/png": true, "image/jpeg": true, "image/webp": true})
	if err != nil {
		response.Error(c, err)
		return
	}
	var notes *string
	if n := strings.TrimSpace(c.PostForm("notes")); n != "" {
		if len(n) > 500 {
			n = n[:500]
		}
		notes = &n
	}
	rel := strings.ToUpper(strings.TrimSpace(c.PostForm("recipientRelationship")))
	if rel == "" {
		rel = "SELF"
	}
	actor, _ := security.FromGin(c)
	rec, err := h.svc.SubmitProof(c.Request.Context(), actor, id, ProofInput{
		RecipientName: c.PostForm("recipientName"), RecipientRelationship: rel, Notes: notes,
		Latitude: optFloat(c, "latitude"), Longitude: optFloat(c, "longitude"),
	}, sig, photo)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, rec)
}

func (h *Handler) ProofImage(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := utilities.ParseID(c, "shipmentId")
		if err != nil {
			response.Error(c, err)
			return
		}
		actor, _ := security.FromGin(c)
		rc, err := h.svc.ProofImage(c.Request.Context(), actor, id, kind)
		if err != nil {
			response.Error(c, err)
			return
		}
		defer rc.Close()
		data, err := io.ReadAll(io.LimitReader(rc, maxImageBytes+1))
		if err != nil {
			response.Error(c, apperr.Internal(err))
			return
		}
		c.Header("Cache-Control", "private, max-age=300")
		c.Data(http.StatusOK, http.DetectContentType(data), data)
	}
}
