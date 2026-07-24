# AI Web Search Agent

MVP інструмента для пошуку товарів у відкритому інтернеті за допомогою AI.

Архітектура зроблена гібридною:

- пошукові API знаходять кандидатів;
- браузерний або HTTP fetcher відкриває сторінки;
- extractor читає `JSON-LD`, meta tags і видимий текст;
- LLM через OpenRouter або OpenAI допомагає аналізувати й нормалізувати товарні дані;
- site-specific адаптери можна додавати пізніше тільки для важливих сайтів.

## Швидкий старт

```bash
npm install
cp .env.example .env
npm run search -- "Shimano Poison Ultima 264UL-S"
```

Без API-ключів CLI спробує fallback-пошук через DuckDuckGo/Bing HTML, прямі пошукові сторінки українських маркетплейсів і простий HTTP fetch. Для кращої якості додайте хоча б один ключ: `EXA_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY` або `SERPAPI_API_KEY`.

Для AI-аналізу використовується OpenRouter:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

Можна автоматично отримати актуальний список безкоштовних моделей і вибрати найкращу:

```bash
npm run search -- openrouter models --count 10
npm run search -- openrouter select-free
```

Команда використовує офіційний OpenRouter Models API з `sort=intelligence-high-to-low`, фільтрує безкоштовні text-моделі й записує вибрану модель у `.env` як `OPENROUTER_MODEL`.

Для JS-heavy сайтів встановіть Chromium для Playwright:

```bash
npx playwright install chromium
```

## Команди

```bash
npm run search -- "Shimano Expride 266L"
npm run search -- "Daiwa Steez Real Control 61L" --json
npm run search -- "Megabass Destroyer P5" --max-results 20 --max-pages 10
npm run search -- "Shimano Expride 266L" --max-price 8000 --used --source olx,prom --limit 20
npm run search -- "спінінг shimano" --ai --save
npm run search -- openrouter models --count 10
npm run search -- openrouter select-free
```

## Локальний UI

```bash
npm run ui
```

Після запуску відкрийте `http://localhost:8787`.

## Запуск із Codex або Claude Code

У репозиторії є [AGENTS.md](./AGENTS.md) з короткими командами для coding agents. Найпростіше:

```bash
scripts/setup-local.sh
scripts/search.sh "Shimano Expride 266L" --max-price 8000 --used
```

## Українські джерела

Direct discovery зараз генерує пошукові URL для таких груп:

- `core_marketplace`: OLX, Rozetka, Prom, Epicentr, Bigl, Allo;
- `price_aggregator`: Hotline, E-Katalog, Price.ua;
- `fishing_store_ua`: Flagman, IBIS Gear, Fish-Fish, Shimano Kiev, Daiwa Ukraine, Zabros, Fanatik, Aquatory, Only Fishing, JDM Ukraine;
- `jdm_international`: ZenMarket, Digitaka, JapanTackle, JDM Tackle Heaven, eBay.

Міжнародні JDM-джерела додаються тільки коли запит схожий на JDM/японську снасть: `Shimano`, `Daiwa`, `Megabass`, `Japan`, `JDM` тощо. Основний дефолт - українські сайти.

## Обмеження

Інструмент не обходить CAPTCHA, логіни, платіжні стіни або правила сайтів. Для таких ситуацій потрібен human-in-the-loop або офіційні API/партнерські канали.

Поточний MVP вже вміє витягувати списки товарів із OLX, Prom/Bigl, Hotline, Zabros та Daiwa Ukraine. Для generated search pages без підтриманого list extractor він не показує випадкову першу ціну зі сторінки. Rozetka через простий HTTP часто віддає Cloudflare challenge, тому для неї потрібен browser/human-in-the-loop режим або зовнішній search/extraction provider.

## Додавання провайдерів

Новий search provider реалізує `SearchProvider` у `src/providers/search/types.ts`.
Новий page fetcher реалізує `PageFetcher` у `src/fetchers/types.ts`.
