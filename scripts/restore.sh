#!/bin/bash
# =============================================================================
# Kumquat — PostgreSQL Restore Script
# =============================================================================
# Usage: ./scripts/restore.sh <backup_file.sql.gz>
#
# Example:
#   ./scripts/restore.sh ./backups/daily/kumquat_2026-02-10_03-00-00.sql.gz
#
# WARNING: This will REPLACE all data in the database with the backup contents.
# The database container must be running.
# =============================================================================

set -euo pipefail

BACKUP_FILE="${1:?Usage: $0 <backup_file.sql.gz>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"

# --- Validate ---
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=== Kumquat PostgreSQL Restore ==="
echo "Backup file: $BACKUP_FILE"
echo ""
echo "WARNING: This will REPLACE all data in the database!"
echo ""
read -p "Are you sure? Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# --- Check that postgres container is running ---
if ! docker compose -f "$COMPOSE_FILE" ps postgres | grep -q "running"; then
    echo "ERROR: PostgreSQL container is not running."
    echo "Start it with: docker compose -f $COMPOSE_FILE up -d postgres"
    exit 1
fi

# --- Restore ---
echo ">>> Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U "${POSTGRES_USER:-treechess}" -d treechess --quiet

echo ""
echo "=== Restore complete ==="
echo "You may want to restart the backend to clear any caches:"
echo "  docker compose -f $COMPOSE_FILE restart backend"
