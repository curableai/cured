-- Add occupation column to onboarding table
ALTER TABLE onboarding 
ADD COLUMN IF NOT EXISTS occupation TEXT;
