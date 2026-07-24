# AI Web Search Agent: Coding Agent Notes

Use these commands from the repository root.

## Setup

```bash
scripts/setup-local.sh
```

OpenRouter is the preferred LLM backend. Put this in `.env`:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

OpenRouter uses the OpenAI-compatible endpoint `https://openrouter.ai/api/v1`.

## CLI

```bash
npm run search -- "Shimano Expride 266L" --max-price 8000 --used --source olx,prom --limit 20
npm run search -- "спінінг shimano" --ai --save --limit 30
npm run search -- saved add "Shimano Expride 266L" --name "Expride 266L" --max-price 8000 --used --source olx,prom
npm run search -- saved run "Expride 266L"
npm run search -- openrouter models --count 10
npm run search -- openrouter select-free
```

## Local UI

```bash
npm run ui
```

Open `http://localhost:8787`.

## Validation

```bash
npm run build
npm run search -- "Shimano Expride 266L" --max-results 8 --max-pages 4 --fetch-mode http
```
