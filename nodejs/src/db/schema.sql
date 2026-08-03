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

-- Profile picture, stored the same way as item photos (bytea in Postgres — no
-- volume-mounted uploads dir configured). A user has at most one, so this is just two
-- nullable columns on the row rather than a separate table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data BYTEA;

-- Phase 6: booking approval workflow. A renter's request no longer jumps straight to
-- "pending" (implicitly awaiting payment) — it now needs an explicit lender decision
-- first: 'pending_approval' -> 'awaiting_payment' (approved, proforma issued, renter can
-- pay) or 'rejected' (mandatory reason, terminal). 'confirmed'/'cancelled'/'completed'
-- are unchanged. Existing rows from before this migration are 'pending', which doesn't
-- satisfy the new CHECK below — the constraint must be dropped *before* that remap runs,
-- otherwise the UPDATE itself is rejected by the still-active old constraint (which only
-- allowed 'pending'/'confirmed'/'cancelled'/'completed'), aborting this whole script
-- before it ever reaches the items/documents ALTERs further down. Remap after dropping,
-- then add the new constraint back so it validates against the now-conforming data.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
UPDATE bookings SET status = 'awaiting_payment' WHERE status = 'pending';
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending_approval', 'awaiting_payment', 'rejected', 'confirmed', 'cancelled', 'completed'));

-- Optional note the renter can attach to a request (special instructions, etc.), visible
-- to the lender before they approve/reject. Reason is mandatory in the API layer when
-- rejecting, but the column itself stays nullable (only rejected bookings have one).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS renter_note TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- The item's cancellation policy is snapshotted onto the booking at request time (both
-- null if the lender hadn't set one) so a lender editing their policy later never
-- retroactively changes the refund terms of a booking that already exists under the old
-- terms.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_free_days INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_fee_percent NUMERIC(5, 2);

-- Lender-defined cancellation policy on the listing itself. Both optional/nullable —
-- when unset, cancelling a paid booking falls back to the original behavior (a full
-- refund/credit note, no fee), so this is purely additive for existing listings.
ALTER TABLE items ADD COLUMN IF NOT EXISTS cancellation_free_days INTEGER
    CHECK (cancellation_free_days IS NULL OR cancellation_free_days >= 0);
ALTER TABLE items ADD COLUMN IF NOT EXISTS cancellation_fee_percent NUMERIC(5, 2)
    CHECK (cancellation_fee_percent IS NULL OR (cancellation_fee_percent >= 0 AND cancellation_fee_percent <= 100));

-- A voided document (superseded by a credit note when a paid booking is cancelled) stays
-- in the audit trail forever — nothing is ever deleted — but is hidden from the renter's
-- and lender's own document lists; only Admin/Super Admin/Finance (via Document Lookup)
-- can still see it, which is why this is a flag rather than a delete.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- Phase 7: in-app notification center. Every booking lifecycle event that triggers an
-- email (request received, approved, rejected, cancelled, payment confirmed) also
-- creates one of these for the recipient, so it shows up in the bell dropdown /
-- notifications page even before (or instead of) them checking their inbox. `link` is a
-- frontend route path (e.g. /lender/bookings/12) the bell can navigate straight to.
CREATE TABLE IF NOT EXISTS notifications (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type           TEXT NOT NULL,
    title          TEXT NOT NULL,
    body           TEXT,
    link           TEXT,
    entity_type    TEXT,
    entity_id      TEXT,
    read_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Phase 8: admin-editable email templates. `type` is a fixed, known set of predefined
-- emails (see EMAIL_TEMPLATE_TYPES in models/emailTemplateModel.js) rather than
-- free-form user-created templates — every row is seeded with a sensible default below
-- so the admin UI always has something to show/edit, and callers never need "does a
-- custom one exist, else fall back to a hardcoded string" branching: the DB is always
-- the source of truth. `body` holds {{placeholder}} tokens substituted at send time;
-- available placeholders differ per type and are documented in the model, not the DB.
CREATE TABLE IF NOT EXISTS email_templates (
    type          TEXT PRIMARY KEY,
    subject       TEXT NOT NULL,
    body          TEXT NOT NULL,
    updated_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO email_templates (type, subject, body) VALUES
    (
        'password_reset',
        'Reset your GearShare password',
        E'Hi {{firstName}},\n\nWe received a request to reset your GearShare password. This link expires in 1 hour.\n\nIf you didn''t request this, you can safely ignore this email.'
    ),
    (
        'welcome',
        'Welcome to GearShare, {{firstName}}!',
        E'Hi {{firstName}},\n\nThanks for joining GearShare — you''re all set to start renting gear from others or listing your own items for rent.\n\nIf you ever have questions, just reply to this email.'
    ),
    (
        'staff_credentials',
        'Your GearShare staff account is ready',
        E'Hi {{firstName}},\n\nAn account has been created for you on GearShare as {{role}} ({{email}}).\n\nUse the link below to set your password and sign in. This link expires in 1 hour.'
    ),
    (
        'booking_requested',
        'New booking request for "{{itemTitle}}"',
        E'{{renterName}} requested to rent "{{itemTitle}}" from {{startDate}} to {{endDate}} ({{currency}} {{amount}}).\n\n{{noteLine}}Approve or reject this request from your GearShare dashboard.'
    ),
    (
        'booking_approved',
        'Your booking request for "{{itemTitle}}" was approved',
        E'Good news — the lender approved your request for "{{itemTitle}}" ({{startDate}} to {{endDate}}).\n\nA proforma invoice ({{documentNumber}}) for {{currency}} {{amount}} is ready.'
    ),
    (
        'booking_rejected',
        'Your booking request for "{{itemTitle}}" was declined',
        E'The lender declined your request for "{{itemTitle}}" ({{startDate}} to {{endDate}}).\n\nReason: {{reason}}\n\nNo payment was taken and no documents were issued for this request.'
    ),
    (
        'booking_cancelled',
        'Booking for "{{itemTitle}}" was cancelled',
        E'The booking for "{{itemTitle}}" ({{startDate}} to {{endDate}}) was cancelled.\n\n{{creditNoteLine}}'
    )
ON CONFLICT (type) DO NOTHING;
