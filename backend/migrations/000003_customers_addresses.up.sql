CREATE TABLE customers (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_code TEXT NOT NULL UNIQUE,
    user_id       BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    customer_type TEXT NOT NULL DEFAULT 'INDIVIDUAL' CHECK (customer_type IN ('INDIVIDUAL','BUSINESS')),
    full_name     TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
    company_name  TEXT,
    email         TEXT CHECK (email IS NULL OR email = lower(email)),
    phone         TEXT NOT NULL CHECK (length(trim(phone)) > 0),
    notes         TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customers_business_company CHECK (customer_type <> 'BUSINESS' OR company_name IS NOT NULL)
);
CREATE INDEX customers_full_name_idx ON customers(lower(full_name));
CREATE INDEX customers_email_idx ON customers(email);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A customer's address book. Shipments reference addresses for both sender
-- and recipient, so referenced addresses are archived instead of deleted.
CREATE TABLE addresses (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id   BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    label         TEXT NOT NULL DEFAULT 'Home',
    contact_name  TEXT NOT NULL CHECK (length(trim(contact_name)) > 0),
    contact_phone TEXT NOT NULL CHECK (length(trim(contact_phone)) > 0),
    line1         TEXT NOT NULL CHECK (length(trim(line1)) > 0),
    line2         TEXT,
    barangay      TEXT,
    city          TEXT NOT NULL CHECK (length(trim(city)) > 0),
    province      TEXT NOT NULL CHECK (length(trim(province)) > 0),
    postal_code   TEXT,
    country       TEXT NOT NULL DEFAULT 'PH' CHECK (length(country) = 2),
    latitude      NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude     NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX addresses_customer_id_idx ON addresses(customer_id);
CREATE UNIQUE INDEX addresses_one_default_per_customer ON addresses(customer_id) WHERE is_default AND archived_at IS NULL;
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE SEQUENCE customer_code_seq START 1001;
