-- Add designation to employees.
-- Existing employees are assigned Worker until an admin updates their designation.
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS designation VARCHAR(100);

UPDATE employees
SET designation = 'Worker'
WHERE designation IS NULL OR BTRIM(designation) = '';

ALTER TABLE employees
ALTER COLUMN designation SET DEFAULT 'Worker';

ALTER TABLE employees
ALTER COLUMN designation SET NOT NULL;


-- Add approval tracking to production entries.
ALTER TABLE production_entries
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20);

-- Preserve existing production history as approved.
UPDATE production_entries
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- New production entries require approval.
ALTER TABLE production_entries
ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE production_entries
ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE production_entries
ADD COLUMN IF NOT EXISTS verified_by BIGINT
    REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE production_entries
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE production_entries
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE production_entries
ADD COLUMN IF NOT EXISTS submitted_by BIGINT
    REFERENCES app_users(id) ON DELETE SET NULL;

-- Add the status constraint only if it does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'production_approval_status_check'
    ) THEN
        ALTER TABLE production_entries
        ADD CONSTRAINT production_approval_status_check
        CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_production_approval_status
ON production_entries(approval_status);

CREATE INDEX IF NOT EXISTS idx_production_submitted_by
ON production_entries(submitted_by);
