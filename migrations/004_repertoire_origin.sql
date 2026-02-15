-- Migration: 004_repertoire_origin.sql
-- Description: Track origin of imported repertoires (e.g. from Lichess studies)
-- Date: 2026-02-15

-- Add origin columns to repertoires table (all nullable for backward compatibility)
ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS origin_type VARCHAR(20);
ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS origin_url TEXT;
ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS origin_creator VARCHAR(100);

-- Index for filtering by origin type
CREATE INDEX IF NOT EXISTS idx_repertoires_origin_type ON repertoires(origin_type) WHERE origin_type IS NOT NULL;
