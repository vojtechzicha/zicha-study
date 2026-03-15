-- Disable RLS on all tables
ALTER TABLE studies DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE subject_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_notes_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_notes_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE final_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_note_subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_note_final_exams DISABLE ROW LEVEL SECURITY;

-- Make user_id nullable (no longer enforced by auth)
ALTER TABLE studies ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE materials ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE subject_materials ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE study_notes ALTER COLUMN user_id DROP NOT NULL;

-- Drop the user_oauth_tokens table (tokens now in NextAuth JWT)
DROP TABLE IF EXISTS user_oauth_tokens;

-- Drop the auto-set trigger (no longer have auth.uid())
DROP TRIGGER IF EXISTS set_studies_user_id_trigger ON studies;
DROP FUNCTION IF EXISTS set_studies_user_id();
