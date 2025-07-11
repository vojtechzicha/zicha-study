-- Add public fields to materials table
ALTER TABLE materials 
ADD COLUMN is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN public_slug TEXT DEFAULT NULL;

-- Add unique constraint for public_slug within study scope
CREATE UNIQUE INDEX materials_public_slug_study_unique 
ON materials (study_id, public_slug) 
WHERE public_slug IS NOT NULL;

-- Add index for efficient public material lookups
CREATE INDEX materials_public_lookup 
ON materials (study_id, public_slug) 
WHERE is_public = TRUE AND public_slug IS NOT NULL;