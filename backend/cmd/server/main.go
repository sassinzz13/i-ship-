// Command server runs the i-Ship API.
//
//	server serve            start the HTTP API (default)
//	server migrate up|down|version
//	server seed [--demo]    create the bootstrap admin (and demo data)
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "configuration error:", err)
		os.Exit(2)
	}
	logger.New(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cmd := "serve"
	args := os.Args[1:]
	if len(args) > 0 {
		cmd, args = args[0], args[1:]
	}
	switch cmd {
	case "serve":
		err = runServe(ctx, cfg)
	case "migrate":
		err = runMigrate(cfg, args)
	case "healthcheck":
		err = runHealthcheck(ctx, cfg)
	case "seed":
		err = runSeed(ctx, cfg, args)
	default:
		err = fmt.Errorf("unknown command %q", cmd)
	}
	if err != nil {
		slog.Error("command failed", "command", cmd, "error", err)
		os.Exit(1)
	}
}
