package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/authentication"
	"github.com/sassinzz13/i-ship/backend/internal/features/users"
	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	platformhttp "github.com/sassinzz13/i-ship/backend/internal/platform/http"
	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
)

func runServe(ctx context.Context, cfg config.Config) error {
	pool, err := database.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()

	app := buildApp(cfg, pool)
	if err := app.users.EnsureAdmin(ctx, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		return err
	}
	return platformhttp.Serve(ctx, ":"+cfg.Port, app.engine)
}

type app struct {
	engine *gin.Engine
	users  *users.Service
}

// buildApp wires every feature. Features receive their collaborators as
// small interfaces, so this is the only place that knows the whole graph.
func buildApp(cfg config.Config, pool *pgxpool.Pool) *app {
	engine := platformhttp.NewEngine(cfg, pool)
	api := engine.Group("/api/v1")

	txm := database.NewTxManager(pool)
	tokens := security.NewTokenManager(cfg.JWTSecret, cfg.JWTAccessExpiration)
	authenticate := middleware.Authenticate(tokens)
	recorder := audit.NewRecorder()

	// Authentication
	authSvc := authentication.NewService(authentication.ServiceDeps{
		DB: pool, Tx: txm, Repo: authentication.NewRepository(), Tokens: tokens,
		Audit: recorder, RefreshTTL: cfg.JWTRefreshExpiration,
	})
	authentication.Register(api, authentication.RouteDeps{
		Handler:        authentication.NewHandler(authSvc, cfg.CookieSecure),
		Authenticate:   authenticate,
		LoginLimiter:   middleware.NewRateLimiter(10, 5),
		RefreshLimiter: middleware.NewRateLimiter(60, 20),
	})

	// Users
	userSvc := users.NewService(pool, txm, users.NewRepository(), recorder)
	users.Register(api, users.NewHandler(userSvc), authenticate)

	return &app{engine: engine, users: userSvc}
}
