-- Make subject abbreviation column optional (allow NULL)
-- This allows subjects to be created without an abbreviation

ALTER TABLE subjects 
ALTER COLUMN abbreviation DROP NOT NULL;