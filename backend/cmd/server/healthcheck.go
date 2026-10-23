package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
)

// runHealthcheck lets the distroless container probe itself without curl.
func runHealthcheck(ctx context.Context, cfg config.Config) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:"+cfg.Port+"/health", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health status %d", resp.StatusCode)
	}
	return nil
}
