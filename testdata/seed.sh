#!/bin/bash
#
# TreeChess Test Data Seeding Script
# 
# This script creates test repertoires and imports test games
# for manual testing of the application.
#
# Prerequisites:
#   - Backend running on localhost:8080
#   - curl and jq installed
#
# Usage:
#   ./seed.sh           # Seed all data
#   ./seed.sh --clean   # Only clean existing data
#

set -e

API_URL="${API_URL:-http://localhost:8080/api}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERNAME="TestUser"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Install with: sudo apt install jq"
        exit 1
    fi
    
    # Check if backend is running
    if ! curl -s "${API_URL}/health" > /dev/null 2>&1; then
        log_error "Backend is not running at ${API_URL}"
        log_info "Start the backend with: cd backend && air"
        exit 1
    fi
    
    log_success "Prerequisites OK"
}

# Clean existing data
clean_data() {
    log_info "Cleaning existing data..."
    
    # Delete all analyses
    ANALYSES=$(curl -s "${API_URL}/analyses" | jq -r '.[].id // empty' 2>/dev/null || echo "")
    for id in $ANALYSES; do
        curl -s -X DELETE "${API_URL}/analyses/${id}" > /dev/null
        log_info "  Deleted analysis: ${id}"
    done
    
    # Delete all repertoires
    REPERTOIRES=$(curl -s "${API_URL}/repertoires" | jq -r '.[].id // empty' 2>/dev/null || echo "")
    for id in $REPERTOIRES; do
        curl -s -X DELETE "${API_URL}/repertoire/${id}" > /dev/null
        log_info "  Deleted repertoire: ${id}"
    done
    
    log_success "Cleaned existing data"
}

# Create a repertoire and return its ID
create_repertoire() {
    local name="$1"
    local color="$2"
    
    local response=$(curl -s -X POST "${API_URL}/repertoires" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${name}\", \"color\": \"${color}\"}")
    
    local id=$(echo "$response" | jq -r '.id')
    
    if [ "$id" == "null" ] || [ -z "$id" ]; then
        log_error "Failed to create repertoire: $name"
        echo "$response"
        exit 1
    fi
    
    echo "$id"
}

# Add a node to a repertoire
# Returns the new node's ID
add_node() {
    local rep_id="$1"
    local parent_id="$2"
    local move="$3"
    
    local response=$(curl -s -X POST "${API_URL}/repertoire/${rep_id}/node" \
        -H "Content-Type: application/json" \
        -d "{\"parentId\": \"${parent_id}\", \"move\": \"${move}\"}")
    
    # The API returns the full repertoire, we need to find the new node
    # The new node will be in the tree under the parent
    echo "$response"
}

# Find a node ID by traversing the path of moves from root
find_node_id() {
    local repertoire_json="$1"
    shift
    local moves=("$@")
    
    local current_node=$(echo "$repertoire_json" | jq '.treeData')
    
    for move in "${moves[@]}"; do
        current_node=$(echo "$current_node" | jq --arg m "$move" '.children[] | select(.move == $m)')
        if [ -z "$current_node" ]; then
            echo ""
            return
        fi
    done
    
    echo "$current_node" | jq -r '.id'
}

# Build a repertoire line by line
build_repertoire_line() {
    local rep_id="$1"
    local line_name="$2"
    shift 2
    local moves=("$@")
    
    log_info "  Building line: $line_name"
    
    # Get current repertoire state
    local rep_json=$(curl -s "${API_URL}/repertoire/${rep_id}")
    local root_id=$(echo "$rep_json" | jq -r '.treeData.id')
    
    local parent_id="$root_id"
    local path_moves=()
    
    for move in "${moves[@]}"; do
        # Check if this move already exists
        path_moves+=("$move")
        local existing_id=$(find_node_id "$rep_json" "${path_moves[@]}")
        
        if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
            # Node already exists, just update parent_id
            parent_id="$existing_id"
        else
            # Need to add this node
            rep_json=$(add_node "$rep_id" "$parent_id" "$move")
            
            # Find the new node's ID
            parent_id=$(find_node_id "$rep_json" "${path_moves[@]}")
            
            if [ -z "$parent_id" ] || [ "$parent_id" == "null" ]; then
                log_error "Failed to add move: $move"
                exit 1
            fi
        fi
    done
}

# Create Italian Game repertoire
create_italian_game() {
    log_info "Creating Italian Game repertoire..."
    
    local rep_id=$(create_repertoire "Italian Game" "white")
    log_success "Created repertoire with ID: $rep_id"
    
    # Line 1: Main Line - Giuoco Piano
    # 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4
    build_repertoire_line "$rep_id" "Main Line - Giuoco Piano" \
        "e4" "e5" "Nf3" "Nc6" "Bc4" "Bc5" "c3" "Nf6" "d4" "exd4" "cxd4"
    
    # Line 2: Two Knights Defense - Quiet
    # 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d3 Be7 5.O-O O-O 6.Re1
    build_repertoire_line "$rep_id" "Two Knights Defense - Quiet" \
        "e4" "e5" "Nf3" "Nc6" "Bc4" "Nf6" "d3" "Be7" "O-O" "O-O" "Re1"
    
    # Line 3: Hungarian Defense
    # 1.e4 e5 2.Nf3 Nc6 3.Bc4 Be7 4.d4 d6 5.dxe5 dxe5 6.Qxd8+
    build_repertoire_line "$rep_id" "Hungarian Defense" \
        "e4" "e5" "Nf3" "Nc6" "Bc4" "Be7" "d4" "d6" "dxe5" "dxe5" "Qxd8+"
    
    log_success "Italian Game repertoire complete"
    echo "$rep_id"
}

# Create London System repertoire
create_london_system() {
    log_info "Creating London System repertoire..."
    
    local rep_id=$(create_repertoire "London System" "white")
    log_success "Created repertoire with ID: $rep_id"
    
    # Line 1: Main Line vs ...c5
    # 1.d4 d5 2.Bf4 Nf6 3.e3 c5 4.c3 Nc6 5.Nd2 e6 6.Ngf3
    build_repertoire_line "$rep_id" "Main Line vs ...c5" \
        "d4" "d5" "Bf4" "Nf6" "e3" "c5" "c3" "Nc6" "Nd2" "e6" "Ngf3"
    
    # Line 2: vs ...e6 setup (Bd6 comes later)
    # 1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Bd3 Bd6 5.Bg3 O-O 6.Nf3
    build_repertoire_line "$rep_id" "vs ...e6 setup" \
        "d4" "d5" "Bf4" "Nf6" "e3" "e6" "Bd3" "Bd6" "Bg3" "O-O" "Nf3"
    
    # Line 3: vs ...Bf5 mirror
    # 1.d4 d5 2.Bf4 Nf6 3.e3 Bf5 4.Bd3 e6 5.Bxf5 exf5 6.Nf3
    build_repertoire_line "$rep_id" "vs ...Bf5 mirror" \
        "d4" "d5" "Bf4" "Nf6" "e3" "Bf5" "Bd3" "e6" "Bxf5" "exf5" "Nf3"
    
    log_success "London System repertoire complete"
    echo "$rep_id"
}

# Create Sicilian Najdorf repertoire
create_sicilian_najdorf() {
    log_info "Creating Sicilian Najdorf repertoire..."
    
    local rep_id=$(create_repertoire "Sicilian Najdorf" "black")
    log_success "Created repertoire with ID: $rep_id"
    
    # Line 1: English Attack
    # 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6
    build_repertoire_line "$rep_id" "English Attack" \
        "e4" "c5" "Nf3" "d6" "d4" "cxd4" "Nxd4" "Nf6" "Nc3" "a6" "Be3" "e5" "Nb3" "Be6"
    
    # Line 2: Bg5 Attack
    # 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Be7 8.Qf3 Qc7
    build_repertoire_line "$rep_id" "Bg5 Attack" \
        "e4" "c5" "Nf3" "d6" "d4" "cxd4" "Nxd4" "Nf6" "Nc3" "a6" "Bg5" "e6" "f4" "Be7" "Qf3" "Qc7"
    
    # Line 3: Classical Be2
    # 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2 e5 7.Nb3 Be7 8.O-O O-O
    build_repertoire_line "$rep_id" "Classical Be2" \
        "e4" "c5" "Nf3" "d6" "d4" "cxd4" "Nxd4" "Nf6" "Nc3" "a6" "Be2" "e5" "Nb3" "Be7" "O-O" "O-O"
    
    log_success "Sicilian Najdorf repertoire complete"
    echo "$rep_id"
}

# Import a PGN file
import_pgn() {
    local filename="$1"
    local filepath="${SCRIPT_DIR}/games/${filename}"
    
    if [ ! -f "$filepath" ]; then
        log_error "PGN file not found: $filepath"
        return 1
    fi
    
    log_info "Importing $filename..."
    
    local response=$(curl -s -X POST "${API_URL}/imports" \
        -F "username=${USERNAME}" \
        -F "file=@${filepath}")
    
    local id=$(echo "$response" | jq -r '.id')
    local game_count=$(echo "$response" | jq -r '.gameCount')
    
    if [ "$id" == "null" ] || [ -z "$id" ]; then
        log_error "Failed to import $filename"
        echo "$response"
        return 1
    fi
    
    log_success "Imported $filename: $game_count game(s), ID: $id"
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}Test Data Seeding Complete!${NC}"
    echo "=========================================="
    echo ""
    echo "Created Repertoires:"
    curl -s "${API_URL}/repertoires" | jq -r '.[] | "  - \(.name) (\(.color)): \(.metadata.totalMoves) moves"'
    echo ""
    echo "Imported Analyses:"
    curl -s "${API_URL}/analyses" | jq -r '.[] | "  - \(.filename): \(.gameCount) game(s)"'
    echo ""
    echo "Test Scenarios:"
    echo "  1. perfect-match.pgn   - User plays Italian Game perfectly (all in-repertoire)"
    echo "  2. opponent-novelty.pgn - Opponent plays 6.f3 in Najdorf (opponent-new move)"
    echo "  3. user-error.pgn      - User plays 3.Nf3 instead of 3.e3 (out-of-repertoire)"
    echo ""
}

# Main
main() {
    echo "=========================================="
    echo "TreeChess Test Data Seeding Script"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    
    if [ "$1" == "--clean" ]; then
        clean_data
        log_success "Clean complete"
        exit 0
    fi
    
    clean_data
    
    echo ""
    log_info "Creating repertoires..."
    echo ""
    
    create_italian_game
    echo ""
    create_london_system
    echo ""
    create_sicilian_najdorf
    echo ""
    
    log_info "Importing test games..."
    echo ""
    
    import_pgn "perfect-match.pgn"
    import_pgn "opponent-novelty.pgn"
    import_pgn "user-error.pgn"
    
    print_summary
}

main "$@"
