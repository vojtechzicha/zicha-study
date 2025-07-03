-- Allow public access to studies marked as public
CREATE POLICY "Public studies are viewable by everyone" ON studies
    FOR SELECT USING (is_public = true);

-- Allow public access to subjects of public studies
CREATE POLICY "Subjects of public studies are viewable by everyone" ON subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM studies 
            WHERE studies.id = subjects.study_id 
            AND studies.is_public = true
        )
    );