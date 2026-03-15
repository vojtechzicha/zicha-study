-- Create a many-to-many relationship table for study notes and subjects
CREATE TABLE IF NOT EXISTS study_note_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_note_id UUID NOT NULL REFERENCES study_notes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE, -- Indicates if this is the primary subject (original)
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    linked_by UUID REFERENCES auth.users(id),
    
    -- Ensure a note can only be linked to a subject once
    UNIQUE(study_note_id, subject_id)
);

-- Create indexes for performance
CREATE INDEX idx_study_note_subjects_note_id ON study_note_subjects(study_note_id);
CREATE INDEX idx_study_note_subjects_subject_id ON study_note_subjects(subject_id);

-- Enable RLS
ALTER TABLE study_note_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can view links for their own notes
CREATE POLICY "Users can view their own study note links" ON study_note_subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM study_notes 
            WHERE study_notes.id = study_note_subjects.study_note_id 
            AND study_notes.user_id = auth.uid()
        )
    );

-- Users can create links for their own notes to their own subjects
CREATE POLICY "Users can create study note links" ON study_note_subjects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM study_notes 
            WHERE study_notes.id = study_note_subjects.study_note_id 
            AND study_notes.user_id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM subjects 
            WHERE subjects.id = study_note_subjects.subject_id 
            AND subjects.study_id IN (
                SELECT id FROM studies WHERE user_id = auth.uid()
            )
        )
    );

-- Users can delete links for their own notes
CREATE POLICY "Users can delete study note links" ON study_note_subjects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM study_notes 
            WHERE study_notes.id = study_note_subjects.study_note_id 
            AND study_notes.user_id = auth.uid()
        )
    );

-- Migrate existing data: Create primary links for existing subject_id in study_notes
INSERT INTO study_note_subjects (study_note_id, subject_id, is_primary, linked_by)
SELECT id, subject_id, TRUE, user_id
FROM study_notes
WHERE subject_id IS NOT NULL
ON CONFLICT (study_note_id, subject_id) DO NOTHING;

-- Add a function to get all study notes for a subject (including linked ones)
CREATE OR REPLACE FUNCTION get_subject_study_notes(p_subject_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    file_name TEXT,
    onedrive_id TEXT,
    is_public BOOLEAN,
    public_slug TEXT,
    is_primary BOOLEAN,
    linked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sn.id,
        sn.name,
        sn.description,
        sn.file_name,
        sn.onedrive_id,
        sn.is_public,
        sn.public_slug,
        sns.is_primary,
        sns.linked_at
    FROM study_notes sn
    INNER JOIN study_note_subjects sns ON sn.id = sns.study_note_id
    WHERE sns.subject_id = p_subject_id
    ORDER BY sns.is_primary DESC, sn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;