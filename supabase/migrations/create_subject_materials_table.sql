-- Create subject_materials table
CREATE TABLE IF NOT EXISTS subject_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- OneDrive metadata
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_extension TEXT,
  file_size BIGINT,
  mime_type TEXT,
  onedrive_id TEXT NOT NULL,
  onedrive_web_url TEXT NOT NULL,
  onedrive_download_url TEXT,
  parent_path TEXT,
  
  -- Additional metadata
  description TEXT,
  category TEXT,
  tags TEXT[],
  
  -- Public sharing
  is_public BOOLEAN DEFAULT FALSE,
  public_slug TEXT DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_modified_onedrive TIMESTAMP WITH TIME ZONE
);

-- Add unique constraint for public_slug within study scope (since subjects belong to studies)
CREATE UNIQUE INDEX subject_materials_public_slug_study_unique 
ON subject_materials (study_id, public_slug) 
WHERE public_slug IS NOT NULL;

-- Add index for efficient subject material lookups
CREATE INDEX subject_materials_subject_lookup 
ON subject_materials (subject_id);

-- Add index for efficient public material lookups
CREATE INDEX subject_materials_public_lookup 
ON subject_materials (study_id, public_slug) 
WHERE is_public = TRUE AND public_slug IS NOT NULL;

-- Row Level Security (RLS) policies
ALTER TABLE subject_materials ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own subject materials
CREATE POLICY "Users can view own subject materials" ON subject_materials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subject materials" ON subject_materials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subject materials" ON subject_materials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subject materials" ON subject_materials
  FOR DELETE USING (auth.uid() = user_id);

-- Public access policy for published materials
CREATE POLICY "Public access to published subject materials" ON subject_materials
  FOR SELECT USING (is_public = true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subject_materials_updated_at 
BEFORE UPDATE ON subject_materials 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();