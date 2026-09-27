ALTER TABLE employees
ADD COLUMN IF NOT EXISTS face_embedding JSONB;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS face_registered_at TIMESTAMPTZ;

ALTER TABLE attendance_events
ADD COLUMN IF NOT EXISTS face_similarity DECIMAL(8, 6);

