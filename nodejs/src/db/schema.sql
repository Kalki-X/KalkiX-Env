-- GearShare core schema (Postgres)
-- Applied idempotently on API startup by src/db/migrate.js

CREATE TABLE IF NOT EXISTS users (
    id             BIGSERIAL PRIMARY KEY,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    phone          TEXT,
    password_hash  TEXT NOT NULL,
    -- System-level role. 'platform_user' covers renter/lender/finance sub-types via the
    -- capability flags below; 'public' (unauthenticated/guest) is never stored here.
    role           TEXT NOT NULL DEFAULT 'platform_user'
                   CHECK (role IN ('super_admin', 'admin', 'support', 'finance', 'platform_user')),
    is_renter      BOOLEAN NOT NULL DEFAULT false,
    is_lender      BOOLEAN NOT NULL DEFAULT false,
    status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'suspended', 'deactivated')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
    id             BIGSERIAL PRIMARY KEY,
    owner_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT,
    category       TEXT,
    price_per_day  NUMERIC(10, 2) NOT NULL CHECK (price_per_day >= 0),
    currency       TEXT NOT NULL DEFAULT 'USD',
    status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

CREATE TABLE IF NOT EXISTS bookings (
    id             BIGSERIAL PRIMARY KEY,
    item_id        BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    renter_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    total_amount   NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    currency       TEXT NOT NULL DEFAULT 'USD',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
CREATE INDEX IF NOT EXISTS idx_bookings_renter ON bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS payments (
    id             BIGSERIAL PRIMARY KEY,
    booking_id     BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount         NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency       TEXT NOT NULL DEFAULT 'USD',
    method         TEXT,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    provider_ref   TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- Proforma invoices, invoices, and credit notes all live here, distinguished by `type`.
CREATE TABLE IF NOT EXISTS documents (
    id               BIGSERIAL PRIMARY KEY,
    booking_id       BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type             TEXT NOT NULL
                     CHECK (type IN ('proforma_invoice', 'invoice', 'credit_note')),
    document_number  TEXT NOT NULL UNIQUE,
    amount           NUMERIC(10, 2) NOT NULL,
    currency         TEXT NOT NULL DEFAULT 'USD',
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_booking ON documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- One sequence feeds all human-readable document numbers (PI-000001, INV-000001, CN-000001, ...).
CREATE SEQUENCE IF NOT EXISTS document_number_seq START 1;

-- Append-only audit trail: logins, payments, document generation, and any sensitive action.
CREATE TABLE IF NOT EXISTS audit_log (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action         TEXT NOT NULL,
    entity_type    TEXT,
    entity_id      TEXT,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Forgot-password flow. Only the SHA-256 hash of the token is ever stored — the raw
-- token exists only in the emailed link, exactly like a password. Each row is single-use.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash     TEXT NOT NULL UNIQUE,
    expires_at     TIMESTAMPTZ NOT NULL,
    used_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- Google Sign-In. `auth_provider` is informational (which method created the
-- account); a user can still have a usable local password alongside google_id if
-- they registered normally and later linked Google to the same email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password'
    CHECK (auth_provider IN ('password', 'google'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Every 500 the API returns lands here (see middleware/errorHandler.js), so Super
-- Admin/Support have something concrete to triage instead of just server logs.
CREATE TABLE IF NOT EXISTS error_log (
    id             BIGSERIAL PRIMARY KEY,
    message        TEXT NOT NULL,
    stack          TEXT,
    method         TEXT,
    route          TEXT,
    status_code    INTEGER,
    user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at);

-- Phase 5: pickup location for an item. Address is free text; lat/lng are optional
-- (set when the lender drops a pin on the map) and used together for the renter-facing
-- pickup map.
ALTER TABLE items ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(10, 6);
ALTER TABLE items ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(10, 6);

-- Item photos. Stored as bytea directly in Postgres rather than on disk/object storage
-- — this app has no volume-mounted uploads directory or cloud storage configured, and
-- keeping images in the same durable Postgres volume means they survive container
-- rebuilds with zero extra infra. Upload size is capped at the application layer.
CREATE TABLE IF NOT EXISTS item_images (
    id             BIGSERIAL PRIMARY KEY,
    item_id        BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    mime_type      TEXT NOT NULL,
    data           BYTEA NOT NULL,
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_item_images_item ON item_images(item_id);

-- Lender-defined blackout dates — independent of bookings (e.g. the item is being
-- serviced, or the lender just doesn't want it rented that week). Renters see these
-- merged with existing pending/confirmed bookings as "unavailable" on the calendar.
CREATE TABLE IF NOT EXISTS item_availability_blocks (
    id             BIGSERIAL PRIMARY KEY,
    item_id        BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    reason         TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_item_availability_item ON item_availability_blocks(item_id);
