-- Create table for final state exams (Státní závěrečná zkouška)
CREATE TABLE IF NOT EXISTS final_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  name TEXT NOT NULL,
  grade TEXT,
  exam_date DATE,
  examiner TEXT,
  examination_committee_head TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE final_exams ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own final exams"
  ON final_exams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies
      WHERE studies.id = final_exams.study_id
      AND studies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own final exams"
  ON final_exams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies
      WHERE studies.id = final_exams.study_id
      AND studies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own final exams"
  ON final_exams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM studies
      WHERE studies.id = final_exams.study_id
      AND studies.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own final exams"
  ON final_exams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM studies
      WHERE studies.id = final_exams.study_id
      AND studies.user_id = auth.uid()
    )
  );

-- Policy for public viewing
CREATE POLICY "Anyone can view public final exams"
  ON final_exams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies
      WHERE studies.id = final_exams.study_id
      AND studies.is_public = true
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_final_exams_study_id ON final_exams(study_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_final_exams_updated_at
  BEFORE UPDATE ON final_exams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the table
COMMENT ON TABLE final_exams IS 'Stores final state exam subjects (Státní závěrečná zkouška) for a study program';