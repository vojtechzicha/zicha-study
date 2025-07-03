-- Add public sharing fields to studies table
ALTER TABLE studies 
ADD COLUMN slug TEXT UNIQUE,
ADD COLUMN is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN public_description TEXT,
ADD COLUMN last_updated TIMESTAMP DEFAULT NOW();

-- Create index for faster slug lookups
CREATE INDEX idx_studies_slug ON studies(slug) WHERE slug IS NOT NULL;

-- Create function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_studies_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update timestamp
CREATE TRIGGER update_studies_timestamp_trigger
    BEFORE UPDATE ON studies
    FOR EACH ROW
    EXECUTE FUNCTION update_studies_timestamp();
