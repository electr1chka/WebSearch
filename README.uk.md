# AI Web Search Agent

**Мова:** [English](./README.md) | Українська

MVP інструмента для AI-пошуку товарів у відкритому інтернеті. Основний фокус зараз - українські маркетплейси, українські рибальські магазини та JDM-снасті, які можуть продаватися як в Україні, так і на міжнародних майданчиках.

Інструмент працює як гібридний агент:

- пошукові провайдери та прямі URL знаходять кандидатів;
- HTTP або browser fetcher відкриває сторінки;
- extractors читають списки товарів, `JSON-LD`, meta tags і видимий текст;
- ranking фільтрує результати за моделлю, брендом, ціною, станом і джерелом;
- LLM через OpenRouter або OpenAI може додатково аналізувати релевантність.

## Швидкий Старт

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

## OpenRouter

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

Корисні опції:

- `--max-results <n>` - скільки кандидатів шукати.
- `--max-pages <n>` - скільки сторінок-кандидатів відкривати.
- `--fetch-mode <mode>` - `auto`, `http`, `browser` або `firecrawl`.
- `--human-browser` - відкрити видимий persistent Chromium-профіль для джерел із challenge/login, зокрема ZenMarket.
- `--max-price <uah>` / `--min-price <uah>` - фільтр ціни.
- `--used` / `--new` - фільтр стану товару.
- `--source <list>` - джерела через кому, наприклад `olx,prom,hotline`.
- `--limit <n>` - максимум товарів у відповіді.
- `--ai` - увімкнути LLM-аналіз.
- `--save` - зберегти запуск у `results/search-history.jsonl`.
- `--json` - вивести повний JSON.

Результати містять розпізнані характеристики снастей, якщо вони є в назві або тексті сторінки: довжина вудилища, тест по приманці, тест по шнуру, power, розмір котушки, підшипники, передатка і рука. Запити з характеристиками отримують бонус у ranking для сумісних оферів і штраф для явних невідповідностей.

## Збережені Пошуки

Збережені пошуки тримають запит і фільтри в `results/saved-searches.json` за замовчуванням. Запуск saved search порівнює нові згруповані офери з попереднім snapshot і показує нові групи, нові офери та падіння ціни. Групи товарів дедуплять еквівалентні URL оферів і показують кількість джерел та продавців.

```bash
npm run search -- saved add "Shimano Expride 266L" --name "Expride 266L" --max-price 8000 --used --source olx,prom
npm run search -- saved list
npm run search -- saved run "Expride 266L"
npm run search -- saved history "Expride 266L"
npm run search -- saved export "Expride 266L" --format csv --out results/expride-266l.csv
npm run search -- saved run --all
npm run search -- saved watch --all --interval-minutes 60 --notify
```

`saved watch` постійно працює на локальному ПК і повторює saved searches з вибраним інтервалом. Зупинка: `Ctrl+C`.

## Сповіщення

Saved searches можуть відправляти alerts у Telegram або як desktop notification на macOS. За замовчуванням це вимкнено.

```bash
NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DESKTOP_NOTIFICATIONS=false

npm run search -- saved run "Tict IC-69P" --notify
```

`--notify` працює для `saved run` і `saved watch`. Якщо Telegram або desktop provider не налаштований, команда все одно виконається і повідомить, що немає configured providers, коли є alerts.

## Локальний UI

```bash
npm run ui
```

Після запуску відкрийте:

```text
http://localhost:8787
```

У server mode UI запускає пошук як background job, тому довгі пошуки можуть виконуватись, поки браузер опитує статус.

## Production

Для production використовуйте Docker, бо застосунку потрібні Node.js, Chromium/Playwright і persistent storage.

```bash
cp .env.production.example .env.production
scripts/deploy-prod.sh
```

Runtime-дані монтуються в `/data` всередині Docker. Перед публічним доступом увімкніть `APP_AUTH_ENABLED=true`, задайте `DOMAIN`, `APP_USERNAME` і `APP_PASSWORD`. Повна інструкція: [docs/DEPLOYMENT.uk.md](./docs/DEPLOYMENT.uk.md).

## Запуск Із Codex Або Claude Code

У репозиторії є [AGENTS.md](./AGENTS.md) з короткими нотатками для coding agents. Найпростіший сценарій:

```bash
scripts/setup-local.sh
scripts/search.sh "Shimano Expride 266L" --max-price 8000 --used
```

## Джерела

Direct discovery генерує пошукові URL для таких груп:

- `core_marketplace`: OLX, Rozetka, Prom, Epicentr, Bigl, Allo.
- `price_aggregator`: Hotline, E-Katalog, Price.ua.
- `fishing_store_ua`: Flagman, IBIS Gear, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, Only Fishing, JDM Ukraine.
- `jdm_international`: ZenMarket, Digitaka, JapanTackle, JDM Tackle Heaven, eBay.

Підтримані direct/API або list extractors вже є для OLX, Rozetka, Prom/Bigl, Hotline, Flagman, IBIS, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, E-Katalog, JDM Ukraine, ZenMarket, JapanTackle і JDM Tackle Heaven. ZenMarket потребує human-in-the-loop browser mode, коли Cloudflare ставить challenge для сесії.

Міжнародні JDM-джерела додаються, коли запит схожий на японську снасть або JDM-пошук, наприклад `Shimano`, `Daiwa`, `Megabass`, `Tict`, `Japan`, `JDM`, `Yahoo Auction`, `Mercari`.

## Обмеження

Інструмент не обходить CAPTCHA, логіни, платіжні стіни або правила сайтів. Для таких ситуацій потрібен human-in-the-loop, browser workflow, офіційний API або зовнішній extraction provider.

Пошук товарів Rozetka використовує JSON API, коли це можливо. ZenMarket у простому HTTP-режимі віддає Cloudflare challenge, тому для нього використовуйте persistent human browser flow:

```bash
npm run search -- "shimano scorpion 151 dc" --source zenmarket --human-browser --limit 20
```

Перший запуск відкриває Chromium. Один раз пройдіть ZenMarket challenge/login; cookies зберігаються в `results/browser-profile` і перевикористовуються наступними запусками. Деякі інші магазини теж можуть віддавати Cloudflare або rate limit у простому HTTP-режимі. Для них можна увімкнути browser mode:

```bash
BROWSER_HUMAN_IN_LOOP=true BROWSER_HEADLESS=false npm run search -- "query" --fetch-mode browser
```

Коли human-in-the-loop увімкнений, браузер відкривається видимо і чекає ручного проходження challenge перед продовженням extraction.

## Розробка

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
