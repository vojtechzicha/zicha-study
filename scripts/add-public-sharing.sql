-- Add public sharing columns to studies table
ALTER TABLE studies 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS public_description TEXT;

-- Create index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_studies_public_slug ON studies(public_slug) WHERE public_slug IS NOT NULL;

-- Create storage bucket for study logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-logos', 'study-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the storage bucket
CREATE POLICY IF NOT EXISTS "Users can upload their own study logos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'study-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can update their own study logos" ON storage.objects
FOR UPDATE USING (bucket_id = 'study-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Users can delete their own study logos" ON storage.objects
FOR DELETE USING (bucket_id = 'study-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Study logos are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'study-logos');
