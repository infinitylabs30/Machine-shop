-- Authentication accounts for PRECIS Foundry Management System.
-- Existing employee, attendance, and production records are preserved.

CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,

    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'employee')),

    employee_id INTEGER UNIQUE
        REFERENCES employees(id)
        ON DELETE RESTRICT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT app_users_role_employee_check
        CHECK (
            (role = 'admin' AND employee_id IS NULL)
            OR
            (role = 'employee' AND employee_id IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_app_users_employee_id
    ON app_users(employee_id);
