-- Add public share URL columns to both materials tables
ALTER TABLE materials 
ADD COLUMN public_share_url TEXT DEFAULT NULL;

ALTER TABLE subject_materials 
ADD COLUMN public_share_url TEXT DEFAULT NULL;