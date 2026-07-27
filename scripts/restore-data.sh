#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/restore-data.sh <backup.tar.gz>" >&2
  exit 2
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_path="$1"
backup_dir="$(cd "$(dirname "$backup_path")" && pwd)"
backup_file="$(basename "$backup_path")"

if [[ ! -f "$backup_dir/$backup_file" ]]; then
  echo "Backup not found: $backup_dir/$backup_file" >&2
  exit 1
fi

docker compose -f "$project_root/docker-compose.yml" stop websearch

docker compose -f "$project_root/docker-compose.yml" run --rm \
  --no-deps \
  -v "$backup_dir:/backup:ro" \
  websearch \
  sh -lc "rm -rf /data/* && tar -xzf /backup/$backup_file -C /data"

docker compose -f "$project_root/docker-compose.yml" up -d websearch
