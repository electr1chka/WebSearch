#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/search.sh \"query\" [extra CLI options]"
  exit 1
fi

npm run search -- "$@"
