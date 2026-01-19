-- Migration: 001_init.sql
-- Description: Initial database schema for TreeChess
-- Date: 2026-01-19

-- Create repertoires table
CREATE TABLE IF NOT EXISTS repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_repertoire_per_color UNIQUE (color)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_repertoires_color ON repertoires(color);
CREATE INDEX IF NOT EXISTS idx_repertoires_updated ON repertoires(updated_at DESC);
