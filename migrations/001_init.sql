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

-- Performance indexes for repertoires
CREATE INDEX IF NOT EXISTS idx_repertoires_color ON repertoires(color);
CREATE INDEX IF NOT EXISTS idx_repertoires_updated ON repertoires(updated_at DESC);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    filename VARCHAR(255) NOT NULL,
    game_count INTEGER NOT NULL,
    results JSONB NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes for analyses
CREATE INDEX IF NOT EXISTS idx_analyses_color ON analyses(color);
CREATE INDEX IF NOT EXISTS idx_analyses_uploaded ON analyses(uploaded_at DESC);
