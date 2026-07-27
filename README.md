# AI Web Search Agent

**Language:** English | [Українська](./README.uk.md)

MVP tool for AI-assisted product search across the open web. The current focus is Ukrainian marketplaces, Ukrainian fishing stores, and JDM tackle that can be sold either in Ukraine or on international marketplaces.

The tool uses a hybrid agent architecture:

- search providers and direct URLs discover candidate pages;
- an HTTP or browser fetcher opens pages;
- extractors read product lists, `JSON-LD`, meta tags, and visible text;
- ranking filters results by model, brand, price, condition, and source;
- an LLM via OpenRouter or OpenAI can add relevance analysis.

## Quick Start

```bash
npm install
cp .env.example .env
npm run search -- "tict ice cube ic-69p" --limit 10
```

The CLI still works without API keys. It uses fallback HTML search, direct marketplace search pages, and simple HTTP fetching. For better discovery, add one or more provider keys:

- `BRAVE_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `SERPAPI_API_KEY`

## OpenRouter

OpenRouter is the preferred LLM backend for AI analysis. In `.env`:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

List current free text models:

```bash
npm run search -- openrouter models --count 10
```

Select the best free model automatically and write it to `.env`:

```bash
npm run search -- openrouter select-free
```

Preview the selection without editing `.env`:

```bash
npm run search -- openrouter select-free --dry-run
```

## CLI

```bash
npm run search -- doctor
npm run search -- "Shimano Expride 266L"
npm run search -- "Daiwa Steez Real Control 61L" --json
npm run search -- "Megabass Destroyer P5" --max-results 20 --max-pages 10
npm run search -- "спінінг 2.13m 3-12g ML" --source olx,prom,hotline --limit 20
npm run search -- "Shimano Expride 266L" --max-price 8000 --used --source olx,prom --limit 20
npm run search -- "спінінг shimano" --ai --save
npm run search -- "tict ice cube ic-69p" --source olx,prom,ibis --fetch-mode http --limit 10
npm run search -- "shimano scorpion 151 dc" --source zenmarket --human-browser --limit 20
npm run search -- saved add "tict ice cube ic-69p" --name "Tict IC-69P" --source olx,prom --limit 10
npm run search -- saved list
npm run search -- saved run "Tict IC-69P"
npm run search -- saved run "Tict IC-69P" --notify
npm run search -- saved history "Tict IC-69P"
npm run search -- saved export "Tict IC-69P" --format csv --out results/tict-ic-69p.csv
npm run search -- saved watch "Tict IC-69P" --interval-minutes 60 --notify
```

Useful options:

- `--max-results <n>` - number of search candidates to collect.
- `--max-pages <n>` - number of candidate pages to fetch.
- `--fetch-mode <mode>` - `auto`, `http`, `browser`, or `firecrawl`.
- `--human-browser` - open a visible persistent Chromium profile for challenge/login protected sources such as ZenMarket.
- `--max-price <uah>` / `--min-price <uah>` - price filters.
- `--used` / `--new` - product condition filter.
- `--source <list>` - comma-separated source ids, for example `olx,prom,hotline`.
- `--limit <n>` - maximum product results to print.
- `--ai` - enable LLM analysis.
- `--save` - append the run to `results/search-history.jsonl`.
- `--json` - print the full JSON result.

Product results include parsed tackle specs when visible in titles or page text: rod length, lure test, line test, power, reel size, bearings, gear ratio, and handedness. Queries with specs receive ranking boosts for compatible offers and penalties for clear mismatches.

## Saved Searches

Saved searches store a query plus its filters in `results/saved-searches.json` by default. Running a saved search compares the new grouped offers with the previous snapshot and reports new groups, new offers, and price drops. Product groups deduplicate equivalent offer URLs and include source and seller counts.

```bash
npm run search -- saved add "Shimano Expride 266L" --name "Expride 266L" --max-price 8000 --used --source olx,prom
npm run search -- saved list
npm run search -- saved run "Expride 266L"
npm run search -- saved history "Expride 266L"
npm run search -- saved export "Expride 266L" --format csv --out results/expride-266l.csv
npm run search -- saved run --all
npm run search -- saved watch --all --interval-minutes 60 --notify
```

`saved watch` keeps running on the local machine and repeats saved searches on the selected interval. Stop it with `Ctrl+C`.

## Notifications

Saved searches can send alert notifications through Telegram or macOS desktop notifications. They are disabled by default.

```bash
NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DESKTOP_NOTIFICATIONS=false

npm run search -- saved run "Tict IC-69P" --notify
```

`--notify` affects `saved run` and `saved watch`. Without Telegram credentials or desktop notifications enabled, the command still runs normally and reports that no notification provider is configured when alerts exist.

## Local UI

```bash
npm run ui
```

Then open:

```text
http://localhost:8787
```

The UI uses background search jobs in server mode, so long searches can keep running while the browser polls for status.

## Production

Use Docker for production because the app needs Node.js, Chromium/Playwright, and persistent storage.

```bash
cp .env.production.example .env.production
scripts/deploy-prod.sh
```

Runtime data is mounted to `/data` in Docker. Enable `APP_AUTH_ENABLED=true`, set `DOMAIN`, `APP_USERNAME`, and `APP_PASSWORD` before exposing the UI. Full notes: [docs/DEPLOYMENT.uk.md](./docs/DEPLOYMENT.uk.md).

## Running From Codex Or Claude Code

The repository includes [AGENTS.md](./AGENTS.md) with short notes for coding agents. The simplest flow:

```bash
scripts/setup-local.sh
scripts/search.sh "Shimano Expride 266L" --max-price 8000 --used
```

## Sources

Direct discovery generates search URLs for these groups:

- `core_marketplace`: OLX, Rozetka, Prom, Epicentr, Bigl, Allo.
- `price_aggregator`: Hotline, E-Katalog, Price.ua.
- `fishing_store_ua`: Flagman, IBIS Gear, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, Only Fishing, JDM Ukraine.
- `jdm_international`: ZenMarket, Digitaka, JapanTackle, JDM Tackle Heaven, eBay.

Direct/API or list extractors are already supported for OLX, Rozetka, Prom/Bigl, Hotline, Flagman, IBIS, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, E-Katalog, JDM Ukraine, ZenMarket, JapanTackle, and JDM Tackle Heaven. ZenMarket requires human-in-the-loop browser mode when Cloudflare challenges the session.

International JDM sources are added when the query looks like Japanese tackle or JDM search, for example `Shimano`, `Daiwa`, `Megabass`, `Tict`, `Japan`, `JDM`, `Yahoo Auction`, `Mercari`.

## Limitations

The tool does not bypass CAPTCHA, logins, paywalls, or site rules. Those cases need a human-in-the-loop flow, browser workflow, official API, or external extraction provider.

Rozetka product search uses Rozetka JSON APIs where available. ZenMarket returns Cloudflare challenges in simple HTTP mode, so use the persistent human browser flow:

```bash
npm run search -- "shimano scorpion 151 dc" --source zenmarket --human-browser --limit 20
```

The first run opens Chromium. Complete the ZenMarket challenge/login once; cookies are stored in `results/browser-profile` and reused by later runs. Some other stores may still return Cloudflare or rate limits in simple HTTP mode. For those sources, use browser mode:

```bash
BROWSER_HUMAN_IN_LOOP=true BROWSER_HEADLESS=false npm run search -- "query" --fetch-mode browser
```

When human-in-the-loop is enabled, the browser stays visible and waits for manual challenge completion before extraction continues.

## Development

```bash
npm run build
npm run search -- "Shimano Expride 266L" --max-results 8 --max-pages 4 --fetch-mode http
```

Useful files:

- `src/providers/search/marketCatalog.ts` - source list and direct search URL templates.
- `src/providers/search/index.ts` - direct/API search providers.
- `src/extraction/listExtractor.ts` - list extractors for search pages.
- `src/extraction/productExtractor.ts` - single product page extraction.
- `src/ranking/productScoring.ts` - scoring, aliases, and relevance filters.
- `src/openrouter/modelManager.ts` - OpenRouter model listing/selection.
- `src/server.ts` - local UI and API.

A new search provider implements `SearchProvider` in `src/providers/search/types.ts`. A new page fetcher implements `PageFetcher` in `src/fetchers/types.ts`.
