#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TruSaaS — Automated Daily Backup Script (Hetzner)
# 
# Preserves all persistent dealership databases, auth records, Imagin8 ledgers,
# and uploaded photos. Keeps 14 rolling daily archives.
# ==============================================================================

BACKUP_ROOT="/var/backups/trusaas"
DATA_ROOT="/var/data/trusaas"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="trusaas_backup_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_ROOT}"

echo "=================================================="
echo "  TruSaaS Backup Started: $(date)"
echo "=================================================="

if [ -d "${DATA_ROOT}" ]; then
  # Create compressed archive of all persistent data
  tar -czf "${BACKUP_ROOT}/${ARCHIVE_NAME}" -C "${DATA_ROOT}" .
  echo "✓ Created archive: ${BACKUP_ROOT}/${ARCHIVE_NAME}"
  
  # Retention: keep last 14 days of backups
  find "${BACKUP_ROOT}" -type f -name "trusaas_backup_*.tar.gz" -mtime +14 -delete
  echo "✓ Rotated backups older than 14 days."
else
  echo "⚠️ Warning: ${DATA_ROOT} does not exist yet. Nothing to archive."
fi

echo "=================================================="
echo "  Backup Completed Successfully."
echo "=================================================="
