package main

import (
	"fmt"
	"log/slog"

	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/migrations"
)

func runMigrate(cfg config.Config, args []string) error {
	m, err := database.NewMigrator(migrations.Files, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer m.Close()

	action := "up"
	if len(args) > 0 {
		action = args[0]
	}
	switch action {
	case "up":
		err = m.Up()
	case "down":
		// Rolling back everything is destructive; require an explicit flag.
		if len(args) < 2 || args[1] != "--all" {
			err = m.Steps(-1)
		} else {
			err = m.Down()
		}
	case "version":
	default:
		return fmt.Errorf("unknown migrate action %q (use up, down [--all], version)", action)
	}
	if err != nil {
		return err
	}
	v, dirty, err := m.Version()
	if err != nil {
		return err
	}
	slog.Info("migrations", "action", action, "version", v, "dirty", dirty)
	return nil
}
