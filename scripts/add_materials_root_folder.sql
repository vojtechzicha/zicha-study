-- Add materials_root_folder field to studies table
ALTER TABLE studies ADD COLUMN materials_root_folder_id TEXT;
ALTER TABLE studies ADD COLUMN materials_root_folder_name TEXT DEFAULT 'OneDrive';
ALTER TABLE studies ADD COLUMN materials_root_folder_path TEXT DEFAULT '/drive/root:';

-- Add comment to explain the fields
COMMENT ON COLUMN studies.materials_root_folder_id IS 'OneDrive folder ID for storing materials';
COMMENT ON COLUMN studies.materials_root_folder_name IS 'Display name of the materials root folder';
COMMENT ON COLUMN studies.materials_root_folder_path IS 'Graph API path for the materials root folder';