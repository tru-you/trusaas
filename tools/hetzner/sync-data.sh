#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TruSaaS — Persistent Data Migration Helper
#
# Usage:
#   ./sync-data.sh export /tmp/trusaas-data.tar.gz
#   ./sync-data.sh import /tmp/trusaas-data.tar.gz
# ==============================================================================

ACTION="${1:-}"
ARCHIVE_PATH="${2:-/tmp/trusaas-data-snapshot.tar.gz}"
DATA_ROOT="/var/data/trusaas"

if [ "$ACTION" == "export" ]; then
  echo "--> Exporting data from ${DATA_ROOT} to ${ARCHIVE_PATH}..."
  mkdir -p "$(dirname "$ARCHIVE_PATH")"
  tar -czf "$ARCHIVE_PATH" -C "$DATA_ROOT" .
  echo "✓ Export complete: $(ls -lh "$ARCHIVE_PATH")"

elif [ "$ACTION" == "import" ]; then
  if [ ! -f "$ARCHIVE_PATH" ]; then
    echo "❌ Error: Archive $ARCHIVE_PATH not found."
    exit 1
  fi
  echo "--> Importing data from ${ARCHIVE_PATH} into ${DATA_ROOT}..."
  mkdir -p "$DATA_ROOT/premium" "$DATA_ROOT/inspect" "$DATA_ROOT/lens"
  tar -xzf "$ARCHIVE_PATH" -C "$DATA_ROOT"
  chmod -R 755 "$DATA_ROOT"
  echo "✓ Import complete. Data restored to ${DATA_ROOT}."

else
  echo "Usage: $0 [export|import] <archive-file-path>"
  exit 1
fi
