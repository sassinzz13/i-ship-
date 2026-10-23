// Package config loads runtime configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env                  string
	Port                 string
	DatabaseURL          string
	JWTSecret            string
	JWTAccessExpiration  time.Duration
	JWTRefreshExpiration time.Duration
	CORSOrigins          []string
	UploadDir            string
	LogLevel             string
	CookieSecure         bool
	TrustedProxies       []string
	AdminEmail           string
	AdminPassword        string
	DBMaxConns           int32
}

func (c Config) IsProduction() bool { return c.Env == "production" }

// Load reads configuration from the environment and validates it.
func Load() (Config, error) {
	cfg := Config{
		Env:            getenv("APP_ENV", "development"),
		Port:           getenv("APP_PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		CORSOrigins:    splitList(getenv("CORS_ORIGINS", "http://localhost:4200")),
		UploadDir:      getenv("UPLOAD_DIR", "./data/uploads"),
		LogLevel:       getenv("LOG_LEVEL", "info"),
		TrustedProxies: splitList(getenv("TRUSTED_PROXIES", "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1")),
		AdminEmail:     strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))),
		AdminPassword:  os.Getenv("ADMIN_PASSWORD"),
	}

	var errs []error
	var err error
	if cfg.JWTAccessExpiration, err = time.ParseDuration(getenv("JWT_ACCESS_EXPIRATION", "15m")); err != nil {
		errs = append(errs, fmt.Errorf("JWT_ACCESS_EXPIRATION: %w", err))
	}
	if cfg.JWTRefreshExpiration, err = time.ParseDuration(getenv("JWT_REFRESH_EXPIRATION", "168h")); err != nil {
		errs = append(errs, fmt.Errorf("JWT_REFRESH_EXPIRATION: %w", err))
	}
	cfg.CookieSecure, _ = strconv.ParseBool(getenv("COOKIE_SECURE", strconv.FormatBool(cfg.IsProduction())))
	maxConns, _ := strconv.Atoi(getenv("DB_MAX_CONNS", "10"))
	cfg.DBMaxConns = int32(max(maxConns, 2))

	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if cfg.IsProduction() && len(cfg.JWTSecret) < 32 {
		errs = append(errs, errors.New("JWT_SECRET must be at least 32 characters in production"))
	}
	if cfg.JWTSecret == "" {
		errs = append(errs, errors.New("JWT_SECRET is required"))
	}
	return cfg, errors.Join(errs...)
}

func getenv(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return def
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
