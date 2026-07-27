#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$project_root/.env.production" ]]; then
  echo "Missing .env.production. Start with: cp .env.production.example .env.production" >&2
  exit 1
fi

docker compose \
  -f "$project_root/docker-compose.yml" \
  -f "$project_root/docker-compose.prod.yml" \
  --env-file "$project_root/.env.production" \
  up -d --build

docker compose \
  -f "$project_root/docker-compose.yml" \
  -f "$project_root/docker-compose.prod.yml" \
  --env-file "$project_root/.env.production" \
  ps
