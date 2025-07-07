-- Create study_notes table
CREATE TABLE IF NOT EXISTS study_notes (
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
  
  -- Public sharing (published by default)
  is_public BOOLEAN DEFAULT TRUE,
  public_slug TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_modified_onedrive TIMESTAMP WITH TIME ZONE
);

-- Add unique constraint for public_slug (globally unique for study notes)
CREATE UNIQUE INDEX study_notes_public_slug_unique 
ON study_notes (public_slug);

-- Add index for efficient subject note lookups
CREATE INDEX study_notes_subject_lookup 
ON study_notes (subject_id);

-- Add index for efficient public note lookups
CREATE INDEX study_notes_public_lookup 
ON study_notes (public_slug) 
WHERE is_public = TRUE;

-- Row Level Security (RLS) policies
ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own study notes
CREATE POLICY "Users can view own study notes" ON study_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study notes" ON study_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study notes" ON study_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study notes" ON study_notes
  FOR DELETE USING (auth.uid() = user_id);

-- Public access policy for published notes
CREATE POLICY "Public access to published study notes" ON study_notes
  FOR SELECT USING (is_public = true);

-- Add updated_at trigger
CREATE TRIGGER update_study_notes_updated_at 
BEFORE UPDATE ON study_notes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();