-- Create storage bucket for study logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-logos', 'study-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own study logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own study logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own study logos" ON storage.objects;
DROP POLICY IF EXISTS "Study logos are publicly viewable" ON storage.objects;

-- Create RLS policies for the storage bucket
CREATE POLICY "Users can upload their own study logos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'study-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own study logos" ON storage.objects
FOR UPDATE USING (bucket_id = 'study-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own study logos" ON storage.objects
FOR DELETE USING (bucket_id = 'study-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Study logos are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'study-logos');