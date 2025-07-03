-- Add logo column to studies table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'studies' AND column_name = 'logo_url') THEN
        ALTER TABLE studies ADD COLUMN logo_url TEXT;
    END IF;
END $$;

-- Create a function to handle logo uploads (this would be used with Supabase Storage)
-- The logo_url will store the path to the uploaded image in Supabase Storage
