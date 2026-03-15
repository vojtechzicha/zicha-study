-- Drop existing functions first
DROP FUNCTION IF EXISTS link_study_note_to_subject(UUID, UUID);
DROP FUNCTION IF EXISTS get_available_subjects_for_note(UUID);

-- Function to link a study note to additional subjects (enforces same study constraint)
CREATE OR REPLACE FUNCTION link_study_note_to_subject(
    p_study_note_id UUID,
    p_subject_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_can_link BOOLEAN;
    v_primary_study_id UUID;
    v_target_study_id UUID;
BEGIN
    -- Get the current user
    v_user_id := auth.uid();
    
    -- Get the study_id of the primary subject for this note
    SELECT s.study_id INTO v_primary_study_id
    FROM study_note_subjects sns
    INNER JOIN subjects s ON sns.subject_id = s.id
    WHERE sns.study_note_id = p_study_note_id 
    AND sns.is_primary = TRUE;
    
    -- Get the study_id of the target subject
    SELECT study_id INTO v_target_study_id
    FROM subjects
    WHERE id = p_subject_id;
    
    -- Check if both subjects are from the same study
    IF v_primary_study_id IS NULL OR v_target_study_id IS NULL OR v_primary_study_id != v_target_study_id THEN
        RAISE EXCEPTION 'Study notes can only be linked to subjects within the same study';
    END IF;
    
    -- Check if user owns the study note and the target subject
    SELECT EXISTS (
        SELECT 1 
        FROM study_notes sn
        WHERE sn.id = p_study_note_id 
        AND sn.user_id = v_user_id
    ) AND EXISTS (
        SELECT 1 
        FROM subjects s
        INNER JOIN studies st ON s.study_id = st.id
        WHERE s.id = p_subject_id 
        AND st.user_id = v_user_id
    ) INTO v_can_link;
    
    IF NOT v_can_link THEN
        RAISE EXCEPTION 'Unauthorized to link this study note to this subject';
    END IF;
    
    -- Insert the link (will fail if already exists due to unique constraint)
    INSERT INTO study_note_subjects (study_note_id, subject_id, is_primary, linked_by)
    VALUES (p_study_note_id, p_subject_id, FALSE, v_user_id)
    ON CONFLICT (study_note_id, subject_id) DO NOTHING;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available subjects for linking (only from the same study)
CREATE OR REPLACE FUNCTION get_available_subjects_for_note(
    p_study_note_id UUID
) RETURNS TABLE (
    id UUID,
    name TEXT,
    study_id UUID,
    study_name TEXT,
    semester INTEGER
) AS $$
DECLARE
    v_primary_study_id UUID;
BEGIN
    -- Get the study_id of the primary subject for this note
    SELECT s.study_id INTO v_primary_study_id
    FROM study_note_subjects sns
    INNER JOIN subjects s ON sns.subject_id = s.id
    WHERE sns.study_note_id = p_study_note_id 
    AND sns.is_primary = TRUE;
    
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.study_id,
        st.name as study_name,
        s.semester
    FROM subjects s
    INNER JOIN studies st ON s.study_id = st.id
    WHERE st.user_id = auth.uid()
    AND s.study_id = v_primary_study_id  -- Only subjects from the same study
    AND s.id NOT IN (
        SELECT subject_id 
        FROM study_note_subjects 
        WHERE study_note_id = p_study_note_id
    )
    ORDER BY s.semester, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;