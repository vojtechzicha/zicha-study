-- Make shortcut field optional for final exams (similar to regular subjects)
ALTER TABLE final_exams ALTER COLUMN shortcut DROP NOT NULL;