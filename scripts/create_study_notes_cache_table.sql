-- Create study notes cache table
CREATE TABLE IF NOT EXISTS study_notes_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  study_note_id UUID NOT NULL REFERENCES study_notes(id) ON DELETE CASCADE,
  html_content TEXT NOT NULL,
  title TEXT,
  onedrive_last_modified TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  cache_key TEXT NOT NULL,
  has_media BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(study_note_id)
);

-- Create index on study_note_id for faster lookups
CREATE INDEX idx_study_notes_cache_study_note_id ON study_notes_cache(study_note_id);

-- Create table for cached media files
CREATE TABLE IF NOT EXISTS study_notes_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_id UUID NOT NULL REFERENCES study_notes_cache(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(cache_id, file_path)
);

-- Create index for media lookups
CREATE INDEX idx_study_notes_media_cache_id ON study_notes_media(cache_id);

-- RLS policies for cache table (inherit from study_notes permissions)
ALTER TABLE study_notes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Study notes cache follows study notes access" ON study_notes_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_notes
      WHERE study_notes.id = study_notes_cache.study_note_id
      AND (
        study_notes.is_public = true
        OR study_notes.user_id = auth.uid()
      )
    )
  );

-- RLS policies for media table (inherit from cache permissions)
ALTER TABLE study_notes_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Study notes media follows cache access" ON study_notes_media
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_notes_cache
      JOIN study_notes ON study_notes.id = study_notes_cache.study_note_id
      WHERE study_notes_cache.id = study_notes_media.cache_id
      AND (
        study_notes.is_public = true
        OR study_notes.user_id = auth.uid()
      )
    )
  );

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_study_notes_cache_updated_at
  BEFORE UPDATE ON study_notes_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();