# Project Overview

**Version:** 1.0
**Date:** January 19, 2026

---

## Context

TreeChess is a web application for amateur chess players (below 2000 ELO) to create, visualize, and enrich their opening repertoires as an interactive tree. Users build their repertoire move by move, then import PGN games to identify gaps and automatically complete missing branches.

**Key Features:**
- GitHub-style tree visualization of opening lines
- Manual move addition and branch deletion
- PGN import and game analysis
- Automatic detection of repertoire gaps

---

## MVP Scope

**In Scope:**
- White and Black repertoires
- PGN file import
- Game analysis against repertoire
- Add/delete moves manually
- Local development with Docker

**Out of Scope:**
- Authentication
- Multi-user support
- API import (Lichess, Chess.com)
- Training/quiz mode
- Statistics and export

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| State Management | Zustand 4+ |
| Chess Logic | chess.js 1+ |
| Backend | Go 1.21 + Echo 4.11+ |
| Database | PostgreSQL 15+ |
| DB Driver | pgx 5+ |
| Containerization | Docker 24+ |

---

## Application Pages

1. **Dashboard** - Repertoire overview and quick actions
2. **Repertoire Edit** - Tree visualization + chess board
3. **Import List** - Manage imported PGN files
4. **Import Detail** - Analysis results and actions

---

## Key Data Structures

**RepertoireNode:**
- id: UUID
- fen: Position after move
- move: SAN notation (null for root)
- moveNumber: Ply count
- colorToMove: 'w' | 'b'
- parentId: Reference to parent
- children: Array of child nodes

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `TICKETS.md` | All implementation tickets |
| `01_EPIC_INFRASTRUCTURE.md` | Docker, project setup |
| `02_EPIC_BACKEND_API.md` | Backend architecture |
| `03_EPIC_CHESS_LOGIC.md` | Move validation, PGN parsing |
| `04_EPIC_FRONTEND_CORE.md` | React architecture |
| `04b_EPIC_BOARD.md` | Chess board component |
| `05_EPIC_TREE_VISUAL.md` | Tree visualization |
| `06_EPIC_REPERTOIRE_CRUD.md` | Repertoire operations |
| `07_EPIC_PGN_IMPORT.md` | Import workflow |
| `08_ROADMAP.md` | Execution order |
| `09_GLOSSARY.md` | Terminology |
