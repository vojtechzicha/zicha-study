-- Create table to store OAuth tokens for users
CREATE TABLE IF NOT EXISTS user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own tokens
CREATE POLICY "Users can view their own tokens"
  ON user_oauth_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy to allow the service role to manage tokens
CREATE POLICY "Service role can manage all tokens"
  ON user_oauth_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create an index for faster lookups
CREATE INDEX idx_user_oauth_tokens_user_provider 
  ON user_oauth_tokens (user_id, provider);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the table
COMMENT ON TABLE user_oauth_tokens IS 'Stores OAuth access and refresh tokens for external providers like Microsoft';