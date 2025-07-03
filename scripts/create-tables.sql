-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create studies table
CREATE TABLE IF NOT EXISTS studies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    study_id UUID REFERENCES studies(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    name TEXT NOT NULL,
    completion_type TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    exam_completed BOOLEAN DEFAULT FALSE,
    credit_completed BOOLEAN DEFAULT FALSE,
    exam_date DATE,
    credit_date DATE,
    final_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on tables
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Create policies for studies table
CREATE POLICY "Users can view their own studies" ON studies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own studies" ON studies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own studies" ON studies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own studies" ON studies
    FOR DELETE USING (auth.uid() = user_id);

-- Create policies for subjects table
CREATE POLICY "Users can view subjects of their studies" ON subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM studies 
            WHERE studies.id = subjects.study_id 
            AND studies.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert subjects to their studies" ON subjects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM studies 
            WHERE studies.id = subjects.study_id 
            AND studies.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update subjects of their studies" ON subjects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM studies 
            WHERE studies.id = subjects.study_id 
            AND studies.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete subjects of their studies" ON subjects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM studies 
            WHERE studies.id = subjects.study_id 
            AND studies.user_id = auth.uid()
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_studies_user_id ON studies(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_study_id ON subjects(study_id);
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester);

-- Create function to automatically set user_id
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set user_id on studies insert
CREATE TRIGGER set_studies_user_id
    BEFORE INSERT ON studies
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at timestamp
CREATE TRIGGER update_studies_updated_at
    BEFORE UPDATE ON studies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
