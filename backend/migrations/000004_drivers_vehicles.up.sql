CREATE TABLE drivers (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    employee_code           TEXT NOT NULL UNIQUE CHECK (length(trim(employee_code)) > 0),
    license_number          TEXT NOT NULL UNIQUE CHECK (length(trim(license_number)) > 0),
    license_expiry          DATE NOT NULL,
    phone                   TEXT NOT NULL,
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    status                  TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ON_LEAVE','SUSPENDED')),
    availability            TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability IN ('AVAILABLE','ON_DELIVERY','OFF_DUTY')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX drivers_status_idx ON drivers(status, availability);
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE vehicles (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plate_number       TEXT NOT NULL UNIQUE CHECK (plate_number = upper(plate_number) AND length(trim(plate_number)) > 0),
    vehicle_type       TEXT NOT NULL CHECK (vehicle_type IN ('MOTORCYCLE','CAR','VAN','TRUCK')),
    brand              TEXT NOT NULL,
    model              TEXT NOT NULL,
    year               SMALLINT CHECK (year BETWEEN 1980 AND 2100),
    weight_capacity_kg NUMERIC(10,2) NOT NULL CHECK (weight_capacity_kg > 0),
    status             TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','IN_USE','MAINTENANCE','RETIRED')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_status_idx ON vehicles(status);
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
