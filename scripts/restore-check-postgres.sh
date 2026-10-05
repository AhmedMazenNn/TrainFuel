#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_FILE:?Set BACKUP_FILE to an encrypted backup file}"
: "${BACKUP_AGE_IDENTITY:?Set BACKUP_AGE_IDENTITY to a protected age identity file}"
command -v age >/dev/null || { echo "Install age before restoring backups." >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "Install PostgreSQL client tools." >&2; exit 1; }
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$BACKUP_FILE" | pg_restore --list >/dev/null
printf 'Encrypted PostgreSQL archive is readable and its table of contents is valid.\n'
