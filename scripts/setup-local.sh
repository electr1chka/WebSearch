#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

npm install

echo
echo "Setup complete."
echo "Optional: add OPENROUTER_API_KEY to .env to enable --ai with OPENROUTER_MODEL=openrouter/free."
echo "Run CLI: npm run search -- \"Shimano Expride 266L\" --max-price 8000 --used"
echo "Run UI:  npm run ui"
