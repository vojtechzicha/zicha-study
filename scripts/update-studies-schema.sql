-- Add logo_url column to studies table if it doesn't exist
ALTER TABLE studies 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Update existing studies to have default values for new columns
UPDATE studies 
SET is_public = FALSE 
WHERE is_public IS NULL;

-- Add constraints
ALTER TABLE studies 
ADD CONSTRAINT check_public_slug_format 
CHECK (public_slug IS NULL OR (public_slug ~ '^[a-z0-9_-]{3,50}$'));
