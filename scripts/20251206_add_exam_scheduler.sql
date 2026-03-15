-- Add exam scheduler configuration to studies table
ALTER TABLE studies ADD COLUMN IF NOT EXISTS exam_scheduler_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE studies ADD COLUMN IF NOT EXISTS transit_duration_hours DECIMAL(3,1) DEFAULT 4.0;
ALTER TABLE studies ADD COLUMN IF NOT EXISTS transit_cost_one_way INTEGER DEFAULT 200;
ALTER TABLE studies ADD COLUMN IF NOT EXISTS accommodation_cost_per_night INTEGER DEFAULT 2000;

COMMENT ON COLUMN studies.exam_scheduler_enabled IS 'Whether to enable the exam scheduling feature for this study';
COMMENT ON COLUMN studies.transit_duration_hours IS 'Hours needed to travel to university (one way)';
COMMENT ON COLUMN studies.transit_cost_one_way IS 'Cost of one-way travel in CZK';
COMMENT ON COLUMN studies.accommodation_cost_per_night IS 'Cost of overnight accommodation near university in CZK';

-- Create exam_options table for multiple exam dates per subject
CREATE TABLE IF NOT EXISTS exam_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  is_online BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exam_options ENABLE ROW LEVEL SECURITY;

-- Create policies for exam_options (same pattern as subjects)
CREATE POLICY "Users can view exam options of their subjects"
  ON exam_options FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN studies st ON st.id = s.study_id
      WHERE s.id = exam_options.subject_id
      AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert exam options for their subjects"
  ON exam_options FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN studies st ON st.id = s.study_id
      WHERE s.id = exam_options.subject_id
      AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update exam options of their subjects"
  ON exam_options FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN studies st ON st.id = s.study_id
      WHERE s.id = exam_options.subject_id
      AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete exam options of their subjects"
  ON exam_options FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN studies st ON st.id = s.study_id
      WHERE s.id = exam_options.subject_id
      AND st.user_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exam_options_subject_id ON exam_options(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_options_date ON exam_options(date);

-- Trigger for updated_at (reuse existing function if available)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_exam_options_updated_at ON exam_options;
CREATE TRIGGER update_exam_options_updated_at
  BEFORE UPDATE ON exam_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
