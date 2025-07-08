-- Drop the global unique constraint on public_slug
DROP INDEX IF EXISTS study_notes_public_slug_unique;

-- Add a unique constraint that ensures public_slug is unique within each study
CREATE UNIQUE INDEX study_notes_study_slug_unique 
ON study_notes (study_id, public_slug);

-- Update the index for public note lookups to include study_id
DROP INDEX IF EXISTS study_notes_public_lookup;
CREATE INDEX study_notes_public_lookup 
ON study_notes (study_id, public_slug) 
WHERE is_public = TRUE;

-- Add comment explaining the constraint
COMMENT ON INDEX study_notes_study_slug_unique IS 'Ensures public_slug is unique within each study';