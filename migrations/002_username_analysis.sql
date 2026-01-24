-- Migration: 002_username_analysis.sql
-- Description: Replace color with username in analyses table
-- Date: 2026-01-24

-- Drop the old index if it exists
DROP INDEX IF EXISTS idx_analyses_color;

-- Check if the column is still named 'color' and rename it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'analyses' AND column_name = 'color'
    ) THEN
        -- Remove the check constraint
        ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_color_check;
        -- Rename the column
        ALTER TABLE analyses RENAME COLUMN color TO username;
        -- Change the type to allow longer usernames
        ALTER TABLE analyses ALTER COLUMN username TYPE VARCHAR(255);
    END IF;
END $$;

-- Create new index on username if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_analyses_username ON analyses(username);
