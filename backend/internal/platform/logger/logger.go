// Package logger configures structured JSON logging with redaction of
// sensitive attribute keys.
package logger

import (
	"log/slog"
	"os"
	"strings"
)

var sensitiveKeys = map[string]bool{
	"password": true, "password_hash": true, "token": true, "access_token": true,
	"refresh_token": true, "authorization": true, "cookie": true, "secret": true,
	"jwt_secret": true, "database_url": true,
}

// New returns a JSON slog logger at the given level and installs it as default.
func New(level string) *slog.Logger {
	var lvl slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: lvl,
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if sensitiveKeys[strings.ToLower(a.Key)] {
				return slog.String(a.Key, "[REDACTED]")
			}
			return a
		},
	})
	l := slog.New(h).With("service", "i-ship-api")
	slog.SetDefault(l)
	return l
}
