-- Function to get all study notes for a subject (including linked ones)
CREATE OR REPLACE FUNCTION get_subject_study_notes_with_details(p_subject_id UUID)
RETURNS TABLE (
    id UUID,
    subject_id UUID,
    study_id UUID,
    user_id UUID,
    name TEXT,
    file_name TEXT,
    file_extension TEXT,
    file_size BIGINT,
    mime_type TEXT,
    onedrive_id TEXT,
    onedrive_web_url TEXT,
    onedrive_download_url TEXT,
    parent_path TEXT,
    description TEXT,
    is_public BOOLEAN,
    public_slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_modified_onedrive TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN,
    linked_at TIMESTAMP WITH TIME ZONE,
    linked_subjects JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH note_subjects AS (
        SELECT 
            sn.id as note_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', s.id,
                    'name', s.name,
                    'study_id', s.study_id,
                    'is_primary', sns.is_primary
                )
                ORDER BY sns.is_primary DESC, s.name
            ) as linked_subjects
        FROM study_notes sn
        INNER JOIN study_note_subjects sns ON sn.id = sns.study_note_id
        INNER JOIN subjects s ON sns.subject_id = s.id
        GROUP BY sn.id
    )
    SELECT 
        sn.*,
        sns.is_primary,
        sns.linked_at,
        COALESCE(ns.linked_subjects, '[]'::jsonb) as linked_subjects
    FROM study_notes sn
    INNER JOIN study_note_subjects sns ON sn.id = sns.study_note_id
    LEFT JOIN note_subjects ns ON sn.id = ns.note_id
    WHERE sns.subject_id = p_subject_id
    ORDER BY sns.is_primary DESC, sn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to link a study note to additional subjects
CREATE OR REPLACE FUNCTION link_study_note_to_subject(
    p_study_note_id UUID,
    p_subject_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_can_link BOOLEAN;
BEGIN
    -- Get the current user
    v_user_id := auth.uid();
    
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

-- Function to unlink a study note from a subject
CREATE OR REPLACE FUNCTION unlink_study_note_from_subject(
    p_study_note_id UUID,
    p_subject_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_is_primary BOOLEAN;
BEGIN
    -- Get the current user
    v_user_id := auth.uid();
    
    -- Check if this is the primary subject
    SELECT is_primary INTO v_is_primary
    FROM study_note_subjects
    WHERE study_note_id = p_study_note_id 
    AND subject_id = p_subject_id;
    
    IF v_is_primary THEN
        RAISE EXCEPTION 'Cannot unlink the primary subject';
    END IF;
    
    -- Delete the link (RLS will handle authorization)
    DELETE FROM study_note_subjects
    WHERE study_note_id = p_study_note_id 
    AND subject_id = p_subject_id
    AND EXISTS (
        SELECT 1 FROM study_notes 
        WHERE id = p_study_note_id 
        AND user_id = v_user_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available subjects for linking (subjects not already linked)
CREATE OR REPLACE FUNCTION get_available_subjects_for_note(
    p_study_note_id UUID
) RETURNS TABLE (
    id UUID,
    name TEXT,
    study_id UUID,
    study_name TEXT,
    semester INTEGER
) AS $$
BEGIN
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
    AND s.id NOT IN (
        SELECT subject_id 
        FROM study_note_subjects 
        WHERE study_note_id = p_study_note_id
    )
    ORDER BY st.name, s.semester, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;