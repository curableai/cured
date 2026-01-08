-- Add completed column to daily_checkins table to track actual completion status
-- This prevents the check-in from showing as "completed" when only a partial record exists

ALTER TABLE daily_checkins 
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Update existing records to mark as completed (assume they were completed if they have data)
UPDATE daily_checkins 
SET completed = true 
WHERE completed IS NULL OR completed = false;

-- Add comment for documentation
COMMENT ON COLUMN daily_checkins.completed IS 'Whether the user actually completed the full check-in flow';
