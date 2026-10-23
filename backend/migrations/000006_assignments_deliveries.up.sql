CREATE TABLE delivery_assignments (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id  BIGINT NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    driver_id    BIGINT NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
    vehicle_id   BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    assigned_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status       TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN
                   ('ASSIGNED','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED')),
    notes        TEXT,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at  TIMESTAMPTZ,
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assignments_timeline CHECK (
        (accepted_at IS NULL OR accepted_at >= assigned_at) AND
        (started_at IS NULL OR accepted_at IS NOT NULL) AND
        (completed_at IS NULL OR started_at IS NOT NULL))
);
-- A shipment may have many historical assignments but only one active one.
CREATE UNIQUE INDEX delivery_assignments_one_active ON delivery_assignments(shipment_id)
    WHERE status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS');
CREATE INDEX delivery_assignments_shipment_idx ON delivery_assignments(shipment_id, assigned_at DESC);
CREATE INDEX delivery_assignments_driver_idx ON delivery_assignments(driver_id, status);
CREATE INDEX delivery_assignments_vehicle_idx ON delivery_assignments(vehicle_id);
CREATE TRIGGER delivery_assignments_updated_at BEFORE UPDATE ON delivery_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every attempt is kept; attempts are never overwritten.
CREATE TABLE delivery_attempts (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id    BIGINT NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    assignment_id  BIGINT NOT NULL REFERENCES delivery_assignments(id) ON DELETE RESTRICT,
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    outcome        TEXT NOT NULL CHECK (outcome IN
                     ('SUCCESSFUL','RECIPIENT_UNAVAILABLE','WRONG_ADDRESS','REFUSED','DAMAGED_PACKAGE','OTHER')),
    notes          TEXT,
    latitude       NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude      NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    attempted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT delivery_attempts_number_key UNIQUE (shipment_id, attempt_number),
    CONSTRAINT delivery_attempts_other_notes CHECK (outcome <> 'OTHER' OR notes IS NOT NULL)
);
CREATE INDEX delivery_attempts_assignment_idx ON delivery_attempts(assignment_id);
CREATE TRIGGER delivery_attempts_append_only BEFORE UPDATE OR DELETE ON delivery_attempts
    FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- Files are referenced by storage key so object storage can replace the
-- local volume without schema changes.
CREATE TABLE proof_of_delivery (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id            BIGINT NOT NULL UNIQUE REFERENCES shipments(id) ON DELETE RESTRICT,
    attempt_id             BIGINT NOT NULL UNIQUE REFERENCES delivery_attempts(id) ON DELETE RESTRICT,
    recipient_name         TEXT NOT NULL CHECK (length(trim(recipient_name)) > 0),
    recipient_relationship TEXT NOT NULL DEFAULT 'SELF',
    signature_key          TEXT,
    photo_key              TEXT,
    notes                  TEXT,
    delivered_at           TIMESTAMPTZ NOT NULL,
    created_by             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pod_has_evidence CHECK (signature_key IS NOT NULL OR photo_key IS NOT NULL)
);
