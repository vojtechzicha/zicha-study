-- Fix the get_final_exam_study_notes function to return all required fields
CREATE OR REPLACE FUNCTION get_final_exam_study_notes(p_final_exam_id UUID)
RETURNS TABLE (
    id UUID,
    subject_id UUID,
    study_id UUID,
    user_id UUID,
    name TEXT,
    description TEXT,
    file_name TEXT,
    file_extension TEXT,
    file_size BIGINT,
    mime_type TEXT,
    onedrive_id TEXT,
    onedrive_web_url TEXT,
    onedrive_download_url TEXT,
    parent_path TEXT,
    is_public BOOLEAN,
    public_slug TEXT,
    last_modified_onedrive TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN,
    linked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sn.id,
        sn.subject_id,
        sn.study_id,
        sn.user_id,
        sn.name,
        sn.description,
        sn.file_name,
        sn.file_extension,
        sn.file_size,
        sn.mime_type,
        sn.onedrive_id,
        sn.onedrive_web_url,
        sn.onedrive_download_url,
        sn.parent_path,
        sn.is_public,
        sn.public_slug,
        sn.last_modified_onedrive,
        sn.created_at,
        sn.updated_at,
        snfe.is_primary,
        snfe.linked_at
    FROM study_notes sn
    INNER JOIN study_note_final_exams snfe ON sn.id = snfe.study_note_id
    WHERE snfe.final_exam_id = p_final_exam_id
    ORDER BY snfe.is_primary DESC, sn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;