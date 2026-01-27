# TreeChess Test Data

This directory contains mock data for manual testing of TreeChess features.

## Quick Start

```bash
# Make sure backend is running
cd backend && air

# In another terminal, run the seed script
cd testdata
./seed.sh
```

## Prerequisites

- Backend running on `localhost:8080`
- `curl` installed
- `jq` installed (`sudo apt install jq`)

## What Gets Created

### Repertoires

| Name | Color | Lines | Description |
|------|-------|-------|-------------|
| Italian Game | White | 3 | Giuoco Piano, Two Knights, Hungarian Defense |
| London System | White | 3 | vs c5, vs Bd6, vs Be7 |
| Sicilian Najdorf | Black | 3 | English Attack, Bg5, Classical Be2 |

### Test Games

| File | Scenario | User Color | Expected Behavior |
|------|----------|------------|-------------------|
| `perfect-match.pgn` | Perfect repertoire match | White | All user moves should be `in-repertoire` |
| `opponent-novelty.pgn` | Opponent plays novelty | Black | Move 6.f3 should be `opponent-new` |
| `user-error.pgn` | User deviates from repertoire | White | Move 3.Nf3 should be `out-of-repertoire` with `expectedMove: e3` |

## Detailed Test Scenarios

### 1. Perfect Match (Italian Game)

**File:** `games/perfect-match.pgn`

The user plays White and follows the Italian Game main line:
```
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 ...
```

**Expected analysis results:**
- Moves 1-11 (up to 6.cxd4): All `in-repertoire`
- After move 11: Game continues beyond repertoire coverage

### 2. Opponent Novelty (Sicilian Najdorf)

**File:** `games/opponent-novelty.pgn`

The user plays Black with the Sicilian Najdorf. After the standard moves:
```
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6
```

The opponent plays `6. f3` instead of the usual Be3, Bg5, or Be2.

**Expected analysis results:**
- Moves 1-10 (up to 5...a6): All `in-repertoire`
- Move 11 (6.f3): `opponent-new` - this is a line we might want to add

### 3. User Error (London System)

**File:** `games/user-error.pgn`

The user plays White with the London System but makes an error:
```
1. d4 d5 2. Bf4 Nf6 3. Nf3?! (instead of 3. e3)
```

**Expected analysis results:**
- Moves 1-4: `in-repertoire`
- Move 5 (3.Nf3): `out-of-repertoire` with `expectedMove: "e3"`

## Repertoire Trees

### Italian Game (White)

```
root (starting position)
└── e4
    └── e5
        └── Nf3
            └── Nc6
                └── Bc4
                    ├── Bc5 (Giuoco Piano)
                    │   └── c3
                    │       └── Nf6
                    │           └── d4
                    │               └── exd4
                    │                   └── cxd4
                    ├── Nf6 (Two Knights)
                    │   └── d3
                    │       └── Be7
                    │           └── O-O
                    │               └── O-O
                    │                   └── Re1
                    └── Be7 (Hungarian)
                        └── d4
                            └── d6
                                └── dxe5
                                    └── dxe5
                                        └── Qxd8+
```

### London System (White)

```
root
└── d4
    └── d5
        └── Bf4
            └── Nf6
                └── e3
                    ├── c5
                    │   └── c3
                    │       └── Nc6
                    │           └── Nd2
                    │               └── e6
                    │                   └── Ngf3
                    ├── e6
                    │   └── Bd3
                    │       └── Bd6
                    │           └── Bg3
                    │               └── O-O
                    │                   └── Nf3
                    └── Bf5
                        └── Bd3
                            └── e6
                                └── Bxf5
                                    └── exf5
                                        └── Nf3
```

### Sicilian Najdorf (Black)

```
root
└── e4
    └── c5
        └── Nf3
            └── d6
                └── d4
                    └── cxd4
                        └── Nxd4
                            └── Nf6
                                └── Nc3
                                    └── a6
                                        ├── Be3 (English Attack)
                                        │   └── e5
                                        │       └── Nb3
                                        │           └── Be6
                                        ├── Bg5 (Bg5 Attack)
                                        │   └── e6
                                        │       └── f4
                                        │           └── Be7
                                        │               └── Qf3
                                        │                   └── Qc7
                                        └── Be2 (Classical)
                                            └── e5
                                                └── Nb3
                                                    └── Be7
                                                        └── O-O
                                                            └── O-O
```

## Script Options

```bash
# Seed all data (cleans first)
./seed.sh

# Only clean existing data
./seed.sh --clean

# Use different API URL
API_URL=http://localhost:3000/api ./seed.sh
```

## Troubleshooting

### "Backend is not running"
Start the backend first:
```bash
cd backend && air
```

### "jq is not installed"
Install jq:
```bash
sudo apt install jq
```

### Script fails on a specific move
The script validates moves against the chess engine. If a move fails:
1. Check the FEN position is valid
2. Verify the move is legal in SAN notation
3. Check for typos in the JSON repertoire files
