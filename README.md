# TreeChess

Interactive chess opening repertoire builder with tree visualization and game analysis.

Build, visualize, and manage your chess opening repertoire. Import games from Lichess or PGN files, analyze them against your repertoire, and identify gaps in your preparation.

## Features

- Visual repertoire tree editor for white and black openings
- Import games directly from Lichess by username
- Upload and analyze PGN files
- Compare your games against your repertoire to find deviations
- Track which lines you know and which need work

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OR: Go 1.25+, Node.js 18+, PostgreSQL 15+

### Running with Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080

### Running Locally

**Backend:**
```bash
cd backend
go mod download
air              # Hot reload dev server
# OR: go run main.go
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/repertoire/:color | Get repertoire tree (white/black) |
| POST | /api/repertoire/:color/node | Add move to repertoire |
| DELETE | /api/repertoire/:color/node/:id | Delete node from repertoire |
| POST | /api/imports | Upload PGN for analysis |
| POST | /api/imports/lichess | Import games from Lichess |
| GET | /api/analyses | List all analyses |
| GET | /api/analyses/:id | Get analysis details |
| GET | /api/games | List all imported games |

## Project Structure

```
treechess/
├── backend/              # Go API server
│   ├── main.go
│   ├── config/
│   └── internal/
│       ├── handlers/     # HTTP handlers
│       ├── models/       # Data structures
│       ├── repository/   # Database access
│       └── services/     # Business logic
├── frontend/             # React application
│   └── src/
│       ├── features/     # Feature modules
│       ├── shared/       # Shared components
│       ├── stores/       # Zustand state
│       └── types/        # TypeScript types
└── docker-compose.yml
```

## Tech Stack

- **Frontend:** React 18, TypeScript 5, Vite 5, chess.js, Zustand
- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess
- **Database:** PostgreSQL 15+ with JSONB storage
