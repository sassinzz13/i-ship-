package main

import (
	"context"

	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	platformhttp "github.com/sassinzz13/i-ship/backend/internal/platform/http"
)

func runServe(ctx context.Context, cfg config.Config) error {
	pool, err := database.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()

	engine := platformhttp.NewEngine(cfg, pool)
	return platformhttp.Serve(ctx, ":"+cfg.Port, engine)
}
