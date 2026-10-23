CREATE TABLE roles (
    id          SMALLINT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE CHECK (name IN ('ADMIN','DISPATCHER','STAFF','DRIVER','CUSTOMER')),
    description TEXT NOT NULL DEFAULT ''
);

INSERT INTO roles (id, name, description) VALUES
    (1, 'ADMIN',      'Full access to every feature'),
    (2, 'DISPATCHER', 'Manages shipments, fleet, assignments and deliveries'),
    (3, 'STAFF',      'Manages customers, shipments and tracking'),
    (4, 'DRIVER',     'Handles own assignments and deliveries'),
    (5, 'CUSTOMER',   'Views own shipments and tracking');

CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
    phone         TEXT,
    role_id       SMALLINT NOT NULL REFERENCES roles(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_key UNIQUE (email)
);
CREATE INDEX users_role_id_idx ON users(role_id);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Opaque refresh tokens, stored as SHA-256 hashes. Tokens rotate on use; all
-- tokens descending from one login share a family_id so reuse of a rotated
-- token can revoke the whole family.
CREATE TABLE refresh_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  BYTEA NOT NULL UNIQUE,
    family_id   UUID NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    replaced_by BIGINT REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    user_agent  TEXT,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens(family_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);
