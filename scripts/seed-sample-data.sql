-- Insert sample study (this will only work after authentication)
-- This is just for reference - actual data will be inserted through the app

-- Sample study
INSERT INTO studies (name, type, start_year, end_year, status) VALUES
('Informatika', 'Bakalářské', 2021, 2024, 'completed');

-- Get the study ID (in real app, this would be handled automatically)
-- Sample subjects for the study
INSERT INTO subjects (study_id, semester, abbreviation, name, completion_type, credits, points, completed, exam_completed, credit_completed) VALUES
-- 1st year, winter semester
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník ZS', 'MI1', 'Mikroekonomie I', 'Zp+Zk', 6, 16, true, true, true),
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník ZS', 'KMA1-E', 'Matematika I', 'Zp', 5, 16, true, false, true),
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník ZS', 'IN1', 'Informatika I', 'Zp', 4, 12, true, false, true),
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník ZS', 'ZAP1', 'Základy práva I', 'Zk', 3, 10, true, true, false),
-- 1st year, summer semester  
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník LS', 'NP', 'Nauka o podniku', 'Zp+Zk', 6, 16, true, true, true),
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník LS', 'JA1', 'Jazyk I', 'Zp', 3, 10, true, false, true),
((SELECT id FROM studies WHERE name = 'Informatika' LIMIT 1), '1. ročník LS', 'JA2', 'Jazyk II', 'Zp', 3, 14, true, false, true);
