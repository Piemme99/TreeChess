# Project Overview

**Version:** 1.0  
**Date:** January 19, 2026

---

## 1. Context and Vision

### 1.1 Problem Statement

Amateur chess players (below 2000 ELO) face significant challenges in learning and memorizing their opening repertoires. Existing tools (Lichess, Chess.com, books) offer either static repertoires or analysis tools, but none allow building a personalized repertoire interactively while automatically enriching it from one's own games.

### 1.2 Proposed Solution

TreeChess is a web application that enables players to create, visualize, and enrich their opening repertoire as an interactive tree. The user builds their repertoire move by move, then imports games to identify gaps and automatically complete missing branches.

### 1.3 Value Proposition

- **Personalization**: The user keeps only the lines they want to learn
- **Incremental Growth**: The tree grows naturally with each imported game
- **Intuitive Visualization**: GitHub-style representation of opening possibilities
- **Active Review**: Replaying branches to memorize sequences

---

## 2. Project Objectives

### 2.1 MVP Objectives (Version 1.0) - Local Development

Enable a single user to create and visualize two repertoire trees (White and Black) by importing PGN files, with the ability to manually add new branches during divergences.

**MVP Tech Stack:**
- Frontend: React 18 + TypeScript
- Backend: Go
- Database: PostgreSQL (local dev)
- No authentication
- No production deployment

### 2.2 V2 Objectives (Version 2.0) - Production

- Authentication via OAuth Lichess
- Direct import from Lichess API
- Multi-user support
- Production deployment

### 2.3 Features Deferred to V2

- Training mode with quiz and spaced repetition
- Chess.com API import
- Multiple repertoires per color
- Main line vs sideline visualization
- Repertoire PGN export
- Progress statistics
- Comments/Videos on positions

---

## 3. MVP Scope Summary

### What is in scope

- Create White and Black repertoires manually
- Import PGN files (one or more games)
- Analyze games against repertoire
- Add missing moves/branches from analysis
- Delete branches from repertoire
- GitHub-style tree visualization
- Local development with Docker

### What is out of scope

- Authentication
- Multi-user support
- Import from Lichess/Chess.com APIs
- Training/quiz mode
- Statistics and progress tracking
- ECO code classification
- Export to PGN
- Production deployment

---

## 4. Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18+ |
| Frontend | TypeScript | 5+ |
| Frontend Build | Vite | 5+ |
| State Management | Zustand | 4+ |
| Chess Logic | chess.js | 1+ |
| Backend | Go | 1.21+ |
| Backend Framework | Echo | 4.11+ |
| Database | PostgreSQL | 15+ |
| DB Driver | pgx | 5+ |
| Containerization | Docker | 24+ |
| Orchestration | Docker Compose | 2+ |

---

## 5. Application Pages (MVP)

### 5.1 Dashboard
- List of repertoires (White, Black)
- List of imported PGN files
- Import button

### 5.2 Repertoire Edit Page
- Tree visualization (left panel)
- Chess board (right panel)
- Move history
- Add/Delete operations

### 5.3 Imports Page
- List of imported files
- Analyze button per file

### 5.4 Analysis Detail Page
- List of games with analysis results
- "Add to repertoire" navigation
- "Ignore" action

---

## 6. Key Data Structures

### 6.1 RepertoireNode

```typescript
interface RepertoireNode {
  id: string;              // UUID v4
  fen: string;             // Position after this move
  move: string | null;     // SAN notation (null for root)
  moveNumber: number;      // 1 = first White move
  colorToMove: 'w' | 'b';  // Color to move
  parentId: string | null; // Parent node ID
  children: RepertoireNode[];
}
```

### 6.2 MoveAnalysis

```typescript
interface MoveAnalysis {
  plyNumber: number;
  san: string;
  fen: string;
  status: 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';
  expectedMove?: string;
  isUserMove: boolean;
}
```

---

## 7. Related Documents

| Document | Purpose |
|----------|---------|
| `01_EPIC_INFRASTRUCTURE.md` | Docker, project setup, migrations |
| `02_EPIC_BACKEND_API.md` | Go architecture, API endpoints |
| `03_EPIC_CHESS_LOGIC.md` | chess.js, validation, PGN parsing |
| `04_EPIC_FRONTEND_CORE.md` | React architecture, UI components |
| `04b_EPIC_BOARD.md` | Chess board component |
| `05_EPIC_TREE_VISUAL.md` | Tree visualization |
| `06_EPIC_REPERTOIRE_CRUD.md` | Repertoire operations |
| `07_EPIC_PGN_IMPORT.md` | PGN import workflow |
| `08_ROADMAP.md` | Execution order |
| `09_GLOSSARY.md` | Terminology |
