package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"log/slog"
	"math"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sassinzz13/i-ship/backend/internal/features/addresses"
	"github.com/sassinzz13/i-ship/backend/internal/features/assignments"
	"github.com/sassinzz13/i-ship/backend/internal/features/customers"
	"github.com/sassinzz13/i-ship/backend/internal/features/deliveries"
	"github.com/sassinzz13/i-ship/backend/internal/features/drivers"
	"github.com/sassinzz13/i-ship/backend/internal/features/payments"
	"github.com/sassinzz13/i-ship/backend/internal/features/shipments"
	"github.com/sassinzz13/i-ship/backend/internal/features/users"
	"github.com/sassinzz13/i-ship/backend/internal/features/vehicles"
	"github.com/sassinzz13/i-ship/backend/internal/platform/config"
	"github.com/sassinzz13/i-ship/backend/internal/platform/database"
	"github.com/sassinzz13/i-ship/backend/internal/platform/security"
	"github.com/sassinzz13/i-ship/backend/internal/platform/storage"
)

// DemoPassword is shared by every demo account created by `seed --demo`.
const DemoPassword = "Demo1234!"

func runSeed(ctx context.Context, cfg config.Config, args []string) error {
	pool, err := database.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()
	files, err := storage.NewLocalStore(cfg.UploadDir)
	if err != nil {
		return err
	}
	a := buildApp(cfg, pool, files)
	if err := a.users.EnsureAdmin(ctx, cfg.AdminEmail, cfg.AdminPassword); err != nil {
		return err
	}
	if len(args) == 0 || args[0] != "--demo" {
		return nil
	}
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE email = 'dispatcher@i-ship.demo')`).Scan(&exists); err != nil {
		return err
	}
	if exists {
		slog.Info("demo data already present; skipping")
		return nil
	}
	s := &seeder{app: a, pool: pool, rng: rand.New(rand.NewPCG(42, 7))}
	if err := s.run(ctx); err != nil {
		return fmt.Errorf("seed demo data: %w", err)
	}
	slog.Info("demo data seeded", "shipments", len(s.shipments))
	return nil
}

type seeder struct {
	app       *app
	pool      *pgxpool.Pool
	rng       *rand.Rand
	admin     security.Principal
	staff     security.Principal
	drivers   []drivers.Driver
	vehicles  []vehicles.Vehicle
	shipments []int64
}

func (s *seeder) as(ctx context.Context, p security.Principal) context.Context {
	return ctxWithPrincipal(ctx, p)
}

func (s *seeder) run(ctx context.Context) error {
	var adminID int64
	if err := s.pool.QueryRow(ctx, `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'ADMIN' ORDER BY u.id LIMIT 1`).Scan(&adminID); err != nil {
		return errors.New("an admin account is required before seeding (set ADMIN_EMAIL and ADMIN_PASSWORD)")
	}
	s.admin = security.Principal{UserID: adminID, Role: security.RoleAdmin}
	actx := s.as(ctx, s.admin)

	// Staff accounts
	for _, u := range []users.NewUser{
		{Email: "dispatcher@i-ship.demo", FullName: "Dana Dispatcher", Role: security.RoleDispatcher},
		{Email: "staff@i-ship.demo", FullName: "Sam Staff", Role: security.RoleStaff},
	} {
		u.Password = DemoPassword
		created, err := s.app.users.Create(actx, u)
		if err != nil {
			return err
		}
		if u.Role == security.RoleStaff {
			s.staff = security.Principal{UserID: created.ID, Role: security.RoleStaff}
		}
	}

	// Drivers
	driverSeeds := []struct{ name, email, code, lic, phone string }{
		{"Ramon Santos", "driver@i-ship.demo", "DRV-001", "N01-23-456789", "+63 917 111 2001"},
		{"Liza Mercado", "liza.driver@i-ship.demo", "DRV-002", "N02-22-987654", "+63 917 111 2002"},
		{"Paolo Reyes", "paolo.driver@i-ship.demo", "DRV-003", "N03-24-112233", "+63 917 111 2003"},
		{"Grace Villanueva", "grace.driver@i-ship.demo", "DRV-004", "N04-21-445566", "+63 917 111 2004"},
	}
	for i, d := range driverSeeds {
		ec, ep := "Maria "+d.name[len(d.name)-6:], "+63 918 222 300"+fmt.Sprint(i)
		drv, err := s.app.drivers.Create(actx, drivers.CreateInput{
			Email: d.email, Password: DemoPassword,
			Fields: drivers.Fields{FullName: d.name, Phone: d.phone, EmployeeCode: d.code, LicenseNumber: d.lic,
				LicenseExpiry: time.Now().AddDate(1+i%2, i, 0), EmergencyContactName: &ec, EmergencyContactPhone: &ep},
		})
		if err != nil {
			return err
		}
		s.drivers = append(s.drivers, drv)
	}

	// Vehicles
	year := func(y int) *int { return &y }
	for _, v := range []vehicles.VehicleRequest{
		{PlateNumber: "NAB 1234", VehicleType: "VAN", Brand: "Toyota", Model: "HiAce", Year: year(2022), WeightCapacityKg: 1200},
		{PlateNumber: "MCY 5521", VehicleType: "MOTORCYCLE", Brand: "Honda", Model: "Click 125", Year: year(2023), WeightCapacityKg: 40},
		{PlateNumber: "TRK 8890", VehicleType: "TRUCK", Brand: "Isuzu", Model: "N-Series", Year: year(2021), WeightCapacityKg: 4000},
		{PlateNumber: "CAR 3307", VehicleType: "CAR", Brand: "Suzuki", Model: "Ertiga", Year: year(2020), WeightCapacityKg: 450},
		{PlateNumber: "VAN 7712", VehicleType: "VAN", Brand: "Nissan", Model: "Urvan", Year: year(2019), WeightCapacityKg: 1000, Status: "MAINTENANCE"},
	} {
		veh, err := s.app.vehicles.Create(actx, v)
		if err != nil {
			return err
		}
		s.vehicles = append(s.vehicles, veh)
	}

	// Customers with address books
	type addr struct{ label, contact, phone, line1, brgy, city, prov, zip string }
	custSeeds := []struct {
		name, company, email, phone string
		portal                      bool
		addrs                       []addr
	}{
		{"Juan Dela Cruz", "", "customer@i-ship.demo", "+63 917 555 0101", true, []addr{
			{"Home", "Juan Dela Cruz", "+63 917 555 0101", "12 Rizal Street", "Poblacion", "Makati City", "Metro Manila", "1210"},
			{"Mother", "Elena Dela Cruz", "+63 917 555 0199", "45 Mabini Avenue", "San Antonio", "Pasig City", "Metro Manila", "1600"},
			{"Office", "Ana Robles", "+63 917 555 0177", "8th Floor, Ayala Tower", "Lahug", "Cebu City", "Cebu", "6000"},
		}},
		{"Maria Santos", "Santos Bakeshop", "orders@santosbakeshop.ph", "+63 918 555 0202", false, []addr{
			{"Shop", "Maria Santos", "+63 918 555 0202", "88 Aguinaldo Highway", "Zapote", "Bacoor", "Cavite", "4102"},
			{"Client", "Rico Tan", "+63 918 555 0288", "21 Katipunan Avenue", "Loyola Heights", "Quezon City", "Metro Manila", "1108"},
			{"Branch", "Joy Lim", "+63 918 555 0266", "3 Session Road", "Kabayanihan", "Baguio City", "Benguet", "2600"},
		}},
		{"TechHub Gadgets Inc.", "TechHub Gadgets Inc.", "logistics@techhub.ph", "+63 2 8555 0303", false, []addr{
			{"Warehouse", "Warehouse Desk", "+63 2 8555 0303", "Lot 5 Industrial Park", "Bagumbayan", "Taguig City", "Metro Manila", "1630"},
			{"Customer", "Mark Bautista", "+63 919 555 0311", "77 J.P. Laurel Avenue", "Bajada", "Davao City", "Davao del Sur", "8000"},
			{"Customer", "Carla Ong", "+63 919 555 0322", "14 Lacson Street", "Mandalagan", "Bacolod City", "Negros Occidental", "6100"},
			{"Customer", "Jose Garcia", "+63 919 555 0333", "9 Burgos Street", "Centro", "Iloilo City", "Iloilo", "5000"},
		}},
		{"Angela Reyes", "", "angela.reyes@example.com", "+63 920 555 0404", false, []addr{
			{"Home", "Angela Reyes", "+63 920 555 0404", "5 Sampaguita Lane", "Malamig", "Mandaluyong", "Metro Manila", "1550"},
			{"Friend", "Bea Cruz", "+63 920 555 0411", "102 Commonwealth Ave", "Holy Spirit", "Quezon City", "Metro Manila", "1127"},
		}},
		{"Mabuhay Pharma", "Mabuhay Pharma Distribution", "dispatch@mabuhaypharma.ph", "+63 2 8555 0505", false, []addr{
			{"Depot", "Depot Supervisor", "+63 2 8555 0505", "KM 18 West Service Road", "Sucat", "Parañaque City", "Metro Manila", "1700"},
			{"Pharmacy", "Dr. Lea Navarro", "+63 921 555 0512", "66 Real Street", "Poblacion", "Calamba", "Laguna", "4027"},
			{"Pharmacy", "Tom Aquino", "+63 921 555 0523", "18 Macarthur Highway", "Dolores", "San Fernando", "Pampanga", "2000"},
		}},
	}
	type cust struct {
		id    int64
		addrs []int64
	}
	var custs []cust
	for _, c := range custSeeds {
		f := customers.Fields{FullName: c.name, Phone: c.phone, CustomerType: customers.TypeIndividual}
		if c.email != "" {
			e := c.email
			f.Email = &e
		}
		if c.company != "" {
			co := c.company
			f.CompanyName, f.CustomerType = &co, customers.TypeBusiness
		}
		var portal *customers.Portal
		if c.portal {
			portal = &customers.Portal{Email: c.email, Password: DemoPassword}
		}
		created, err := s.app.customers.Create(actx, s.admin, f, portal)
		if err != nil {
			return err
		}
		cu := cust{id: created.ID}
		for _, a := range c.addrs {
			brgy, zip := a.brgy, a.zip
			ad, err := s.app.addresses.Create(actx, created.ID, addresses.Fields{
				Label: a.label, ContactName: a.contact, ContactPhone: a.phone, Line1: a.line1, Barangay: &brgy,
				City: a.city, Province: a.prov, PostalCode: &zip,
			})
			if err != nil {
				return err
			}
			cu.addrs = append(cu.addrs, ad.ID)
		}
		custs = append(custs, cu)
	}

	// Shipments in every lifecycle stage.
	itemsCatalog := [][]shipments.ItemInput{
		{{Description: "Documents envelope", Quantity: 1, WeightKg: 0.5, DeclaredValue: 200}},
		{{Description: "Assorted pastries (box)", Quantity: 3, WeightKg: 1.2, DeclaredValue: 450}},
		{{Description: "Smartphone", Quantity: 2, WeightKg: 0.4, DeclaredValue: 18000}, {Description: "Phone accessories", Quantity: 1, WeightKg: 0.6, DeclaredValue: 1500}},
		{{Description: "Laptop", Quantity: 1, WeightKg: 2.5, DeclaredValue: 55000}},
		{{Description: "Medicine carton", Quantity: 4, WeightKg: 3.0, DeclaredValue: 8000}},
		{{Description: "Clothing parcel", Quantity: 2, WeightKg: 1.5, DeclaredValue: 2500}},
		{{Description: "Kitchen appliance", Quantity: 1, WeightKg: 6.5, DeclaredValue: 4200}},
	}
	services := []shipments.ServiceType{shipments.ServiceStandard, shipments.ServiceNextDay, shipments.ServiceExpress, shipments.ServiceSameDay}
	plan := []string{
		"DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED",
		"OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY",
		"ACCEPTED", "ASSIGNED", "ASSIGNED",
		"IN_TRANSIT", "IN_TRANSIT", "PICKED_UP", "CONFIRMED", "CONFIRMED",
		"PENDING", "PENDING", "PENDING",
		"FAILED_DELIVERY", "FAILED_DELIVERY", "RETURNED", "CANCELLED",
	}
	s.rng.Shuffle(len(plan), func(a, b int) { plan[a], plan[b] = plan[b], plan[a] })
	sctx := s.as(ctx, s.staff)
	for i, target := range plan {
		c := custs[i%len(custs)]
		sender := c.addrs[0]
		recipient := c.addrs[1+s.rng.IntN(len(c.addrs)-1)]
		eta := time.Now().Add(time.Duration(24+s.rng.IntN(72)) * time.Hour)
		instr := []string{"", "Call before arriving", "Leave with the guard if not home", "Fragile — handle with care", ""}[s.rng.IntN(5)]
		var instrPtr *string
		if instr != "" {
			instrPtr = &instr
		}
		sh, err := s.app.shipments.Create(sctx, s.staff, shipments.Input{
			CustomerID: c.id, SenderAddressID: sender, RecipientAddressID: recipient,
			ServiceType: services[s.rng.IntN(len(services))], Items: itemsCatalog[s.rng.IntN(len(itemsCatalog))],
			SpecialInstructions: instrPtr, EstimatedDeliveryAt: &eta,
		})
		if err != nil {
			return err
		}
		s.shipments = append(s.shipments, sh.ID)
		if err := s.advance(ctx, sh, target, i); err != nil {
			return fmt.Errorf("shipment %s to %s: %w", sh.TrackingNumber, target, err)
		}
	}
	return s.spreadTimestamps(ctx)
}

// advance drives a shipment through the real workflows to reach target.
func (s *seeder) advance(ctx context.Context, sh shipments.Shipment, target string, i int) error {
	sctx := s.as(ctx, s.staff)
	step := func(st shipments.Status, loc string) error {
		l := loc
		_, err := s.app.shipments.ChangeStatus(sctx, s.staff, sh.ID, shipments.TransitionInput{To: st, Location: &l})
		return err
	}
	pay := func(method string, paid bool) error {
		ref := fmt.Sprintf("%s-%06d", method[:2], 100000+i*37)
		status := "PENDING"
		if paid {
			status = "PAID"
		}
		r := payments.CreateRequest{ShipmentID: sh.ID, Amount: sh.ShippingFee, Method: method, Status: status}
		if method != "CASH" {
			r.Reference = &ref
		}
		_, err := s.app.payments.Create(sctx, s.staff, r)
		return err
	}
	switch target {
	case "PENDING":
		return nil
	case "CANCELLED":
		reason := "Customer requested cancellation"
		_, err := s.app.shipments.ChangeStatus(sctx, s.staff, sh.ID, shipments.TransitionInput{To: shipments.StatusCancelled, Notes: &reason})
		return err
	}
	if err := step(shipments.StatusConfirmed, "i-Ship Hub, Pasig"); err != nil {
		return err
	}
	if i%3 == 0 {
		if err := pay([]string{"GCASH", "MAYA", "BANK_TRANSFER"}[i%3], true); err != nil {
			return err
		}
	}
	switch target {
	case "CONFIRMED":
		return nil
	case "PICKED_UP", "IN_TRANSIT", "RETURNED":
		if err := step(shipments.StatusPickedUp, "Sender address"); err != nil {
			return err
		}
		if target == "PICKED_UP" {
			return nil
		}
		if err := step(shipments.StatusInTransit, "i-Ship Hub, Pasig"); err != nil {
			return err
		}
		if target == "RETURNED" {
			return step(shipments.StatusReturned, "Returned to sender")
		}
		return nil
	}

	// Remaining targets need a driver run.
	drv := s.drivers[i%len(s.drivers)]
	veh := s.vehicles[0]
	for _, v := range s.vehicles {
		if v.Status != "MAINTENANCE" && v.WeightCapacityKg >= sh.TotalWeight && v.VehicleType != "TRUCK" {
			veh = v
			if s.rng.IntN(2) == 0 {
				break
			}
		}
	}
	dispatcher := security.Principal{UserID: s.admin.UserID, Role: security.RoleAdmin}
	asg, err := s.app.assignments.Create(s.as(ctx, dispatcher), dispatcher, assignments.CreateInput{ShipmentID: sh.ID, DriverID: drv.ID, VehicleID: veh.ID})
	if err != nil {
		return err
	}
	if target == "ASSIGNED" {
		return nil
	}
	dp := security.Principal{UserID: drv.UserID, Role: security.RoleDriver, DriverID: &drv.ID}
	dctx := s.as(ctx, dp)
	if _, err := s.app.assignments.Accept(dctx, dp, asg.ID); err != nil {
		return err
	}
	if target == "ACCEPTED" {
		return nil
	}
	if _, err := s.app.assignments.Start(dctx, dp, asg.ID); err != nil {
		return err
	}
	switch target {
	case "OUT_FOR_DELIVERY":
		return nil
	case "FAILED_DELIVERY":
		note := "No one answered the door; left a calling card"
		_, err := s.app.deliveries.RecordFailedAttempt(dctx, dp, sh.ID, deliveries.AttemptInput{Outcome: deliveries.OutcomeRecipientUnavailable, Notes: &note})
		return err
	}
	// DELIVERED
	sig, photo := demoSignature(i), demoPhoto(i)
	rel := []string{"SELF", "FAMILY", "SECURITY_GUARD", "COLLEAGUE"}[i%4]
	if _, err := s.app.deliveries.SubmitProof(dctx, dp, sh.ID, deliveries.ProofInput{
		RecipientName: sh.Recipient.ContactName, RecipientRelationship: rel,
	}, &deliveries.Upload{Reader: bytes.NewReader(sig), ContentType: "image/png"},
		&deliveries.Upload{Reader: bytes.NewReader(photo), ContentType: "image/jpeg"}); err != nil {
		return err
	}
	if i%3 != 0 {
		return pay("CASH", true)
	}
	return nil
}

// spreadTimestamps moves each seeded shipment and everything attached to it
// back by a random number of days (keeping order) so dashboards show a
// realistic week. Ledger triggers are disabled only inside this transaction.
func (s *seeder) spreadTimestamps(ctx context.Context) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, t := range []string{"shipment_status_history", "delivery_attempts", "audit_logs"} {
		if _, err := tx.Exec(ctx, `ALTER TABLE `+t+` DISABLE TRIGGER USER`); err != nil {
			return err
		}
	}
	for i, id := range s.shipments {
		// Oldest shipments first; each history step is spaced ~2h apart.
		days := 6 - (i*7)/len(s.shipments)
		shift := fmt.Sprintf("%d hours", days*24+14+s.rng.IntN(5))
		step := "2 hours 10 minutes"
		if days == 0 {
			shift, step = fmt.Sprintf("%d hours", 3+s.rng.IntN(2)), "25 minutes"
		}
		for _, q := range []string{
			`UPDATE shipments SET created_at = created_at - $2::interval WHERE id = $1`,
			`UPDATE shipment_status_history h SET created_at = s.created_at + (o.rn - 1) * interval 'STEP'
				FROM shipments s, (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM shipment_status_history WHERE shipment_id = $1) o
				WHERE h.id = o.id AND s.id = $1`,
			`UPDATE shipments s SET actual_delivery_at = h.created_at, tracking_number = 'ISH-' ||
				to_char(s.created_at AT TIME ZONE 'Asia/Manila', 'YYYYMMDD') || substr(s.tracking_number, 13)
				FROM (SELECT max(created_at) AS created_at FROM shipment_status_history WHERE shipment_id = $1 AND to_status = 'DELIVERED') h
				WHERE s.id = $1`,
			`UPDATE delivery_assignments a SET
				assigned_at  = s.created_at + interval '3 hours',
				accepted_at  = CASE WHEN accepted_at IS NOT NULL THEN s.created_at + interval '3 hours 20 minutes' END,
				started_at   = CASE WHEN started_at IS NOT NULL THEN s.created_at + interval '4 hours' END,
				completed_at = CASE WHEN completed_at IS NOT NULL THEN COALESCE(s.actual_delivery_at, s.created_at + interval '9 hours') END,
				cancelled_at = CASE WHEN cancelled_at IS NOT NULL THEN s.created_at + interval '5 hours' END
				FROM shipments s WHERE s.id = a.shipment_id AND a.shipment_id = $1`,
			`UPDATE delivery_attempts t SET attempted_at = COALESCE(s.actual_delivery_at, s.created_at + interval '9 hours')
				FROM shipments s WHERE s.id = t.shipment_id AND t.shipment_id = $1`,
			`UPDATE proof_of_delivery p SET delivered_at = s.actual_delivery_at FROM shipments s WHERE s.id = p.shipment_id AND p.shipment_id = $1`,
			`UPDATE payments p SET created_at = s.created_at + interval '2 hours',
				paid_at = CASE WHEN p.paid_at IS NOT NULL THEN COALESCE(s.actual_delivery_at, s.created_at + interval '2 hours') END
				FROM shipments s WHERE s.id = p.shipment_id AND p.shipment_id = $1`,
			`UPDATE audit_logs l SET created_at = s.created_at + interval '1 hour'
				FROM shipments s WHERE l.entity_type = 'shipment' AND l.entity_id = s.id AND s.id = $1`,
		} {
			args := []any{id}
			if strings.Contains(q, "$2") {
				args = append(args, shift)
			}
			q = strings.ReplaceAll(q, "STEP", step) // step is a code constant, not input
			if _, err := tx.Exec(ctx, q, args...); err != nil {
				return err
			}
		}
	}
	// Shipments that are still moving should have recent activity.
	if _, err := tx.Exec(ctx, `UPDATE notifications SET created_at = now() - (random() * interval '3 days')`); err != nil {
		return err
	}
	for _, t := range []string{"shipment_status_history", "delivery_attempts", "audit_logs"} {
		if _, err := tx.Exec(ctx, `ALTER TABLE `+t+` ENABLE TRIGGER USER`); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// demoSignature draws a synthetic signature stroke.
func demoSignature(seed int) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, 480, 160))
	ink := color.NRGBA{15, 23, 42, 255}
	for t := 0.0; t < 1; t += 0.0005 {
		x := 30 + t*420
		y := 80 + 35*math.Sin(t*math.Pi*(5+float64(seed%3))) + 15*math.Cos(t*math.Pi*13)
		for dx := -1; dx <= 1; dx++ {
			for dy := -1; dy <= 1; dy++ {
				img.Set(int(x)+dx, int(y)+dy, ink)
			}
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

// demoPhoto renders a simple parcel-on-doorstep illustration.
func demoPhoto(seed int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 640, 480))
	for y := 0; y < 480; y++ {
		for x := 0; x < 640; x++ {
			c := color.RGBA{uint8(200 - y/6), uint8(210 - y/8), uint8(225 - y/10), 255}
			if y > 330 {
				c = color.RGBA{120, 113, 108, 255}
			}
			img.Set(x, y, c)
		}
	}
	box := color.RGBA{uint8(180 + seed%40), 134, 82, 255}
	for y := 230; y < 380; y++ {
		for x := 230; x < 430; x++ {
			c := box
			if x > 322 && x < 338 {
				c = color.RGBA{230, 220, 200, 255}
			}
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80})
	return buf.Bytes()
}
