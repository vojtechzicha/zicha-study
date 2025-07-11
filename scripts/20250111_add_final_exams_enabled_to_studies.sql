-- Add final_exams_enabled field to studies table
ALTER TABLE studies ADD COLUMN IF NOT EXISTS final_exams_enabled BOOLEAN DEFAULT FALSE;

-- Add comment explaining the field
COMMENT ON COLUMN studies.final_exams_enabled IS 'Whether to show the final state exams (Státní závěrečná zkouška) section for this study';