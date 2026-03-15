-- Drop the incorrectly added policy if it exists
DROP POLICY IF EXISTS "Users can view subjects that repeat their subjects" ON subjects;

-- The existing policies already handle access control properly through study ownership