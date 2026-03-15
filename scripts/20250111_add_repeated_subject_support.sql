-- Add support for repeated subjects

-- Add columns to track repeated subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_repeat BOOLEAN DEFAULT FALSE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS repeats_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_subjects_repeats_subject_id ON subjects(repeats_subject_id);

-- Add constraint to ensure repeated subjects are marked correctly
-- Allow null values for is_repeat (existing subjects will have null)
ALTER TABLE subjects ADD CONSTRAINT subjects_repeat_check 
    CHECK (
        (is_repeat IS NULL AND repeats_subject_id IS NULL) OR
        (is_repeat = true AND repeats_subject_id IS NOT NULL) OR 
        (is_repeat = false AND repeats_subject_id IS NULL)
    );

-- This policy is not needed as existing policies already cover access through study ownership