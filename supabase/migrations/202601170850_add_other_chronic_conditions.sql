-- Create migration to add custom condition and history columns to onboarding table
ALTER TABLE "public"."onboarding" ADD COLUMN IF NOT EXISTS "other_chronic_conditions" text;
ALTER TABLE "public"."onboarding" ADD COLUMN IF NOT EXISTS "other_family_history" text;
