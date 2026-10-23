// Package errors defines the application error type shared by every feature.
// Handlers translate AppError values into the standard error envelope.
package errors

import (
	"errors"
	"fmt"
	"net/http"
)

// Code is a stable, machine-readable error identifier returned to clients.
type Code string

const (
	CodeValidation        Code = "VALIDATION_ERROR"
	CodeBadRequest        Code = "BAD_REQUEST"
	CodeUnauthorized      Code = "UNAUTHORIZED"
	CodeForbidden         Code = "FORBIDDEN"
	CodeNotFound          Code = "NOT_FOUND"
	CodeConflict          Code = "CONFLICT"
	CodeInvalidTransition Code = "INVALID_TRANSITION"
	CodeRateLimited       Code = "RATE_LIMITED"
	CodeInternal          Code = "INTERNAL_ERROR"
	CodeUnavailable       Code = "SERVICE_UNAVAILABLE"
)

// AppError is an error that is safe to show to API clients.
type AppError struct {
	Code    Code
	Message string
	Details map[string]any
	Status  int
	Err     error // underlying cause, never exposed to clients
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error { return e.Err }

// WithDetails returns a copy of the error carrying the given details.
func (e *AppError) WithDetails(details map[string]any) *AppError {
	cp := *e
	cp.Details = details
	return &cp
}

func newErr(status int, code Code, msg string) *AppError {
	return &AppError{Code: code, Message: msg, Status: status}
}

func Validation(msg string, details map[string]any) *AppError {
	e := newErr(http.StatusUnprocessableEntity, CodeValidation, msg)
	e.Details = details
	return e
}

func BadRequest(msg string) *AppError   { return newErr(http.StatusBadRequest, CodeBadRequest, msg) }
func Unauthorized(msg string) *AppError { return newErr(http.StatusUnauthorized, CodeUnauthorized, msg) }
func Forbidden(msg string) *AppError    { return newErr(http.StatusForbidden, CodeForbidden, msg) }
func NotFound(msg string) *AppError     { return newErr(http.StatusNotFound, CodeNotFound, msg) }
func Conflict(msg string) *AppError     { return newErr(http.StatusConflict, CodeConflict, msg) }
func RateLimited() *AppError {
	return newErr(http.StatusTooManyRequests, CodeRateLimited, "Too many requests, please try again later")
}
func Unavailable(msg string) *AppError { return newErr(http.StatusServiceUnavailable, CodeUnavailable, msg) }

func InvalidTransition(msg string, details map[string]any) *AppError {
	e := newErr(http.StatusConflict, CodeInvalidTransition, msg)
	e.Details = details
	return e
}

// Internal wraps an unexpected error. The cause is logged but never returned.
func Internal(err error) *AppError {
	e := newErr(http.StatusInternalServerError, CodeInternal, "An unexpected error occurred")
	e.Err = err
	return e
}

// As extracts an AppError from err, wrapping unknown errors as internal errors.
func As(err error) *AppError {
	var ae *AppError
	if errors.As(err, &ae) {
		return ae
	}
	return Internal(err)
}

// Is reports whether err is an AppError with the given code.
func Is(err error, code Code) bool {
	var ae *AppError
	return errors.As(err, &ae) && ae.Code == code
}
