-- Create a many-to-many relationship table for study notes and final exams
CREATE TABLE IF NOT EXISTS study_note_final_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_note_id UUID NOT NULL REFERENCES study_notes(id) ON DELETE CASCADE,
    final_exam_id UUID NOT NULL REFERENCES final_exams(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE, -- Indicates if this is the primary final exam (original)
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    linked_by UUID REFERENCES auth.users(id),
    
    -- Ensure a note can only be linked to a final exam once
    UNIQUE(study_note_id, final_exam_id)
);

-- Create indexes for performance
CREATE INDEX idx_study_note_final_exams_note_id ON study_note_final_exams(study_note_id);
CREATE INDEX idx_study_note_final_exams_exam_id ON study_note_final_exams(final_exam_id);

-- Enable RLS
ALTER TABLE study_note_final_exams ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can view links for their own notes
CREATE POLICY "Users can view their own study note final exam links" ON study_note_final_exams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM study_notes 
            WHERE study_notes.id = study_note_final_exams.study_note_id 
            AND study_notes.user_id = auth.uid()
        )
    );

-- Users can create links for their own notes to their own final exams
CREATE POLICY "Users can create study note final exam links" ON study_note_final_exams
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM study_notes 
            WHERE study_notes.id = study_note_final_exams.study_note_id 
            AND study_notes.user_id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM final_exams 
            WHERE final_exams.id = study_note_final_exams.final_exam_id 
            AND final_exams.study_id IN (
                SELECT id FROM studies WHERE user_id = auth.uid()
            )
        )
    );

-- Users can delete links for their own notes
CREATE POLICY "Users can delete study note final exam links" ON study_note_final_exams
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM study_notes 
            WHERE study_notes.id = study_note_final_exams.study_note_id 
            AND study_notes.user_id = auth.uid()
        )
    );

-- Add policy for public viewing
CREATE POLICY "Anyone can view public study note final exam links" ON study_note_final_exams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM study_notes sn
            INNER JOIN final_exams fe ON fe.id = study_note_final_exams.final_exam_id
            INNER JOIN studies s ON s.id = fe.study_id
            WHERE sn.id = study_note_final_exams.study_note_id 
            AND sn.is_public = true
            AND s.is_public = true
        )
    );

-- Add a function to get all study notes for a final exam (including linked ones)
CREATE OR REPLACE FUNCTION get_final_exam_study_notes(p_final_exam_id UUID)
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
        snfe.is_primary,
        snfe.linked_at
    FROM study_notes sn
    INNER JOIN study_note_final_exams snfe ON sn.id = snfe.study_note_id
    WHERE snfe.final_exam_id = p_final_exam_id
    ORDER BY snfe.is_primary DESC, sn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to get all linked items (subjects and final exams) for a study note
CREATE OR REPLACE FUNCTION get_study_note_linked_items(p_study_note_id UUID)
RETURNS TABLE (
    item_type TEXT,
    item_id UUID,
    item_name TEXT,
    item_shortcut TEXT,
    is_primary BOOLEAN,
    linked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    -- Get linked subjects
    SELECT 
        'subject'::TEXT as item_type,
        s.id as item_id,
        s.name as item_name,
        s.shortcut as item_shortcut,
        sns.is_primary,
        sns.linked_at
    FROM subjects s
    INNER JOIN study_note_subjects sns ON s.id = sns.subject_id
    WHERE sns.study_note_id = p_study_note_id
    
    UNION ALL
    
    -- Get linked final exams
    SELECT 
        'final_exam'::TEXT as item_type,
        fe.id as item_id,
        fe.name as item_name,
        fe.shortcut as item_shortcut,
        snfe.is_primary,
        snfe.linked_at
    FROM final_exams fe
    INNER JOIN study_note_final_exams snfe ON fe.id = snfe.final_exam_id
    WHERE snfe.study_note_id = p_study_note_id
    
    ORDER BY is_primary DESC, linked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;