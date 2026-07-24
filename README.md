# AI Web Search Agent

## Українською

MVP інструмента для AI-пошуку товарів у відкритому інтернеті. Основний фокус зараз - українські маркетплейси, українські рибальські магазини та JDM-снасті, які можуть продаватися як в Україні, так і на міжнародних майданчиках.

Інструмент працює як гібридний агент:

- пошукові провайдери та прямі URL знаходять кандидатів;
- HTTP або browser fetcher відкриває сторінки;
- extractors читають списки товарів, `JSON-LD`, meta tags і видимий текст;
- ranking фільтрує результати за моделлю, брендом, ціною, станом і джерелом;
- LLM через OpenRouter або OpenAI може додатково аналізувати релевантність.

### Швидкий Старт

```bash
npm install
cp .env.example .env
npm run search -- "tict ice cube ic-69p" --limit 10
```

Без API-ключів CLI все одно працює: використовує fallback HTML-пошук, прямі пошукові сторінки маркетплейсів і простий HTTP fetch. Для кращого discovery можна додати один або кілька ключів:

- `BRAVE_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `SERPAPI_API_KEY`

### OpenRouter

OpenRouter є основним LLM backend для AI-аналізу. У `.env`:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

Подивитися актуальні безкоштовні text-моделі:

```bash
npm run search -- openrouter models --count 10
```

Автоматично вибрати найкращу безкоштовну модель і записати її в `.env`:

```bash
npm run search -- openrouter select-free
```

Перевірити вибір без запису в `.env`:

```bash
npm run search -- openrouter select-free --dry-run
```

### CLI

```bash
npm run search -- "Shimano Expride 266L"
npm run search -- "Daiwa Steez Real Control 61L" --json
npm run search -- "Megabass Destroyer P5" --max-results 20 --max-pages 10
npm run search -- "Shimano Expride 266L" --max-price 8000 --used --source olx,prom --limit 20
npm run search -- "спінінг shimano" --ai --save
npm run search -- "tict ice cube ic-69p" --source olx,prom,ibis --fetch-mode http --limit 10
```

Корисні опції:

- `--max-results <n>` - скільки кандидатів шукати.
- `--max-pages <n>` - скільки сторінок-кандидатів відкривати.
- `--fetch-mode <mode>` - `auto`, `http`, `browser` або `firecrawl`.
- `--max-price <uah>` / `--min-price <uah>` - фільтр ціни.
- `--used` / `--new` - фільтр стану товару.
- `--source <list>` - джерела через кому, наприклад `olx,prom,hotline`.
- `--limit <n>` - максимум товарів у відповіді.
- `--ai` - увімкнути LLM-аналіз.
- `--save` - зберегти запуск у `results/search-history.jsonl`.
- `--json` - вивести повний JSON.

### Локальний UI

```bash
npm run ui
```

Після запуску відкрийте:

```text
http://localhost:8787
```

### Запуск Із Codex Або Claude Code

У репозиторії є [AGENTS.md](./AGENTS.md) з короткими нотатками для coding agents. Найпростіший сценарій:

```bash
scripts/setup-local.sh
scripts/search.sh "Shimano Expride 266L" --max-price 8000 --used
```

### Джерела

Direct discovery генерує пошукові URL для таких груп:

- `core_marketplace`: OLX, Rozetka, Prom, Epicentr, Bigl, Allo.
- `price_aggregator`: Hotline, E-Katalog, Price.ua.
- `fishing_store_ua`: Flagman, IBIS Gear, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, Only Fishing, JDM Ukraine.
- `jdm_international`: ZenMarket, Digitaka, JapanTackle, JDM Tackle Heaven, eBay.

Підтримані direct/API або list extractors вже є для OLX, Prom/Bigl, Hotline, Flagman, IBIS, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, E-Katalog і JDM Ukraine. Для решти джерел агент може знаходити сторінки, але якість extraction залежить від HTML сторінки та доступності сайту.

Міжнародні JDM-джерела додаються, коли запит схожий на японську снасть або JDM-пошук, наприклад `Shimano`, `Daiwa`, `Megabass`, `Tict`, `Japan`, `JDM`, `Yahoo Auction`, `Mercari`.

### Обмеження

Інструмент не обходить CAPTCHA, логіни, платіжні стіни або правила сайтів. Для таких ситуацій потрібен human-in-the-loop, browser workflow, офіційний API або зовнішній extraction provider.

Rozetka та деякі магазини можуть віддавати Cloudflare або rate limit у простому HTTP-режимі. Для них краще пробувати `--fetch-mode browser`, зовнішній провайдер або ручну перевірку знайдених кандидатів.

### Розробка

```bash
npm run build
npm run search -- "Shimano Expride 266L" --max-results 8 --max-pages 4 --fetch-mode http
```

Корисні файли:

- `src/providers/search/marketCatalog.ts` - список джерел і шаблони пошукових URL.
- `src/providers/search/index.ts` - direct/API search providers.
- `src/extraction/listExtractor.ts` - list extractors для сторінок пошуку.
- `src/extraction/productExtractor.ts` - extraction окремої сторінки товару.
- `src/ranking/productScoring.ts` - scoring, aliases і фільтри релевантності.
- `src/openrouter/modelManager.ts` - OpenRouter model listing/selection.
- `src/server.ts` - локальний UI та API.

Новий search provider реалізує `SearchProvider` у `src/providers/search/types.ts`. Новий page fetcher реалізує `PageFetcher` у `src/fetchers/types.ts`.

---

## English

MVP tool for AI-assisted product search across the open web. The current focus is Ukrainian marketplaces, Ukrainian fishing stores, and JDM tackle that can be sold either in Ukraine or on international marketplaces.

The tool uses a hybrid agent architecture:

- search providers and direct URLs discover candidate pages;
- an HTTP or browser fetcher opens pages;
- extractors read product lists, `JSON-LD`, meta tags, and visible text;
- ranking filters results by model, brand, price, condition, and source;
- an LLM via OpenRouter or OpenAI can add relevance analysis.

### Quick Start

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

### OpenRouter

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

### CLI

```bash
npm run search -- "Shimano Expride 266L"
npm run search -- "Daiwa Steez Real Control 61L" --json
npm run search -- "Megabass Destroyer P5" --max-results 20 --max-pages 10
npm run search -- "Shimano Expride 266L" --max-price 8000 --used --source olx,prom --limit 20
npm run search -- "спінінг shimano" --ai --save
npm run search -- "tict ice cube ic-69p" --source olx,prom,ibis --fetch-mode http --limit 10
```

Useful options:

- `--max-results <n>` - number of search candidates to collect.
- `--max-pages <n>` - number of candidate pages to fetch.
- `--fetch-mode <mode>` - `auto`, `http`, `browser`, or `firecrawl`.
- `--max-price <uah>` / `--min-price <uah>` - price filters.
- `--used` / `--new` - product condition filter.
- `--source <list>` - comma-separated source ids, for example `olx,prom,hotline`.
- `--limit <n>` - maximum product results to print.
- `--ai` - enable LLM analysis.
- `--save` - append the run to `results/search-history.jsonl`.
- `--json` - print the full JSON result.

### Local UI

```bash
npm run ui
```

Then open:

```text
http://localhost:8787
```

### Running From Codex Or Claude Code

The repository includes [AGENTS.md](./AGENTS.md) with short notes for coding agents. The simplest flow:

```bash
scripts/setup-local.sh
scripts/search.sh "Shimano Expride 266L" --max-price 8000 --used
```

### Sources

Direct discovery generates search URLs for these groups:

- `core_marketplace`: OLX, Rozetka, Prom, Epicentr, Bigl, Allo.
- `price_aggregator`: Hotline, E-Katalog, Price.ua.
- `fishing_store_ua`: Flagman, IBIS Gear, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, Only Fishing, JDM Ukraine.
- `jdm_international`: ZenMarket, Digitaka, JapanTackle, JDM Tackle Heaven, eBay.

Direct/API or list extractors are already supported for OLX, Prom/Bigl, Hotline, Flagman, IBIS, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, E-Katalog, and JDM Ukraine. For the remaining sources, the agent can still discover pages, but extraction quality depends on page HTML and site accessibility.

International JDM sources are added when the query looks like Japanese tackle or JDM search, for example `Shimano`, `Daiwa`, `Megabass`, `Tict`, `Japan`, `JDM`, `Yahoo Auction`, `Mercari`.

### Limitations

The tool does not bypass CAPTCHA, logins, paywalls, or site rules. Those cases need a human-in-the-loop flow, browser workflow, official API, or external extraction provider.

Rozetka and some stores may return Cloudflare or rate limits in simple HTTP mode. For those sources, try `--fetch-mode browser`, an external provider, or manual verification of discovered candidates.

### Development

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
