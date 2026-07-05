#!/usr/bin/env bash
set -euo pipefail

# Restores a backup produced by backup-db.sh. This OVERWRITES the target
# database - it prompts for confirmation before doing anything.
#
# Usage: ./scripts/restore-db.sh <backup-file>

BACKUP_FILE="${1:?Usage: restore-db.sh <backup-file>}"
: "${DATABASE_URL:?DATABASE_URL must be set}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "WARNING: this will overwrite the database at the target DATABASE_URL."
read -r -p "Type 'yes' to continue: " CONFIRMATION
if [ "$CONFIRMATION" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$BACKUP_FILE"
echo "Restore complete."
