// Package validation binds request bodies and converts validator errors into
// field-level details for the error envelope.
package validation

import (
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
)

func init() {
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		// Report JSON field names rather than Go struct field names.
		v.RegisterTagNameFunc(func(f reflect.StructField) string {
			name := strings.SplitN(f.Tag.Get("json"), ",", 2)[0]
			if name == "-" {
				return ""
			}
			if name == "" {
				name = strings.SplitN(f.Tag.Get("form"), ",", 2)[0]
			}
			return name
		})
	}
}

// BindJSON decodes and validates a JSON body into dst.
func BindJSON(c *gin.Context, dst any) error {
	if err := c.ShouldBindJSON(dst); err != nil {
		return translate(err)
	}
	return nil
}

// BindQuery decodes and validates query parameters into dst.
func BindQuery(c *gin.Context, dst any) error {
	if err := c.ShouldBindQuery(dst); err != nil {
		return translate(err)
	}
	return nil
}

// Struct validates an already-populated struct.
func Struct(dst any) error {
	if err := binding.Validator.ValidateStruct(dst); err != nil {
		return translate(err)
	}
	return nil
}

func translate(err error) error {
	var verrs validator.ValidationErrors
	if errors.As(err, &verrs) {
		details := make(map[string]any, len(verrs))
		for _, fe := range verrs {
			details[fieldPath(fe)] = message(fe)
		}
		return apperr.Validation("Request validation failed", details)
	}
	var syntaxErr *json.SyntaxError
	var typeErr *json.UnmarshalTypeError
	switch {
	case errors.Is(err, io.EOF):
		return apperr.BadRequest("Request body is required")
	case errors.As(err, &syntaxErr):
		return apperr.BadRequest("Request body is not valid JSON")
	case errors.As(err, &typeErr):
		return apperr.Validation("Request validation failed", map[string]any{typeErr.Field: "has an invalid type"})
	}
	return apperr.BadRequest("Invalid request")
}

func fieldPath(fe validator.FieldError) string {
	ns := fe.Namespace()
	if i := strings.Index(ns, "."); i >= 0 {
		return ns[i+1:]
	}
	return fe.Field()
}

func message(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required", "required_if", "required_without":
		return "is required"
	case "email":
		return "must be a valid email address"
	case "min":
		if fe.Kind() == reflect.String {
			return "must be at least " + fe.Param() + " characters"
		}
		return "must be at least " + fe.Param()
	case "max":
		if fe.Kind() == reflect.String {
			return "must be at most " + fe.Param() + " characters"
		}
		return "must be at most " + fe.Param()
	case "gt":
		return "must be greater than " + fe.Param()
	case "gte":
		return "must be greater than or equal to " + fe.Param()
	case "lte":
		return "must be less than or equal to " + fe.Param()
	case "oneof":
		return "must be one of: " + fe.Param()
	case "len":
		return "must have length " + fe.Param()
	case "dive":
		return "is invalid"
	default:
		return "is invalid"
	}
}
