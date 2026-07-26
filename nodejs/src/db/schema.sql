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
