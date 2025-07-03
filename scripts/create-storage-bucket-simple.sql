-- Create storage bucket for study logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-logos', 'study-logos', true)
ON CONFLICT (id) DO NOTHING;