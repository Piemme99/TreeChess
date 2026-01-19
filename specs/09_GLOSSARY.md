# Glossary

**Version:** 1.0  
**Date:** January 19, 2026

---

## Chess Terminology

### Castling

A special move where the king and rook move simultaneously. Two forms:
- **Kingside (O-O)**: King moves two squares toward the rook on h1/h8
- **Queenside (O-O-O)**: King moves two squares toward the rook on a1/a8

### ECO (Encyclopedia of Chess Openings)

A classification system for chess openings using codes A-E and three digits:
- A: Flank Openings (1.g3, 1.b4, etc.)
- B: Semi-Open Games other than French and Sicilian (1.e4)
- C: Open Games and French Defense (1.e4 e6)
- D: Closed Games (1.d4)
- E: Indian Defenses (1.d4 Nf6)

Example: `B90` = Sicilian, Najdorf Variation

### En Passant

A special pawn capture where a pawn captures an opposing pawn that has just moved two squares forward, passing through its capture square.

### FEN (Forsyth-Edwards Notation)

A standard notation that describes a chess position using one line of text:

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

Fields:
1. Piece placement (8 ranks, `/` separated)
2. Active color (`w` or `b`)
3. Castling availability (`KQkq` or `-`)
4. En passant target square (or `-`)
5. Halfmove clock (for 50-move rule)
6. Fullmove number

### Move Number

In chess notation, moves are numbered starting at 1. Each number represents a full move (White + Black).

Example:
- Move 1: White plays, Black plays
- Move 2: White plays, Black plays

### Pawn Promotion

When a pawn reaches the 8th (White) or 1st (Black) rank, it must be promoted to a piece (usually Queen).

Notation: `e8=Q` (promote to Queen), `e8=R` (promote to Rook), etc.

### Ply

A half-move (one player's turn). A full move consists of two plies.

### SAN (Standard Algebraic Notation)

The most common notation for recording chess moves:

| Notation | Description |
|----------|-------------|
| `e4` | Pawn to e4 |
| `Nf3` | Knight to f3 |
| `Nge2` | Knight from g-file to e2 (disambiguation) |
| `exd5` | Pawn from e captures on d5 |
| `O-O` | Kingside castling |
| `O-O-O` | Queenside castling |
| `e8=Q` | Pawn promotes to Queen |
| `Nf6+` | Knight to f6 (check) |
| `Qh5#` | Queen to h5 (checkmate) |

### Sideline

A variation that is not part of the main line of an opening.

### Trunk / Main Line

The most important or most common line of an opening.

---

## Technical Terminology

### API (Application Programming Interface)

A set of HTTP endpoints that the frontend uses to communicate with the backend.

### Backend

The server-side code (Go in this project) that handles API requests and database operations.

### Component

A reusable React element that renders a part of the UI.

### CRUD

Create, Read, Update, Delete - the four basic operations for data management.

### Docker

A platform for packaging applications in containers.

### Docker Compose

A tool for defining and running multi-container Docker applications.

### Frontend

The client-side code (React in this project) that runs in the browser.

### FQDN

Fully Qualified Domain Name - a complete domain name (e.g., `api.treechess.com`).

### Hot Reload / HMR

A development feature that updates the application without requiring a full page reload.

### JSON (JavaScript Object Notation)

A lightweight data interchange format used for API requests and responses.

### JSONB

A PostgreSQL data type for storing JSON data with additional indexing capabilities.

### Middleware

A function that intercepts HTTP requests before they reach the handler.

### pgx

A PostgreSQL driver for Go.

### React

A JavaScript library for building user interfaces.

### Repository Pattern

A design pattern that abstracts database operations behind a clean interface.

### REST (Representational State Transfer)

An architectural style for designing networked applications using HTTP.

### SVG (Scalable Vector Graphics)

An XML-based format for vector graphics, used for the tree visualization.

### TypeScript

A typed superset of JavaScript that adds static typing.

### UUID (Universally Unique Identifier)

A 128-bit identifier designed for uniqueness. Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Vite

A fast build tool and development server for frontend projects.

### Zustand

A small, fast state management library for React.

---

## Project-Specific Terms

### Analysis

The process of comparing imported games against the user's repertoire to identify:
- Moves in repertoire (OK)
- Moves out of repertoire (errors)
- New opponent lines (to add)

### Branch

A path through the tree from the root to a specific node, representing a sequence of moves.

### Divergence

A point where a game deviates from the user's known repertoire.

### Import

A PGN file that has been uploaded to the application for analysis.

### Node

A single position in the tree, representing the state after a specific move.

### Repertoire

A collection of opening lines that a player knows, organized as a tree.

### Root

The initial chess position (before any moves have been made).

### Tree

The complete structure of a repertoire, showing all known lines and variations.

### Tree Visualization

The GitHub-style graphical representation of the repertoire tree.

---

## File Extensions

| Extension | File Type |
|-----------|-----------|
| `.go` | Go source code |
| `.ts` | TypeScript source code |
| `.tsx` | TypeScript with JSX (React) |
| `.sql` | SQL database script |
| `.yml` / `.yaml` | YAML configuration |
| `.json` | JSON data |
| `.md` | Markdown documentation |
| `.pgn` | Chess game file (text) |

---

## Command Line Terms

| Command | Description |
|---------|-------------|
| `npm install` | Install Node dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `go mod download` | Download Go dependencies |
| `go test ./...` | Run all Go tests |
| `docker-compose up` | Start Docker containers |
| `docker-compose down` | Stop Docker containers |
| `air` | Run Go with hot reload |

---

## Database Terms

| Term | Definition |
|------|------------|
| Migration | A script that modifies the database schema |
| Schema | The structure of the database (tables, columns) |
| Table | A collection of related data (like `repertoires`) |
| Column | A field in a table (like `id`, `color`) |
| Row | A single record in a table |
| Index | A database structure for faster queries |
| Primary Key | A unique identifier for each row |
| Foreign Key | A reference to another table |

---

## Error Handling Terms

| Term | Definition |
|------|------------|
| 404 | Not Found - The resource doesn't exist |
| 400 | Bad Request - Invalid input |
| 500 | Internal Server Error - Server failed |
| Toast | A temporary notification message |
| Modal | A popup dialog |

---

## Acronyms

| Acronym | Full Form |
|---------|-----------|
| API | Application Programming Interface |
| BDD | Behavior-Driven Development |
| CI/CD | Continuous Integration/Continuous Deployment |
| CRUD | Create, Read, Update, Delete |
| ECO | Encyclopedia of Chess Openings |
| FEN | Forsyth-Edwards Notation |
| HMR | Hot Module Replacement |
| JSON | JavaScript Object Notation |
| JSONB | JSON Binary (PostgreSQL) |
| PGN | Portable Game Notation |
| REST | Representational State Transfer |
| SAN | Standard Algebraic Notation |
| SQL | Structured Query Language |
| TDD | Test-Driven Development |
| UUID | Universally Unique Identifier |
