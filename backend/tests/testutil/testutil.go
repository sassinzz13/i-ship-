// Package testutil holds test doubles shared by feature test suites.
package testutil

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func init() { gin.SetMode(gin.TestMode) }

// NoTx runs transactional functions directly with a nil transaction. It
// is used with in-memory repositories that ignore the query executor.
type NoTx struct{}

func (NoTx) WithTx(_ context.Context, fn func(tx pgx.Tx) error) error { return fn(nil) }

// Recorder captures audit entries in memory.
type Recorder struct {
	mu      sync.Mutex
	Entries []audit.Entry
}

func (r *Recorder) Record(_ context.Context, _ database.DBTX, e audit.Entry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Entries = append(r.Entries, e)
	return nil
}

func (r *Recorder) Actions() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, len(r.Entries))
	for i, e := range r.Entries {
		out[i] = e.Action
	}
	return out
}

func (r *Recorder) Has(action string) bool {
	for _, a := range r.Actions() {
		if a == action {
			return true
		}
	}
	return false
}

// Secret is a JWT secret long enough for production validation.
const Secret = "test-secret-test-secret-test-secret-0123456789"

// Request performs an HTTP request against h and returns the recorder.
func Request(h http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

// Ctx returns a context carrying p as the authenticated principal.
func Ctx(p security.Principal) context.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	security.SetPrincipal(c, p)
	return c.Request.Context()
}

func Int64(v int64) *int64 { return &v }
