#!/bin/bash
# =============================================================================
# TreeChess — PostgreSQL Backup Script
# =============================================================================
# Usage:
#   ./scripts/backup.sh                  # Manual backup
#   ./scripts/backup.sh --install-cron   # Install daily cron job at 3 AM
#   ./scripts/backup.sh --remove-cron    # Remove the cron job
#
# Backups are stored in ./backups/ with the following retention policy:
#   - Daily backups: kept for 7 days
#   - Weekly backups (Sundays): kept for 4 weeks
#
# The script uses the running PostgreSQL container from docker-compose.prod.yml.
# =============================================================================

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DAY_OF_WEEK=$(date +"%u")  # 1=Monday, 7=Sunday

# Retention
DAILY_RETENTION_DAYS=7
WEEKLY_RETENTION_DAYS=28

# --- Functions ---

do_backup() {
    echo "=== TreeChess PostgreSQL Backup ==="
    echo "Timestamp: $TIMESTAMP"

    # Create backup directory
    mkdir -p "$BACKUP_DIR/daily"
    mkdir -p "$BACKUP_DIR/weekly"

    # Determine backup filename
    BACKUP_FILE="$BACKUP_DIR/daily/treechess_${TIMESTAMP}.sql.gz"

    # Run pg_dump inside the postgres container, compress output
    echo ">>> Running pg_dump..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_dump -U "${POSTGRES_USER:-treechess}" -d treechess --clean --if-exists \
        | gzip > "$BACKUP_FILE"

    # Check if backup was created and is not empty
    if [ ! -s "$BACKUP_FILE" ]; then
        echo "ERROR: Backup file is empty or was not created!"
        rm -f "$BACKUP_FILE"
        exit 1
    fi

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo ">>> Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

    # If it's Sunday, copy to weekly
    if [ "$DAY_OF_WEEK" = "7" ]; then
        WEEKLY_FILE="$BACKUP_DIR/weekly/treechess_${TIMESTAMP}.sql.gz"
        cp "$BACKUP_FILE" "$WEEKLY_FILE"
        echo ">>> Weekly backup created: $WEEKLY_FILE"
    fi

    # --- Cleanup old backups ---
    echo ">>> Cleaning up old backups..."

    # Remove daily backups older than retention period
    find "$BACKUP_DIR/daily" -name "treechess_*.sql.gz" -mtime +$DAILY_RETENTION_DAYS -delete 2>/dev/null || true
    DAILY_COUNT=$(find "$BACKUP_DIR/daily" -name "treechess_*.sql.gz" | wc -l)
    echo "    Daily backups remaining: $DAILY_COUNT"

    # Remove weekly backups older than retention period
    find "$BACKUP_DIR/weekly" -name "treechess_*.sql.gz" -mtime +$WEEKLY_RETENTION_DAYS -delete 2>/dev/null || true
    WEEKLY_COUNT=$(find "$BACKUP_DIR/weekly" -name "treechess_*.sql.gz" | wc -l)
    echo "    Weekly backups remaining: $WEEKLY_COUNT"

    echo "=== Backup complete ==="
}

install_cron() {
    CRON_CMD="0 3 * * * $SCRIPT_DIR/backup.sh >> $PROJECT_DIR/backups/backup.log 2>&1"

    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -qF "backup.sh"; then
        echo "Cron job already exists. Removing old one first."
        crontab -l 2>/dev/null | grep -vF "backup.sh" | crontab -
    fi

    # Add new cron job
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "Cron job installed: daily backup at 3:00 AM"
    echo "Logs will be written to: $PROJECT_DIR/backups/backup.log"
    echo ""
    echo "Current crontab:"
    crontab -l
}

remove_cron() {
    if crontab -l 2>/dev/null | grep -qF "backup.sh"; then
        crontab -l 2>/dev/null | grep -vF "backup.sh" | crontab -
        echo "Cron job removed."
    else
        echo "No backup cron job found."
    fi
}

# --- Main ---
case "${1:-}" in
    --install-cron)
        install_cron
        ;;
    --remove-cron)
        remove_cron
        ;;
    *)
        do_backup
        ;;
esac
