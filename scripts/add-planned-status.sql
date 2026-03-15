-- Add 'planned' status to studies table
-- Update status check constraint to include 'planned'
ALTER TABLE studies DROP CONSTRAINT IF EXISTS studies_status_check;
ALTER TABLE studies ADD CONSTRAINT studies_status_check 
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned', 'planned'));

-- Add 'planned' status to subjects table as a new column
-- Since subjects use boolean flags, we'll add a planned boolean column
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS planned BOOLEAN DEFAULT FALSE;

-- Create index for the new planned column
CREATE INDEX IF NOT EXISTS idx_subjects_planned ON subjects(planned);