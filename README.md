# TreeChess

Interactive chess opening repertoire builder with GitHub-style tree visualization.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OR: Go 1.21+, Node.js 18+, PostgreSQL 15+

### Running with Docker (Recommended)

```bash
# Start all services
docker-compose up --build

# Or start in background
docker-compose up -d
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432 (treechess/treechess)

### Running Locally (Without Docker)

**Backend:**
```bash
cd cmd/server
go mod download
go run main.go
```

**Frontend:**
```bash
npm install
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/repertoire/:color | Get repertoire (white/black) |

## Project Structure

```
treechess/
├── cmd/server/           # Go backend
├── src/                  # React frontend
├── migrations/           # PostgreSQL migrations
├── docker-compose.yml    # Docker configuration
├── go.mod                # Go dependencies
├── package.json          # Node dependencies
└── README.md
```

## Tech Stack

- Frontend: React 18 + TypeScript + Vite
- Backend: Go + Echo
- Database: PostgreSQL + pgx
- Containerization: Docker + Docker Compose
