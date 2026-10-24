// Package http builds the Gin engine, global middleware and health endpoints.
// Feature routes are registered by each feature's Register function.
package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/requestctx"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
)

const maxJSONBody = 1 << 20 // 1 MiB

// Pinger is satisfied by *pgxpool.Pool.
type Pinger interface {
	Ping(ctx context.Context) error
}

// NewEngine returns an engine with global middleware and health routes.
func NewEngine(cfg config.Config, db Pinger) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.HandleMethodNotAllowed = true
	_ = r.SetTrustedProxies(cfg.TrustedProxies)
	r.Use(
		middleware.RequestID(),
		requestctx.Middleware(),
		middleware.Recovery(),
		middleware.AccessLog(),
		middleware.SecureHeaders(cfg.IsProduction()),
		middleware.CORS(cfg.CORSOrigins),
		middleware.BodyLimit(maxJSONBody),
	)
	r.NoRoute(func(c *gin.Context) { response.Error(c, apperr.NotFound("Route not found")) })
	r.NoMethod(func(c *gin.Context) {
		response.Error(c, &apperr.AppError{Status: http.StatusMethodNotAllowed, Code: apperr.CodeBadRequest, Message: "Method not allowed"})
	})

	health := func(c *gin.Context) {
		response.OK(c, gin.H{"status": "ok", "time": time.Now().UTC()})
	}
	ready := func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			slog.Warn("readiness check failed", "error", err)
			response.Error(c, apperr.Unavailable("Database is not reachable").WithDetails(map[string]any{"database": "down"}))
			return
		}
		response.OK(c, gin.H{"status": "ready", "database": "up"})
	}
	for _, prefix := range []string{"", "/api"} {
		r.GET(prefix+"/health", health)
		r.GET(prefix+"/ready", ready)
	}
	return r
}

// Serve runs the engine until ctx is cancelled, then drains connections.
func Serve(ctx context.Context, addr string, h http.Handler) error {
	srv := &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}
	errCh := make(chan error, 1)
	go func() {
		slog.Info("http server listening", "addr", addr)
		errCh <- srv.ListenAndServe()
	}()
	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		slog.Info("shutting down http server")
		sctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return srv.Shutdown(sctx)
	}
}

var _ Pinger = (*pgxpool.Pool)(nil)
