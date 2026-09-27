-- ============================================
-- FOUNDRY MANAGEMENT SYSTEM
-- ATTENDANCE MODULE - INITIAL SCHEMA
-- ============================================

-- Company locations
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,

    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,

    allowed_radius_meters INTEGER NOT NULL DEFAULT 100,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Employees
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,

    employee_code VARCHAR(50) UNIQUE NOT NULL,

    full_name VARCHAR(150) NOT NULL,

    phone VARCHAR(20),

    face_reference TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Individual attendance events
CREATE TABLE attendance_events (
    id BIGSERIAL PRIMARY KEY,

    employee_id INTEGER NOT NULL
        REFERENCES employees(id)
        ON DELETE RESTRICT,

    event_type VARCHAR(10) NOT NULL
        CHECK (event_type IN ('ENTRY', 'EXIT')),

    location_id INTEGER NOT NULL
        REFERENCES locations(id)
        ON DELETE RESTRICT,

    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    latitude DECIMAL(10, 7) NOT NULL,

    longitude DECIMAL(10, 7) NOT NULL,

    distance_meters DECIMAL(10, 2) NOT NULL,

    face_verified BOOLEAN NOT NULL DEFAULT FALSE,

    device_info TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Indexes for faster reports
CREATE INDEX idx_attendance_employee
    ON attendance_events(employee_id);

CREATE INDEX idx_attendance_event_time
    ON attendance_events(event_time);

CREATE INDEX idx_attendance_location
    ON attendance_events(location_id);


-- ============================================
-- SHIROLI UNIT
-- ============================================

INSERT INTO locations (
    name,
    address,
    latitude,
    longitude,
    allowed_radius_meters
)
VALUES (
    'Shiroli Unit',
    'W-22 MIDC, Shiroli, Kolhapur - 416122',
    16.7636321,
    74.2751925,
    100
);
