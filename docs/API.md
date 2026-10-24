# i-Ship REST API

The base path is `https://i-ship.duckdns.org/api/v1`. Traefik routes `/api/*` to the Go backend. Locally, the Angular dev server proxies `/api` to `localhost:8080`.

## Conventions

**Response envelopes.** Every response uses one of these shapes:

```json
{ "success": true, "data": { } }
{ "success": true, "data": [ ], "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": { "phone": "is required" } } }
```

**Error codes and their HTTP statuses:**

| Code | Status |
| --- | --- |
| `VALIDATION_ERROR` | 422 |
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `INVALID_TRANSITION` | 409 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |
| `SERVICE_UNAVAILABLE` | 503 |

**Authentication.**
- Send `Authorization: Bearer <accessToken>`.
- The access token lasts 15 minutes.
- The refresh token is an httpOnly cookie named `iship_refresh`, scoped to `/api/v1/auth`.

**Lists.**
- Pagination: `?page=1&pageSize=20`. The page size can be at most 100.
- Sorting: `?sort=field` sorts ascending and `?sort=-field` sorts descending. Only the fields listed for each endpoint can be used.

**Data formats.**
- JSON keys are camelCase.
- Timestamps are RFC 3339 strings. Dates (for example a license expiry) are `YYYY-MM-DD`.
- Money and weights are JSON numbers. Money is in PHP and weights are in kg.

**Ownership.** Customers only ever see their own data. Drivers only see shipments and assignments assigned to them. A resource the caller is not allowed to see returns `404`, so the response doesn't reveal that it exists.

**Role groups** used in the tables below:

| Group | Roles |
| --- | --- |
| OPS | ADMIN, DISPATCHER, STAFF |
| DISPATCH | ADMIN, DISPATCHER |

---

## Health (outside `/api/v1`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health`, `/api/health` | Returns `{status:"ok"}` when the process is up. |
| GET | `/ready`, `/api/ready` | Returns `{status:"ready", database:"up"}`, or `503` when PostgreSQL is unreachable. |

## Authentication

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | public (rate limited) | `{email, password}` → `Session` and sets the refresh cookie |
| POST | `/auth/refresh` | refresh cookie | → `Session` and rotates the cookie. Reusing an old token revokes the whole token family. |
| POST | `/auth/logout` | refresh cookie | Revokes the session. |
| GET | `/auth/me` | any signed-in user | → `User` |
| PUT | `/auth/password` | any signed-in user | `{currentPassword, newPassword}`. Revokes every session. |

```ts
Session = { accessToken, tokenType: 'Bearer', expiresAt, expiresIn, user: User }
User    = { id, email, fullName, phone, role, customerId, driverId, lastLoginAt }
```

## Users (ADMIN)

| Method | Path | Body / notes |
| --- | --- | --- |
| GET | `/users?search&role&active&sort=email\|fullName\|role\|createdAt\|lastLoginAt` | Paginated `UserRecord[]` |
| POST | `/users` | `{email, password, fullName, phone?, role}` |
| GET | `/users/:id` | `UserRecord` |
| PUT | `/users/:id` | `{fullName, phone?, role, isActive}`. Admins can't demote or deactivate themselves or the last active admin. |
| PUT | `/users/:id/password` | `{password}`. Revokes that user's sessions. |

```ts
UserRecord = { id, email, fullName, phone, role, isActive, lastLoginAt, createdAt, updatedAt }
```

## Customers

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/customers?search&customerType&active&sort=fullName\|customerCode\|createdAt` | OPS | Paginated `Customer[]` |
| POST | `/customers` | OPS | `{customerType?, fullName, companyName?, email?, phone, notes?, portalAccount?: {email, password}}` |
| GET | `/customers/:id` | OPS | `Customer` |
| PUT | `/customers/:id` | OPS | `{customerType, fullName, companyName?, email?, phone, notes?, isActive}` |
| GET | `/customers/me` | CUSTOMER | The caller's own `Customer` |
| PUT | `/customers/me` | CUSTOMER | `{fullName, companyName?, phone}` |

```ts
Customer = { id, customerCode, userId, customerType: 'INDIVIDUAL'|'BUSINESS', fullName, companyName, email, phone,
             notes, isActive, hasPortalAccount, createdAt, updatedAt }
```

## Addresses

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/customers/:id/addresses?includeArchived=true` | OPS | `Address[]`, with the default address first |
| POST | `/customers/:id/addresses` | OPS | `AddressInput`. A customer's first address becomes the default. |
| PUT | `/addresses/:id` | OPS | `AddressInput` |
| DELETE | `/addresses/:id` | OPS | Archives the address (soft delete). |
| GET | `/customers/me/addresses` | CUSTOMER | `Address[]` |

```ts
AddressInput = { label?, contactName, contactPhone, line1, line2?, barangay?, city, province, postalCode?, country?, latitude?, longitude?, isDefault? }
Address      = AddressInput & { id, customerId, isDefault, archivedAt, createdAt, updatedAt }
```

## Shipments

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/shipments` | OPS, CUSTOMER (own only) | Paginated `ShipmentSummary[]`. Filters and sort fields are listed below the table. |
| GET | `/shipments/quote?serviceType&weight` | OPS | `{serviceType, weight, shippingFee}` |
| POST | `/shipments` | OPS | `ShipmentInput` → `Shipment` |
| GET | `/shipments/:id` | OPS, owning CUSTOMER, assigned DRIVER | `Shipment` |
| PUT | `/shipments/:id` | OPS | `ShipmentInput` without `customerId`. Only allowed while the status is PENDING or CONFIRMED. |
| GET | `/shipments/:id/history` | same as `GET /shipments/:id` | `StatusHistory[]`, oldest first |
| POST | `/shipments/:id/status` | OPS | `{status, notes?, location?}`. Cancelling requires `notes`, which is stored as the cancellation reason. |

**List filters** for `GET /shipments`:
- `search` matches the tracking number, customer name or recipient name.
- `status`, `serviceType`, `paymentStatus`, `customerId`.
- `dateFrom` and `dateTo` (both `YYYY-MM-DD`) filter on `createdAt`.

**List sort fields:** `createdAt`, `trackingNumber`, `estimatedDeliveryAt`, `shippingFee`, `currentStatus`.

**Status rules.**
- The manual status endpoint can only make transitions from the state machine below.
- `OUT_FOR_DELIVERY` can't be set manually. It is set when a driver starts the assignment.
- `DELIVERED` and `FAILED_DELIVERY` can't be set manually either. They come from the deliveries feature.
- `Shipment.allowedTransitions` lists the manual transitions the current caller may make.

```
PENDING → CONFIRMED | CANCELLED
CONFIRMED → PICKED_UP | CANCELLED
PICKED_UP → IN_TRANSIT | RETURNED
IN_TRANSIT → OUT_FOR_DELIVERY | RETURNED
OUT_FOR_DELIVERY → DELIVERED | FAILED_DELIVERY
FAILED_DELIVERY → OUT_FOR_DELIVERY | RETURNED
DELIVERED, RETURNED, CANCELLED → (terminal)
```

**Shipping fee.** If `shippingFee` is omitted, the backend quotes it as base + per-kg × weight:

| Service | Base | Per kg |
| --- | --- | --- |
| STANDARD | 80 | 15 |
| NEXT_DAY | 120 | 20 |
| EXPRESS | 150 | 25 |
| SAME_DAY | 250 | 30 |

```ts
ShipmentInput = { customerId, senderAddressId, recipientAddressId, serviceType: 'STANDARD'|'EXPRESS'|'SAME_DAY'|'NEXT_DAY',
                  declaredValue?, shippingFee?, specialInstructions?, scheduledPickupAt?, estimatedDeliveryAt?,
                  items: { description, quantity, weightKg, lengthCm?, widthCm?, heightCm?, declaredValue? }[] }   // >= 1 item
ShipmentSummary = { id, trackingNumber, customerId, customerName, recipientName, recipientCity, recipientProvince,
                    serviceType, currentStatus, paymentStatus, totalWeight, totalQuantity, shippingFee,
                    estimatedDeliveryAt, createdAt }
Shipment = ShipmentSummary & {
  customer: { id, customerCode, fullName, phone, email },
  sender: Address, recipient: Address,
  declaredValue, specialInstructions, cancellationReason, scheduledPickupAt, actualDeliveryAt, updatedAt,
  items: { id, description, quantity, weightKg, lengthCm, widthCm, heightCm, declaredValue }[],
  allowedTransitions: ShipmentStatus[] }
StatusHistory = { id, fromStatus, toStatus, notes, location, changedBy: { id, fullName } | null, createdAt }
```

Totals (`totalWeight` = Σ quantity × weightKg, `totalQuantity` = Σ quantity, `declaredValue` defaults to Σ item values) are computed on the server. Tracking numbers have the form `ISH-YYYYMMDD-NNNNNN`.

## Public tracking (no authentication, rate limited)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/tracking/:trackingNumber` | Returns `PublicTracking`, or `404` if the number is unknown. |

```ts
PublicTracking = { trackingNumber, currentStatus, serviceType, origin: { city, province }, destination: { city, province },
                   totalQuantity, estimatedDeliveryAt, actualDeliveryAt, createdAt,
                   timeline: { status, description, location, at }[] }    // newest first; no names, phones, streets or amounts
```

## Drivers

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/drivers?search&status&availability&sort=fullName\|employeeCode\|licenseExpiry\|createdAt` | DISPATCH | Paginated `Driver[]` |
| POST | `/drivers` | DISPATCH | `{fullName, email, password, phone, employeeCode, licenseNumber, licenseExpiry, emergencyContactName?, emergencyContactPhone?}`. Creates the DRIVER login account too. |
| GET | `/drivers/:id` | DISPATCH | `Driver` |
| PUT | `/drivers/:id` | DISPATCH | `{fullName, phone, employeeCode, licenseNumber, licenseExpiry, emergencyContactName?, emergencyContactPhone?, status, availability}` |
| GET | `/drivers/me` | DRIVER | The caller's own `Driver` |
| PUT | `/drivers/me/availability` | DRIVER | `{availability: 'AVAILABLE'\|'OFF_DUTY'}` |

```ts
Driver = { id, userId, fullName, email, employeeCode, licenseNumber, licenseExpiry, licenseExpired: boolean, phone,
           emergencyContactName, emergencyContactPhone, status: 'ACTIVE'|'INACTIVE'|'ON_LEAVE'|'SUSPENDED',
           availability: 'AVAILABLE'|'ON_DELIVERY'|'OFF_DUTY', activeAssignments: number, createdAt, updatedAt }
```

## Vehicles (DISPATCH)

| Method | Path | Body / notes |
| --- | --- | --- |
| GET | `/vehicles?search&status&vehicleType&sort=plateNumber\|weightCapacityKg\|createdAt` | Paginated `Vehicle[]` |
| POST | `/vehicles` | `{plateNumber, vehicleType, brand, model, year?, weightCapacityKg, status?}` |
| GET | `/vehicles/:id` | `Vehicle` |
| PUT | `/vehicles/:id` | Same body as `POST /vehicles` |

```ts
Vehicle = { id, plateNumber, vehicleType: 'MOTORCYCLE'|'CAR'|'VAN'|'TRUCK', brand, model, year, weightCapacityKg,
            status: 'AVAILABLE'|'IN_USE'|'MAINTENANCE'|'RETIRED', createdAt, updatedAt }
```

## Assignments

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/assignments?status&driverId&shipmentId&active=true&sort=assignedAt\|status` | DISPATCH | Paginated `Assignment[]` |
| POST | `/assignments` | DISPATCH | `{shipmentId, driverId, vehicleId, notes?}` |
| GET | `/assignments/:id` | DISPATCH, assigned DRIVER | `Assignment` |
| POST | `/assignments/:id/cancel` | DISPATCH | `{reason?}`. Only for active assignments. |
| GET | `/assignments/mine?scope=active\|history` | DRIVER | `Assignment[]`, not paginated; `history` returns the latest 50 |
| POST | `/assignments/:id/accept` | assigned DRIVER | ASSIGNED → ACCEPTED |
| POST | `/assignments/:id/reject` | assigned DRIVER | `{reason}`. ASSIGNED → REJECTED. |
| POST | `/assignments/:id/start` | assigned DRIVER | ACCEPTED → IN_PROGRESS. Moves the shipment to OUT_FOR_DELIVERY (see the rules below). |

**When an assignment can be created:**
- The shipment's status is CONFIRMED, PICKED_UP, IN_TRANSIT or FAILED_DELIVERY.
- The shipment has no other active assignment. A second one returns `CONFLICT`.
- The driver is ACTIVE, has an unexpired license and is not OFF_DUTY.
- The vehicle is AVAILABLE or IN_USE, and its `weightCapacityKg` is at least the shipment's `totalWeight`.

**What starting an assignment does:**
- The shipment advances one valid step at a time (CONFIRMED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY), and each step is recorded in the shipment's history.
- The driver becomes ON_DELIVERY and the vehicle becomes IN_USE.

**What ends an assignment:**
- A delivery attempt (successful or failed) marks the assignment COMPLETED.
- The driver and vehicle are released (back to AVAILABLE) unless they still have other in-progress assignments.
- A failed shipment is redelivered with a new assignment.

```ts
Assignment = { id, shipmentId, driverId, vehicleId, status: 'ASSIGNED'|'ACCEPTED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'|'REJECTED',
  notes, assignedAt, acceptedAt, startedAt, completedAt, cancelledAt,
  shipment: { id, trackingNumber, currentStatus, serviceType, totalWeight, totalQuantity, recipientName, recipientPhone,
              recipientAddress /* one line */, recipientCity, specialInstructions, estimatedDeliveryAt },
  driver: { id, fullName, employeeCode, phone }, vehicle: { id, plateNumber, vehicleType, brand, model },
  assignedBy: { id, fullName } | null }
```

## Deliveries

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/deliveries?outcome&driverId&dateFrom&dateTo&search` | DISPATCH | Paginated `DeliveryAttempt[]`, newest first |
| GET | `/deliveries/:shipmentId` | OPS, owning CUSTOMER, assigned DRIVER | `{attempts: DeliveryAttempt[], proof: ProofOfDelivery \| null}` |
| POST | `/deliveries/:shipmentId/attempts` | assigned DRIVER (IN_PROGRESS), DISPATCH | `{outcome, notes?, latitude?, longitude?}`. `outcome` can't be SUCCESSFUL here. `notes` is required when the outcome is OTHER. The shipment becomes FAILED_DELIVERY. |
| POST | `/deliveries/:shipmentId/proof` | assigned DRIVER (IN_PROGRESS), DISPATCH | `multipart/form-data` (fields below). Records the successful attempt, the proof, sets the shipment to DELIVERED and completes the assignment, all in one transaction. |
| GET | `/deliveries/:shipmentId/proof/signature` | same as `GET /deliveries/:shipmentId` | The image bytes |
| GET | `/deliveries/:shipmentId/proof/photo` | same as `GET /deliveries/:shipmentId` | The image bytes |

**Proof upload fields:** `recipientName`, `recipientRelationship` (SELF, FAMILY, FRIEND, NEIGHBOR, COLLEAGUE, SECURITY_GUARD or OTHER), optional `notes`, `latitude` and `longitude`, and the files `signature` (PNG) and `photo` (JPEG, PNG or WebP, at most 5 MB). At least one file is required.

```ts
DeliveryAttempt = { id, shipmentId, trackingNumber, assignmentId, attemptNumber,
  outcome: 'SUCCESSFUL'|'RECIPIENT_UNAVAILABLE'|'WRONG_ADDRESS'|'REFUSED'|'DAMAGED_PACKAGE'|'OTHER',
  notes, latitude, longitude, attemptedAt, driverName, recordedBy: { id, fullName } | null }
ProofOfDelivery = { id, shipmentId, attemptId, recipientName, recipientRelationship, notes, deliveredAt,
  hasSignature: boolean, hasPhoto: boolean, createdBy: { id, fullName } | null }
```

## Payments

| Method | Path | Who | Body / notes |
| --- | --- | --- | --- |
| GET | `/payments?search&status&method&shipmentId&dateFrom&dateTo&sort=createdAt\|amount\|paidAt` | OPS, CUSTOMER (own only) | Paginated `Payment[]` |
| POST | `/payments` | OPS | `{shipmentId, amount, method, reference?, status: 'PENDING'\|'PAID', paidAt?, notes?}` |
| PUT | `/payments/:id/status` | OPS | `{status: 'PAID'\|'FAILED'\|'REFUNDED', reference?}` |

**Payment rules:**
- A PAID payment by any method other than CASH needs a `reference`.
- `paidAt` defaults to now.
- `Shipment.paymentStatus` is recomputed in the same transaction:

| Paid amount (PAID minus REFUNDED) | `paymentStatus` |
| --- | --- |
| 0, with at least one refund | REFUNDED |
| 0 otherwise | UNPAID |
| less than the shipping fee | PARTIALLY_PAID |
| at least the shipping fee | PAID |

```ts
Payment = { id, shipmentId, trackingNumber, customerName, amount, method: 'CASH'|'BANK_TRANSFER'|'GCASH'|'MAYA'|'OTHER',
            reference, status: 'PENDING'|'PAID'|'FAILED'|'REFUNDED', paidAt, notes, recordedBy: { id, fullName } | null, createdAt }
```

## Notifications (any signed-in user; own only)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications?unread=true` | Paginated `Notification[]`, newest first |
| GET | `/notifications/unread-count` | `{unread}` |
| POST | `/notifications/:id/read` | Marks one notification read. |
| POST | `/notifications/read-all` | Marks every notification read. |

```ts
Notification = { id, type, title, message, entityType, entityId, readAt, createdAt }
```

**When notifications are created:**
- The customer's linked user is notified on every shipment status change.
- The driver's user is notified when they are assigned.
- Dispatchers and admins are notified about failed deliveries.

## Audit logs (ADMIN)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/audit-logs?action&entityType&entityId&actorUserId&dateFrom&dateTo` | Paginated `AuditLog[]`, newest first |

```ts
AuditLog = { id, actorUserId, actorName, actorEmail, actorRole, action, entityType, entityId, changes: object,
             ipAddress, userAgent, requestId, createdAt }
```

## Dashboard (OPS)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard/summary` | `DashboardSummary` |

```ts
DashboardSummary = {
  shipments: { total, pending, confirmed, pickedUp, inTransit, outForDelivery, delivered, failedDelivery, returned, cancelled },
  activeDrivers, availableDrivers, availableVehicles, pendingAssignments /* status ASSIGNED */,
  unassignedShipments /* assignable status without an active assignment */,
  deliveredToday, revenueToday,
  shipmentsByDay: { date /* YYYY-MM-DD */, created, delivered }[]   // last 7 days, oldest first
  recentShipments: ShipmentSummary[]                               // latest 8
}
```
