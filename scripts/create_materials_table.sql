-- Create materials table for storing OneDrive document references
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified_onedrive TIMESTAMP WITH TIME ZONE,
  
  -- Ensure unique OneDrive files per study
  UNIQUE(study_id, onedrive_id)
);

-- Create indexes for performance
CREATE INDEX idx_materials_study_id ON materials(study_id);
CREATE INDEX idx_materials_user_id ON materials(user_id);
CREATE INDEX idx_materials_created_at ON materials(created_at DESC);
CREATE INDEX idx_materials_name ON materials(name);

-- Enable Row Level Security
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view materials for their own studies
CREATE POLICY "Users can view their own materials" ON materials
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert materials for their own studies
CREATE POLICY "Users can insert their own materials" ON materials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own materials
CREATE POLICY "Users can update their own materials" ON materials
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own materials
CREATE POLICY "Users can delete their own materials" ON materials
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();