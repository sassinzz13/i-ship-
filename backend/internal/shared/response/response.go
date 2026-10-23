// Package response writes the standard API envelopes:
//
//	{"success": true,  "data": ..., "meta": ...}
//	{"success": false, "error": {"code": ..., "message": ..., "details": ...}}
package response

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

type Envelope struct {
	Success bool       `json:"success"`
	Data    any        `json:"data,omitempty"`
	Meta    any        `json:"meta,omitempty"`
	Error   *ErrorBody `json:"error,omitempty"`
}

type ErrorBody struct {
	Code    apperr.Code    `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

// PageMeta describes a paginated collection.
type PageMeta struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

func NewPageMeta(page, pageSize, total int) PageMeta {
	pages := 0
	if pageSize > 0 {
		pages = (total + pageSize - 1) / pageSize
	}
	return PageMeta{Page: page, PageSize: pageSize, Total: total, TotalPages: pages}
}

func OK(c *gin.Context, data any) { c.JSON(http.StatusOK, Envelope{Success: true, Data: data}) }

func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, Envelope{Success: true, Data: data})
}

func Page(c *gin.Context, data any, meta PageMeta) {
	c.JSON(http.StatusOK, Envelope{Success: true, Data: data, Meta: meta})
}

func NoContent(c *gin.Context) { c.Status(http.StatusNoContent) }

// Error writes err as an error envelope. Internal errors are logged with their
// cause; the client only ever sees the safe message.
func Error(c *gin.Context, err error) {
	ae := apperr.As(err)
	if ae.Status >= http.StatusInternalServerError {
		slog.ErrorContext(c.Request.Context(), "request failed",
			"code", ae.Code, "error", ae.Error(), "path", c.FullPath(), "request_id", c.GetString("request_id"))
	}
	c.AbortWithStatusJSON(ae.Status, Envelope{
		Success: false,
		Error:   &ErrorBody{Code: ae.Code, Message: ae.Message, Details: ae.Details},
	})
}
