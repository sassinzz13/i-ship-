// Package dashboard serves read-only operational aggregates. It owns no
// tables; its queries read across feature tables purely for reporting.
package dashboard

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/middleware"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	apperr "github.com/sassinzz13/i-ship/backend/internal/shared/errors"
	"github.com/sassinzz13/i-ship/backend/internal/shared/response"
	"github.com/sassinzz13/i-ship/backend/internal/shared/utilities"
)

type ShipmentCounts struct {
	Total          int `json:"total"`
	Pending        int `json:"pending"`
	Confirmed      int `json:"confirmed"`
	PickedUp       int `json:"pickedUp"`
	InTransit      int `json:"inTransit"`
	OutForDelivery int `json:"outForDelivery"`
	Delivered      int `json:"delivered"`
	FailedDelivery int `json:"failedDelivery"`
	Returned       int `json:"returned"`
	Cancelled      int `json:"cancelled"`
}

type DayCount struct {
	Date      string `json:"date"`
	Created   int    `json:"created"`
	Delivered int    `json:"delivered"`
}

type Summary struct {
	Shipments           ShipmentCounts      `json:"shipments"`
	ActiveDrivers       int                 `json:"activeDrivers"`
	AvailableDrivers    int                 `json:"availableDrivers"`
	AvailableVehicles   int                 `json:"availableVehicles"`
	PendingAssignments  int                 `json:"pendingAssignments"`
	UnassignedShipments int                 `json:"unassignedShipments"`
	DeliveredToday      int                 `json:"deliveredToday"`
	RevenueToday        float64             `json:"revenueToday"`
	ShipmentsByDay      []DayCount          `json:"shipmentsByDay"`
	RecentShipments     []shipments.Summary `json:"recentShipments"`
}

type RecentLister interface {
	List(ctx context.Context, actor security.Principal, f shipments.ListFilter, p utilities.Pagination, s utilities.Sort) ([]shipments.Summary, int, error)
}

type Service struct {
	db     database.DBTX
	recent RecentLister
}

func NewService(db database.DBTX, recent RecentLister) *Service { return &Service{db: db, recent: recent} }

func (s *Service) Summary(ctx context.Context, actor security.Principal) (Summary, error) {
	var out Summary
	c := &out.Shipments
	err := s.db.QueryRow(ctx, `SELECT count(*),
		count(*) FILTER (WHERE current_status = 'PENDING'),
		count(*) FILTER (WHERE current_status = 'CONFIRMED'),
		count(*) FILTER (WHERE current_status = 'PICKED_UP'),
		count(*) FILTER (WHERE current_status = 'IN_TRANSIT'),
		count(*) FILTER (WHERE current_status = 'OUT_FOR_DELIVERY'),
		count(*) FILTER (WHERE current_status = 'DELIVERED'),
		count(*) FILTER (WHERE current_status = 'FAILED_DELIVERY'),
		count(*) FILTER (WHERE current_status = 'RETURNED'),
		count(*) FILTER (WHERE current_status = 'CANCELLED'),
		count(*) FILTER (WHERE current_status = 'DELIVERED' AND actual_delivery_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'),
		count(*) FILTER (WHERE current_status IN ('CONFIRMED','PICKED_UP','IN_TRANSIT','FAILED_DELIVERY')
			AND NOT EXISTS (SELECT 1 FROM delivery_assignments a WHERE a.shipment_id = shipments.id AND a.status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')))
		FROM shipments`).Scan(&c.Total, &c.Pending, &c.Confirmed, &c.PickedUp, &c.InTransit, &c.OutForDelivery, &c.Delivered,
		&c.FailedDelivery, &c.Returned, &c.Cancelled, &out.DeliveredToday, &out.UnassignedShipments)
	if err != nil {
		return out, apperr.Internal(err)
	}
	err = s.db.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM drivers WHERE status = 'ACTIVE'),
		(SELECT count(*) FROM drivers WHERE status = 'ACTIVE' AND availability = 'AVAILABLE'),
		(SELECT count(*) FROM vehicles WHERE status = 'AVAILABLE'),
		(SELECT count(*) FROM delivery_assignments WHERE status = 'ASSIGNED'),
		(SELECT COALESCE(sum(amount), 0)::float8 FROM payments WHERE status = 'PAID'
			AND paid_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')`).
		Scan(&out.ActiveDrivers, &out.AvailableDrivers, &out.AvailableVehicles, &out.PendingAssignments, &out.RevenueToday)
	if err != nil {
		return out, apperr.Internal(err)
	}
	rows, err := s.db.Query(ctx, `
		WITH days AS (SELECT generate_series((now() AT TIME ZONE 'Asia/Manila')::date - 6, (now() AT TIME ZONE 'Asia/Manila')::date, '1 day')::date AS d)
		SELECT to_char(d, 'YYYY-MM-DD'),
			(SELECT count(*) FROM shipments WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = d),
			(SELECT count(*) FROM shipments WHERE (actual_delivery_at AT TIME ZONE 'Asia/Manila')::date = d)
		FROM days ORDER BY d`)
	if err != nil {
		return out, apperr.Internal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var d DayCount
		if err := rows.Scan(&d.Date, &d.Created, &d.Delivered); err != nil {
			return out, apperr.Internal(err)
		}
		out.ShipmentsByDay = append(out.ShipmentsByDay, d)
	}
	if err := rows.Err(); err != nil {
		return out, apperr.Internal(err)
	}
	out.RecentShipments, _, err = s.recent.List(ctx, actor, shipments.ListFilter{}, utilities.Pagination{Page: 1, PageSize: 8},
		utilities.Sort{Column: "s.created_at", Desc: true})
	if err != nil {
		return out, err
	}
	return out, nil
}


func Register(api *gin.RouterGroup, svc *Service, authenticate gin.HandlerFunc) {
	api.GET("/dashboard/summary", authenticate, middleware.RequireRoles(security.Operations...), func(c *gin.Context) {
		actor, _ := security.FromGin(c)
		out, err := svc.Summary(c.Request.Context(), actor)
		if err != nil {
			response.Error(c, err)
			return
		}
		response.OK(c, out)
	})
}
