-- Add 'intended' status to studies table
-- Update status check constraint to include 'intended'
ALTER TABLE studies DROP CONSTRAINT IF EXISTS studies_status_check;
ALTER TABLE studies ADD CONSTRAINT studies_status_check 
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned', 'planned', 'intended'));