#!/usr/bin/env bash
set -euo pipefail

# Real pg_dump-based backup (custom format, so it can be restored
# selectively/in parallel with pg_restore). Requires DATABASE_URL to be
# set (see .env.production.example) and the `pg_dump` client installed.
#
# Usage: ./scripts/backup-db.sh [output-dir]

OUTPUT_DIR="${1:-./backups}"
mkdir -p "$OUTPUT_DIR"

: "${DATABASE_URL:?DATABASE_URL must be set}"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTPUT_FILE="$OUTPUT_DIR/dealeros-backup-$TIMESTAMP.dump"

pg_dump --format=custom --file="$OUTPUT_FILE" "$DATABASE_URL"
echo "Backup written to $OUTPUT_FILE"
