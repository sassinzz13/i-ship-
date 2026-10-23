CREATE TABLE shipments (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tracking_number       TEXT NOT NULL UNIQUE CHECK (tracking_number ~ '^ISH-[0-9]{8}-[0-9]{6}$'),
    customer_id           BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sender_address_id     BIGINT NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
    recipient_address_id  BIGINT NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
    service_type          TEXT NOT NULL CHECK (service_type IN ('STANDARD','EXPRESS','SAME_DAY','NEXT_DAY')),
    current_status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (current_status IN
                            ('PENDING','CONFIRMED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY',
                             'DELIVERED','FAILED_DELIVERY','RETURNED','CANCELLED')),
    total_weight          NUMERIC(10,2) NOT NULL CHECK (total_weight > 0),
    total_quantity        INTEGER NOT NULL CHECK (total_quantity > 0),
    declared_value        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (declared_value >= 0),
    shipping_fee          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    payment_status        TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PARTIALLY_PAID','PAID','REFUNDED')),
    special_instructions  TEXT,
    cancellation_reason   TEXT,
    scheduled_pickup_at   TIMESTAMPTZ,
    estimated_delivery_at TIMESTAMPTZ,
    actual_delivery_at    TIMESTAMPTZ,
    created_by            BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shipments_distinct_addresses CHECK (sender_address_id <> recipient_address_id),
    CONSTRAINT shipments_delivered_at CHECK ((current_status = 'DELIVERED') = (actual_delivery_at IS NOT NULL))
);
CREATE INDEX shipments_customer_id_idx ON shipments(customer_id, created_at DESC);
CREATE INDEX shipments_status_created_idx ON shipments(current_status, created_at DESC);
CREATE INDEX shipments_created_at_idx ON shipments(created_at DESC);
CREATE INDEX shipments_sender_address_idx ON shipments(sender_address_id);
CREATE INDEX shipments_recipient_address_idx ON shipments(recipient_address_id);
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE shipment_items (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id    BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    description    TEXT NOT NULL CHECK (length(trim(description)) > 0),
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg      NUMERIC(10,2) NOT NULL CHECK (weight_kg > 0),
    length_cm      NUMERIC(8,2) CHECK (length_cm > 0),
    width_cm       NUMERIC(8,2) CHECK (width_cm > 0),
    height_cm      NUMERIC(8,2) CHECK (height_cm > 0),
    declared_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (declared_value >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shipment_items_shipment_id_idx ON shipment_items(shipment_id);

-- Every status change is recorded here; rows are never updated or deleted.
CREATE TABLE shipment_status_history (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    from_status TEXT,
    to_status   TEXT NOT NULL,
    notes       TEXT,
    location    TEXT,
    changed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shipment_status_history_shipment_idx ON shipment_status_history(shipment_id, created_at);
CREATE TRIGGER shipment_status_history_append_only BEFORE UPDATE OR DELETE ON shipment_status_history
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- Per-day counters backing ISH-YYYYMMDD-NNNNNN tracking numbers.
CREATE TABLE tracking_sequences (
    day        DATE PRIMARY KEY,
    last_value INTEGER NOT NULL CHECK (last_value BETWEEN 0 AND 999999)
);
