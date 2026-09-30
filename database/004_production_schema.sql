-- PRECIS Foundry Management System
-- Production records schema.
-- Safe to run more than once: creates missing objects and does not delete records.

CREATE TABLE IF NOT EXISTS production_entries (
    id BIGSERIAL PRIMARY KEY,

    employee_id INTEGER NOT NULL
        REFERENCES employees(id)
        ON DELETE RESTRICT,

    location_id INTEGER NOT NULL
        REFERENCES locations(id)
        ON DELETE RESTRICT,

    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(30) NOT NULL DEFAULT 'General',
    product_name VARCHAR(200) NOT NULL,

    target_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (target_quantity >= 0),

    actual_quantity NUMERIC(12, 2) NOT NULL
        CHECK (actual_quantity >= 0),

    accepted_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (accepted_quantity >= 0),

    rejected_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (rejected_quantity >= 0),

    hours_worked NUMERIC(8, 2) NOT NULL DEFAULT 0
        CHECK (hours_worked >= 0),

    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_accepted_rejected_check
        CHECK (accepted_quantity + rejected_quantity <= actual_quantity)
);

CREATE INDEX IF NOT EXISTS idx_production_employee_date
    ON production_entries(employee_id, production_date);

CREATE INDEX IF NOT EXISTS idx_production_location_date
    ON production_entries(location_id, production_date);

CREATE INDEX IF NOT EXISTS idx_production_date
    ON production_entries(production_date);
