#!/usr/bin/env bash
# End-to-end smoke test against a running i-Ship instance.
#   ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/smoke-test.sh https://i-ship.duckdns.org
set -euo pipefail
BASE="${1:-http://localhost:8080}"
API="$BASE/api/v1"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL}" "${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"
pass=0; fail=0
check() { if [[ "$2" == "$3" ]]; then echo "ok   $1"; pass=$((pass+1)); else echo "FAIL $1 (got $2, want $3)"; fail=$((fail+1)); fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

check "health" "$(code "$BASE/api/health")" 200
check "ready" "$(code "$BASE/api/ready")" 200
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | json 'd["data"]["accessToken"]')
H="Authorization: Bearer $TOKEN"
check "me" "$(code "$API/auth/me" -H "$H")" 200
check "unauthenticated is 401" "$(code "$API/shipments")" 401
check "bad login is 401" "$(code -X POST "$API/auth/login" -H 'content-type: application/json' -d '{"email":"x@y.z","password":"wrong-password"}')" 401

CID=$(curl -s -X POST "$API/customers" -H "$H" -H 'content-type: application/json' \
  -d '{"fullName":"Smoke Test","phone":"+639170000000"}' | json 'd["data"]["id"]')
A1=$(curl -s -X POST "$API/customers/$CID/addresses" -H "$H" -H 'content-type: application/json' \
  -d '{"contactName":"Smoke Sender","contactPhone":"09170000001","line1":"1 Test St","city":"Pasig City","province":"Metro Manila"}' | json 'd["data"]["id"]')
A2=$(curl -s -X POST "$API/customers/$CID/addresses" -H "$H" -H 'content-type: application/json' \
  -d '{"contactName":"Smoke Recipient","contactPhone":"09170000002","line1":"2 Test St","city":"Makati City","province":"Metro Manila"}' | json 'd["data"]["id"]')
SHIP=$(curl -s -X POST "$API/shipments" -H "$H" -H 'content-type: application/json' \
  -d "{\"customerId\":$CID,\"senderAddressId\":$A1,\"recipientAddressId\":$A2,\"serviceType\":\"EXPRESS\",\"items\":[{\"description\":\"Smoke box\",\"quantity\":1,\"weightKg\":1.5}]}")
SID=$(echo "$SHIP" | json 'd["data"]["id"]'); TN=$(echo "$SHIP" | json 'd["data"]["trackingNumber"]')
[[ "$TN" =~ ^ISH-[0-9]{8}-[0-9]{6}$ ]] && check "tracking number format" ok ok || check "tracking number format" "$TN" "ISH-YYYYMMDD-NNNNNN"
check "invalid transition rejected" "$(code -X POST "$API/shipments/$SID/status" -H "$H" -H 'content-type: application/json' -d '{"status":"IN_TRANSIT"}')" 409
check "confirm shipment" "$(code -X POST "$API/shipments/$SID/status" -H "$H" -H 'content-type: application/json' -d '{"status":"CONFIRMED"}')" 200
check "public tracking" "$(code "$API/tracking/$TN")" 200
check "tracking hides PII" "$(curl -s "$API/tracking/$TN" | grep -c 'Smoke Recipient' || true)" 0
check "unknown tracking is 404" "$(code "$API/tracking/ISH-20000101-999999")" 404
check "dashboard" "$(code "$API/dashboard/summary" -H "$H")" 200
check "audit logs" "$(code "$API/audit-logs" -H "$H")" 200
REASON='{"status":"CANCELLED","notes":"smoke test cleanup"}'
check "cancel shipment" "$(code -X POST "$API/shipments/$SID/status" -H "$H" -H 'content-type: application/json' -d "$REASON")" 200

echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
