package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sassinzz13/i-ship/backend/internal/features/addresses"
	"github.com/sassinzz13/i-ship/backend/internal/features/assignments"
	"github.com/sassinzz13/i-ship/backend/internal/features/audit"
	"github.com/sassinzz13/i-ship/backend/internal/features/authentication"
	"github.com/sassinzz13/i-ship/backend/internal/features/customers"
	"github.com/sassinzz13/i-ship/backend/internal/features/dashboard"
	"github.com/sassinzz13/i-ship/backend/internal/features/deliveries"
	"github.com/sassinzz13/i-ship/backend/internal/features/drivers"
	"github.com/sassinzz13/i-ship/backend/internal/features/notifications"
	"github.com/sassinzz13/i-ship/backend/internal/features/payments"
	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	"github.com/sassinzz13/i-ship/backend/internal/features/tracking"
	"github.com/sassinzz13/i-ship/backend/internal/features/users"
	"github.com/sassinzz13/i-ship/backend/internal/features/vehicles"
	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	platformhttp "github.com/sassinzz13/i-ship/backend/internal/platform/http"
	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/platform/storage"
)

func runServe(ctx context.Context, cfg config.Config) error {
	pool, err := database.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()

	files, err := storage.NewLocalStore(cfg.UploadDir)
	if err != nil {
		return err
	}
	app := buildApp(cfg, pool, files)
	if err := app.users.EnsureAdmin(ctx, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		return err
	}
	return platformhttp.Serve(ctx, ":"+cfg.Port, app.engine)
}

type app struct {
	engine      *gin.Engine
	users       *users.Service
	customers   *customers.Service
	addresses   *addresses.Service
	shipments   *shipments.Service
	drivers     *drivers.Service
	vehicles    *vehicles.Service
	assignments *assignments.Service
	deliveries  *deliveries.Service
	payments    *payments.Service
}

// buildApp wires every feature. Features receive their collaborators as
// small interfaces, so this is the only place that knows the whole graph.
func buildApp(cfg config.Config, pool *pgxpool.Pool, files storage.FileStore) *app {
	engine := platformhttp.NewEngine(cfg, pool)
	api := engine.Group("/api/v1")

	txm := database.NewTxManager(pool)
	tokens := security.NewTokenManager(cfg.JWTSecret, cfg.JWTAccessExpiration)
	authenticate := middleware.Authenticate(tokens)
	recorder := audit.NewRecorder()

	// Authentication and accounts
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
	userSvc := users.NewService(pool, txm, users.NewRepository(), recorder)
	users.Register(api, users.NewHandler(userSvc), authenticate)

	// Notifications (used by shipments, assignments, deliveries)
	notificationSvc := notifications.NewService(pool, notifications.NewRepository())
	notifications.Register(api, notifications.NewHandler(notificationSvc), authenticate)

	// Customers and their address books
	customerSvc := customers.NewService(pool, txm, customers.NewRepository(), userSvc, recorder)
	customers.Register(api, customers.NewHandler(customerSvc), authenticate)
	addressSvc := addresses.NewService(pool, txm, addresses.NewRepository(), recorder)
	addresses.Register(api, addresses.NewHandler(addressSvc), authenticate)

	// Shipments and public tracking
	shipmentSvc := shipments.NewService(shipments.Deps{
		DB: pool, Tx: txm, Repo: shipments.NewRepository(), Addresses: addressSvc, Notifier: notificationSvc, Audit: recorder,
	})
	shipments.Register(api, shipments.NewHandler(shipmentSvc), authenticate)
	tracking.Register(api, tracking.NewHandler(tracking.NewService(shipmentSvc)), middleware.NewRateLimiter(30, 10))

	// Fleet
	driverSvc := drivers.NewService(pool, txm, drivers.NewRepository(), userSvc, recorder)
	drivers.Register(api, drivers.NewHandler(driverSvc), authenticate)
	vehicleSvc := vehicles.NewService(pool, txm, vehicles.NewRepository(), recorder)
	vehicles.Register(api, vehicles.NewHandler(vehicleSvc), authenticate)

	// Assignments and deliveries
	assignmentSvc := assignments.NewService(assignments.Deps{
		DB: pool, Tx: txm, Repo: assignments.NewRepository(), Shipments: shipmentSvc,
		Drivers: driverSvc, Vehicles: vehicleSvc, Notifier: notificationSvc, Audit: recorder,
	})
	shipmentSvc.SetDriverAccess(assignmentSvc)
	assignments.Register(api, assignments.NewHandler(assignmentSvc), authenticate)
	deliverySvc := deliveries.NewService(deliveries.Deps{
		DB: pool, Tx: txm, Repo: deliveries.NewRepository(), Shipments: shipmentSvc, Assignments: assignmentSvc,
		Files: files, Notifier: notificationSvc, Audit: recorder,
	})
	deliveries.Register(api, deliveries.NewHandler(deliverySvc), authenticate)

	// Payments, reporting and audit
	paymentSvc := payments.NewService(pool, txm, payments.NewRepository(), shipmentSvc, recorder)
	payments.Register(api, payments.NewHandler(paymentSvc), authenticate)
	dashboard.Register(api, dashboard.NewService(pool, shipmentSvc), authenticate)
	audit.Register(api, audit.NewQuery(pool), authenticate)

	return &app{
		engine: engine, users: userSvc, customers: customerSvc, addresses: addressSvc, shipments: shipmentSvc,
		drivers: driverSvc, vehicles: vehicleSvc, assignments: assignmentSvc, deliveries: deliverySvc, payments: paymentSvc,
	}
}
