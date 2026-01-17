-- Add end_date and status columns to medications table
-- This allows tracking medication completion dates

ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed'));

-- Create index for efficient querying of active medications
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);

-- Create index for efficient querying of medications by end date
CREATE INDEX IF NOT EXISTS idx_medications_end_date ON medications(end_date) WHERE end_date IS NOT NULL;
