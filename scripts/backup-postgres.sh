#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to the offline age recipient public key}"
: "${BACKUP_DIR:?Set BACKUP_DIR to private durable backup storage}"
command -v age >/dev/null || { echo "Install age before running encrypted backups." >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "Install PostgreSQL client tools." >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
umask 077
export PGPASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/trainfuel-$stamp.dump.age"
pg_dump --format=custom --no-owner --no-acl --host="${POSTGRES_HOST:-localhost}" --port="${POSTGRES_PORT:-5432}" --username="${POSTGRES_USER:?Set POSTGRES_USER}" "${POSTGRES_DB:?Set POSTGRES_DB}" | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$file.partial"
mv "$file.partial" "$file"
find "$BACKUP_DIR" -type f -name 'trainfuel-*.dump.age' -mtime +30 -delete
printf 'Encrypted database backup created: %s\n' "$file"
