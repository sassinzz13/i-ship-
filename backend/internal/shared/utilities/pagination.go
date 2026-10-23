// Package utilities holds small helpers used by many features.
package utilities

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

const (
	DefaultPageSize = 20
	MaxPageSize     = 100
)

// Pagination is a validated page request.
type Pagination struct {
	Page     int
	PageSize int
}

func (p Pagination) Offset() int { return (p.Page - 1) * p.PageSize }
func (p Pagination) Limit() int  { return p.PageSize }

// ParsePagination reads ?page= and ?pageSize= with sane bounds.
func ParsePagination(c *gin.Context) Pagination {
	page, _ := strconv.Atoi(c.Query("page"))
	size, _ := strconv.Atoi(c.Query("pageSize"))
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = DefaultPageSize
	}
	if size > MaxPageSize {
		size = MaxPageSize
	}
	return Pagination{Page: page, PageSize: size}
}

// Sort is a whitelisted ORDER BY clause.
type Sort struct {
	Column string
	Desc   bool
}

func (s Sort) SQL() string {
	if s.Desc {
		return s.Column + " DESC"
	}
	return s.Column + " ASC"
}

// ParseSort maps ?sort=field or ?sort=-field onto a whitelisted column. The
// allowed map goes from API field name to SQL column, so user input never
// reaches the query text directly.
func ParseSort(c *gin.Context, allowed map[string]string, def Sort) Sort {
	raw := strings.TrimSpace(c.Query("sort"))
	if raw == "" {
		return def
	}
	desc := strings.HasPrefix(raw, "-")
	col, ok := allowed[strings.TrimPrefix(raw, "-")]
	if !ok {
		return def
	}
	return Sort{Column: col, Desc: desc}
}

// ParseID reads a positive int64 path parameter.
func ParseID(c *gin.Context, name string) (int64, error) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, apperr.BadRequest("Invalid " + name)
	}
	return id, nil
}

// LikePattern escapes a search term for use in an ILIKE '%term%' parameter.
func LikePattern(term string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(strings.TrimSpace(term)) + "%"
}
