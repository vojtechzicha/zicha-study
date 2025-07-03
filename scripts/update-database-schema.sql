-- Add new columns to studies table
ALTER TABLE studies ADD COLUMN IF NOT EXISTS form TEXT;

-- Update existing studies to have a default form
UPDATE studies SET form = 'prezenční' WHERE form IS NULL;

-- Make form column required
ALTER TABLE studies ALTER COLUMN form SET NOT NULL;

-- Update status check constraint to include 'abandoned'
ALTER TABLE studies DROP CONSTRAINT IF EXISTS studies_status_check;
ALTER TABLE studies ADD CONSTRAINT studies_status_check 
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned'));

-- Add new columns to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_type TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS hours INTEGER;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS lecturer TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department TEXT;

-- Make points column nullable (it already should be, but ensuring it)
ALTER TABLE subjects ALTER COLUMN points DROP NOT NULL;

-- Remove the separate date columns that are no longer needed
ALTER TABLE subjects DROP COLUMN IF EXISTS exam_date;
ALTER TABLE subjects DROP COLUMN IF EXISTS credit_date;

-- Update existing subjects to have default subject_type
UPDATE subjects SET subject_type = 'Povinný' WHERE subject_type IS NULL;

-- Make subject_type column required
ALTER TABLE subjects ALTER COLUMN subject_type SET NOT NULL;

-- Add check constraint for subject_type
ALTER TABLE subjects ADD CONSTRAINT subjects_subject_type_check 
    CHECK (subject_type IN ('Povinný', 'Povinně volitelný', 'Volitelný', 'Ostatní'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_studies_form ON studies(form);
CREATE INDEX IF NOT EXISTS idx_subjects_subject_type ON subjects(subject_type);
CREATE INDEX IF NOT EXISTS idx_subjects_lecturer ON subjects(lecturer);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department);
