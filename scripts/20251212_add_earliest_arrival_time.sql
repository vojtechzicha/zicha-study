-- Add earliest arrival time setting to studies table
-- This allows users to specify the earliest time they can arrive at school
-- Format: TIME (e.g., '08:50:00' for 8:50 AM)
-- If NULL, the system computes it from transit_duration_hours (assuming 5:30 AM departure)

ALTER TABLE studies ADD COLUMN IF NOT EXISTS earliest_arrival_time TIME DEFAULT NULL;

COMMENT ON COLUMN studies.earliest_arrival_time IS 'Earliest time the student can arrive at school (e.g., 08:50). If NULL, computed from transit duration assuming 5:30 AM departure.';
