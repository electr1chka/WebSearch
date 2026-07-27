#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${1:-"$project_root/backups"}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_dir/websearch-data-$timestamp.tar.gz"

mkdir -p "$backup_dir"

docker compose -f "$project_root/docker-compose.yml" run --rm \
  --no-deps \
  -v "$backup_dir:/backup" \
  websearch \
  tar -czf "/backup/$(basename "$archive")" -C /data .

echo "$archive"
