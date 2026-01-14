-- Add IS page URL field to studies table
-- This allows users to link to their university's Information System (IS) page
ALTER TABLE studies ADD COLUMN IF NOT EXISTS is_url TEXT;
