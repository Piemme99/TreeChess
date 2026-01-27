-- Migration: 003_multiple_repertoires.sql
-- Description: Allow multiple repertoires per color with names (max 50 total)
-- Date: 2026-01-26

-- Remove the one-repertoire-per-color constraint
ALTER TABLE repertoires DROP CONSTRAINT IF EXISTS one_repertoire_per_color;

-- Add name column with a default for existing rows
ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Main Repertoire';

-- Create function to enforce max 50 repertoires
CREATE OR REPLACE FUNCTION check_repertoire_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM repertoires) >= 50 THEN
        RAISE EXCEPTION 'Maximum of 50 repertoires allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS repertoire_limit_trigger ON repertoires;

-- Create trigger to enforce limit
CREATE TRIGGER repertoire_limit_trigger
    BEFORE INSERT ON repertoires
    FOR EACH ROW EXECUTE FUNCTION check_repertoire_limit();

-- Add index on name for faster searches
CREATE INDEX IF NOT EXISTS idx_repertoires_name ON repertoires(name);

-- Update GameAnalysis in analyses table to include matched repertoire info
-- The results JSONB will now include matchedRepertoire and matchScore fields
-- This is handled at the application level, no schema change needed
