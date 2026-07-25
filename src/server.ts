import express from "express";
import { loadConfig } from "./config.js";
import { runSearchAgent } from "./agent.js";
import {
  exportPriceHistoryCsv,
  exportPriceHistoryJson,
  priceHistoryContentType
} from "./export/priceHistoryExport.js";
import { sendSavedSearchNotifications } from "./notifications/notifier.js";
import {
  fetchOpenRouterModels,
  rankFreeTextModels,
  selectBestFreeModel,
  updateEnvFile,
  type RankedOpenRouterModel
} from "./openrouter/modelManager.js";
import { readSearchHistory, saveSearchRun } from "./storage/history.js";
import {
  appendPriceHistoryRecord,
  createPriceHistoryRecord,
  readPriceHistory
} from "./storage/priceHistory.js";
import {
  addSavedSearch,
  compareSavedSearchRun,
  createSnapshot,
  findSavedSearch,
  readSavedSearches,
  updateSavedSearch
} from "./storage/savedSearches.js";
import { renderDashboardPage } from "./ui/page.js";
import { extractProductList } from "./extraction/listExtractor.js";
import { createFetchers, fetchWithFallback } from "./fetchers/index.js";
import type { SavedSearchRuntimeOptions, SearchOptions } from "./types.js";

const app = express();
const config = loadConfig();
const port = Number(process.env.PORT ?? 8787);
let cachedOpenRouterModels: RankedOpenRouterModel[] = [];

app.use(express.json({ limit: "1mb" }));

app.get("/", (_, response) => {
  response.type("html").send(renderDashboardPage());
});

app.get("/api/history", async (_, response) => {
  response.json(await readSearchHistory(config.storagePath, 20));
});

app.get("/api/openrouter/status", (_, response) => {
  response.json({
    provider: config.llmProvider,
    configured: Boolean(config.openRouterApiKey),
    model: config.openRouterModel,
    aiAnalysisEnabled: config.aiAnalysisEnabled
  });
});

app.get("/api/openrouter/free-models", async (request, response) => {
  try {
    const count = numberOrUndefined(request.query.count) ?? 10;
    const refresh = request.query.refresh === "true";

    if (refresh || cachedOpenRouterModels.length === 0) {
      cachedOpenRouterModels = rankFreeTextModels(await fetchOpenRouterModels("intelligence-high-to-low")).slice(0, 10);
    }

    response.json({
      currentModel: config.openRouterModel,
      models: cachedOpenRouterModels.slice(0, count).map(modelSummary)
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "failed to load OpenRouter models" });
  }
});

app.post("/api/openrouter/select-free", async (_, response) => {
  try {
    const best = await selectBestFreeModel("intelligence-high-to-low");
    await updateEnvFile(".env", {
      LLM_PROVIDER: "openrouter",
      OPENROUTER_MODEL: best.id
    });
    config.openRouterModel = best.id;
    config.llmProvider = "openrouter";
    cachedOpenRouterModels = rankFreeTextModels(await fetchOpenRouterModels("intelligence-high-to-low")).slice(0, 10);

    response.json({
      selected: modelSummary(best),
      currentModel: config.openRouterModel,
      models: cachedOpenRouterModels.map(modelSummary)
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "failed to select OpenRouter model" });
  }
});

app.post("/api/openrouter/model", async (request, response) => {
  const model = String(request.body?.model ?? "").trim();

  if (!model) {
    response.status(400).json({ error: "model is required" });
    return;
  }

  await updateEnvFile(".env", {
    LLM_PROVIDER: "openrouter",
    OPENROUTER_MODEL: model
  });
  config.openRouterModel = model;
  config.llmProvider = "openrouter";

  response.json({
    currentModel: config.openRouterModel
  });
});

app.post("/api/zenmarket/prepare", async (request, response) => {
  const query = String(request.body?.query ?? "shimano scorpion 151 dc").trim() || "shimano scorpion 151 dc";
  const url = `https://zenmarket.jp/en/search.aspx?q=${encodeURIComponent(query)}`;
  const runConfig = {
    ...config,
    fetchMode: "auto" as const,
    browserHumanInLoop: true
  };

  try {
    const page = await fetchWithFallback(createFetchers(runConfig), url, runConfig);
    const products = page ? extractProductList(page) : [];

    response.json({
      ok: Boolean(page),
      query,
      url,
      finalUrl: page?.finalUrl,
      title: page?.title,
      fetcher: page?.fetcher,
      status: page?.status,
      products: products.slice(0, 6),
      productCount: products.length
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "failed to prepare ZenMarket" });
  }
});

app.get("/api/saved-searches", async (_, response) => {
  response.json(await readSavedSearches(config.savedSearchesPath));
});

app.post("/api/saved-searches", async (request, response) => {
  const query = String(request.body?.query ?? "").trim();

  if (!query) {
    response.status(400).json({ error: "query is required" });
    return;
  }

  const search = await addSavedSearch(config.savedSearchesPath, {
    name: typeof request.body?.name === "string" ? request.body.name : undefined,
    query,
    options: requestToSavedOptions(request.body)
  });

  response.json(search);
});

app.post("/api/saved-searches/:id/run", async (request, response) => {
  const searches = await readSavedSearches(config.savedSearchesPath);
  const search = findSavedSearch(searches, request.params.id);

  if (!search) {
    response.status(404).json({ error: "saved search not found" });
    return;
  }

  const runConfig = {
    ...config,
    maxResults: search.options.maxResults ?? config.maxResults,
    maxPagesToFetch: search.options.maxPages ?? config.maxPagesToFetch,
    fetchMode: search.options.fetchMode ?? config.fetchMode,
    browserHumanInLoop: search.options.browserHumanInLoop ?? config.browserHumanInLoop
  };
  const result = await runSearchAgent(search.query, runConfig, search.options);
  const alerts = compareSavedSearchRun(search, result);
  const updatedSearch = {
    ...search,
    updatedAt: new Date().toISOString(),
    lastRun: createSnapshot(result)
  };

  await updateSavedSearch(config.savedSearchesPath, updatedSearch);
  await appendPriceHistoryRecord(config.priceHistoryPath, createPriceHistoryRecord(updatedSearch, result.groups, alerts));
  const notifications = await sendSavedSearchNotifications(config, updatedSearch, alerts, result.groups);
  response.json({ search: updatedSearch, alerts, notifications, result });
});

app.get("/api/saved-searches/:id/history", async (request, response) => {
  const searches = await readSavedSearches(config.savedSearchesPath);
  const search = findSavedSearch(searches, request.params.id);

  if (!search) {
    response.status(404).json({ error: "saved search not found" });
    return;
  }

  response.json(await readPriceHistory(config.priceHistoryPath, {
    savedSearchId: search.id,
    limit: numberOrUndefined(request.query.limit) ?? 20
  }));
});

app.get("/api/saved-searches/:id/export", async (request, response) => {
  const searches = await readSavedSearches(config.savedSearchesPath);
  const search = findSavedSearch(searches, request.params.id);

  if (!search) {
    response.status(404).json({ error: "saved search not found" });
    return;
  }

  const format = request.query.format === "json" ? "json" : "csv";
  const records = await readPriceHistory(config.priceHistoryPath, {
    savedSearchId: search.id,
    limit: numberOrUndefined(request.query.limit) ?? 1000
  });
  const content = format === "json" ? exportPriceHistoryJson(records) : exportPriceHistoryCsv(records);
  const safeName = search.name.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/giu, "-").replace(/^-+|-+$/g, "") || search.id;

  response
    .type(priceHistoryContentType(format))
    .setHeader("content-disposition", `attachment; filename="${safeName}-price-history.${format}"`)
    .send(content);
});

app.post("/api/search", async (request, response) => {
  const query = String(request.body?.query ?? "").trim();

  if (!query) {
    response.status(400).json({ error: "query is required" });
    return;
  }

  const options: SearchOptions = {
    maxPrice: numberOrUndefined(request.body?.maxPrice),
    minPrice: numberOrUndefined(request.body?.minPrice),
    condition: request.body?.condition === "new" || request.body?.condition === "used" ? request.body.condition : undefined,
    sources: typeof request.body?.sources === "string" && request.body.sources.trim()
      ? request.body.sources.split(",").map((item: string) => item.trim())
      : undefined,
    productLimit: numberOrUndefined(request.body?.limit),
    ai: Boolean(request.body?.ai),
    save: Boolean(request.body?.save),
    browserHumanInLoop: Boolean(request.body?.browserHumanInLoop)
  };
  const deepSearch = shouldUseDeepSearch(query, options.sources);
  const requestedFetchMode = request.body?.fetchMode === "auto" || request.body?.fetchMode === "http" || request.body?.fetchMode === "browser" || request.body?.fetchMode === "firecrawl"
    ? request.body.fetchMode
    : config.fetchMode;
  const runConfig = {
    ...config,
    maxResults: numberOrUndefined(request.body?.maxResults) ?? (deepSearch ? Math.max(config.maxResults, 220) : config.maxResults),
    maxPagesToFetch: numberOrUndefined(request.body?.maxPages) ?? (deepSearch ? Math.max(config.maxPagesToFetch, 60) : config.maxPagesToFetch),
    fetchMode: (options.browserHumanInLoop || deepSearch) && requestedFetchMode === "http" ? "auto" : requestedFetchMode,
    browserHumanInLoop: options.browserHumanInLoop || config.browserHumanInLoop,
    browserHeadless: options.browserHumanInLoop ? config.browserHeadless : true
  };

  const result = await runSearchAgent(query, runConfig, options);

  if (options.save) {
    await saveSearchRun(config.storagePath, query, result);
  }

  response.json(result);
});

app.listen(port, () => {
  console.log(`AI Web Search Agent UI: http://localhost:${port}`);
});

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function shouldUseDeepSearch(query: string, sources?: string[]): boolean {
  const sourceText = (sources ?? []).join(",").toLowerCase();

  return (
    /(?:zenmarket|jdm|japantackle|jdmtackleheaven|digitaka|ebay)/i.test(sourceText) ||
    /\b(?:jdm|japan|japanese|shimano|daiwa|megabass|evergreen|tenryu|graphiteleader|yamaga|zenaq|tict|ice\s?cube|twin\s?power|stella|vanquish|stradic|scorpion|metanium|aldebaran|calcutta|curado|bantam|certate|exist)\b/i.test(query)
  );
}

function requestToSavedOptions(body: Record<string, unknown>): SavedSearchRuntimeOptions {
  return {
    maxPrice: numberOrUndefined(body?.maxPrice),
    minPrice: numberOrUndefined(body?.minPrice),
    condition: body?.condition === "new" || body?.condition === "used" ? body.condition : undefined,
    sources: typeof body?.sources === "string" && body.sources.trim()
      ? body.sources.split(",").map((item: string) => item.trim())
      : undefined,
    productLimit: numberOrUndefined(body?.limit),
    maxResults: numberOrUndefined(body?.maxResults),
    maxPages: numberOrUndefined(body?.maxPages),
    fetchMode: body?.fetchMode === "auto" || body?.fetchMode === "http" || body?.fetchMode === "browser" || body?.fetchMode === "firecrawl"
      ? body.fetchMode
      : undefined,
    browserHumanInLoop: Boolean(body?.browserHumanInLoop),
    ai: Boolean(body?.ai),
    save: true
  };
}

function modelSummary(model: RankedOpenRouterModel): Record<string, string | number | undefined> {
  return {
    id: model.id,
    name: model.name,
    context: model.context_length ?? model.top_provider?.context_length ?? 0,
    maxOutput: model.top_provider?.max_completion_tokens ?? 0,
    score: model.localScore,
    reason: model.selectionReason
  };
}

function renderPage(): string {
  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Web Search Agent</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #1f2933; }
    header { background: #fff; border-bottom: 1px solid #d8dee6; padding: 18px 24px; }
    main { max-width: 1180px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 20px; margin: 0; font-weight: 650; }
    form { display: grid; grid-template-columns: minmax(240px, 1fr) repeat(4, minmax(120px, 160px)); gap: 10px; align-items: end; background: #fff; border: 1px solid #d8dee6; padding: 14px; border-radius: 8px; }
    label { display: grid; gap: 5px; font-size: 12px; color: #52606d; }
    input, select, button { min-height: 36px; border: 1px solid #cbd2d9; border-radius: 6px; padding: 0 10px; font: inherit; background: #fff; }
    button { background: #1f7a5c; color: #fff; border-color: #1f7a5c; cursor: pointer; font-weight: 600; }
    button:disabled { opacity: .65; cursor: wait; }
    .toggles { display: flex; align-items: center; gap: 14px; min-height: 36px; color: #334e68; }
    .toggles label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #334e68; }
    .status { margin: 14px 0; color: #52606d; min-height: 22px; }
    .panel { margin-top: 14px; background: #fff; border: 1px solid #d8dee6; border-radius: 8px; padding: 12px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .panel h2 { font-size: 15px; margin: 0; }
    .saved-list { display: grid; gap: 8px; }
    .saved-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; border-top: 1px solid #eef2f6; padding-top: 8px; }
    .saved-actions { display: flex; gap: 8px; }
    .secondary { background: #fff; color: #1f7a5c; border-color: #9ac4b6; }
    .button-link { min-height: 34px; display: inline-flex; align-items: center; border: 1px solid #9ac4b6; border-radius: 6px; padding: 0 10px; color: #1f7a5c; text-decoration: none; font-weight: 600; }
    .history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .history-table th, .history-table td { border-top: 1px solid #eef2f6; padding: 7px 6px; text-align: left; vertical-align: top; }
    .history-table th { color: #52606d; font-weight: 600; }
    .grid { display: grid; gap: 10px; }
    .groups { margin-bottom: 14px; }
    .group { background: #fff; border: 1px solid #cbd2d9; border-left: 4px solid #1f7a5c; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: 1fr auto; gap: 12px; }
    .item { background: #fff; border: 1px solid #d8dee6; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: 1fr auto; gap: 12px; }
    .title { font-weight: 650; color: #102a43; text-decoration: none; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 7px; color: #52606d; font-size: 13px; }
    .pill { background: #eef2f6; border-radius: 999px; padding: 3px 8px; }
    .price { font-weight: 700; color: #0b6b4b; white-space: nowrap; }
    .muted { color: #7b8794; }
    @media (max-width: 860px) { form { grid-template-columns: 1fr 1fr; } .item { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { form { grid-template-columns: 1fr; } main { padding: 12px; } }
  </style>
</head>
<body>
  <header><h1>AI Web Search Agent</h1></header>
  <main>
    <form id="search-form">
      <label>Запит <input id="query" name="query" value="Shimano Expride 266L" autocomplete="off" /></label>
      <label>Макс. ціна <input id="maxPrice" name="maxPrice" type="number" min="0" placeholder="8000" /></label>
      <label>Джерела <input id="sources" name="sources" placeholder="olx,prom" /></label>
      <label>Стан <select id="condition" name="condition"><option value="">будь-який</option><option value="used">б/в</option><option value="new">новий</option></select></label>
      <button id="submit" type="submit">Шукати</button>
      <label>Кандидати <input id="maxResults" name="maxResults" type="number" min="1" value="12" /></label>
      <label>Сторінки <input id="maxPages" name="maxPages" type="number" min="1" value="8" /></label>
      <label>Ліміт <input id="limit" name="limit" type="number" min="1" value="30" /></label>
      <div class="toggles">
        <label><input id="ai" type="checkbox" /> AI</label>
        <label><input id="save" type="checkbox" checked /> save</label>
      </div>
    </form>
    <section class="panel">
      <div class="panel-head">
        <h2>Saved searches</h2>
        <div class="saved-actions">
          <button id="save-current" class="secondary" type="button">Зберегти поточний</button>
          <button id="refresh-saved" class="secondary" type="button">Оновити</button>
        </div>
      </div>
      <div id="saved-list" class="saved-list"></div>
      <div id="price-history"></div>
    </section>
    <div id="status" class="status"></div>
    <section id="groups" class="grid groups"></section>
    <section id="results" class="grid"></section>
  </main>
  <script>
    const form = document.querySelector('#search-form');
    const statusEl = document.querySelector('#status');
    const groupsEl = document.querySelector('#groups');
    const resultsEl = document.querySelector('#results');
    const savedListEl = document.querySelector('#saved-list');
    const historyEl = document.querySelector('#price-history');
    const submit = document.querySelector('#submit');
    document.querySelector('#refresh-saved').addEventListener('click', loadSavedSearches);
    document.querySelector('#save-current').addEventListener('click', saveCurrentSearch);
    loadSavedSearches();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      statusEl.textContent = 'Пошук...';
      groupsEl.innerHTML = '';
      resultsEl.innerHTML = '';
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.ai = document.querySelector('#ai').checked;
      payload.save = document.querySelector('#save').checked;
      const started = Date.now();
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'search failed');
        const groupCount = data.groups?.length || 0;
        statusEl.textContent = 'Знайдено ' + data.products.length + ' товарів' + (groupCount ? ' у ' + groupCount + ' групах' : '') + ' за ' + ((Date.now() - started) / 1000).toFixed(1) + ' c';
        groupsEl.innerHTML = (data.groups || []).map(renderGroup).join('');
        resultsEl.innerHTML = data.products.map(renderProduct).join('');
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
    async function saveCurrentSearch() {
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.ai = document.querySelector('#ai').checked;
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        statusEl.textContent = data.error || 'save failed';
        return;
      }
      statusEl.textContent = 'Збережено: ' + data.name;
      await loadSavedSearches();
    }
    async function loadSavedSearches() {
      const response = await fetch('/api/saved-searches');
      const searches = await response.json();
      savedListEl.innerHTML = searches.length ? searches.map(renderSavedSearch).join('') : '<div class="muted">Немає збережених пошуків</div>';
      savedListEl.querySelectorAll('[data-run]').forEach((button) => {
        button.addEventListener('click', () => runSavedSearch(button.getAttribute('data-run')));
      });
      savedListEl.querySelectorAll('[data-history]').forEach((button) => {
        button.addEventListener('click', () => loadPriceHistory(button.getAttribute('data-history')));
      });
    }
    async function runSavedSearch(id) {
      statusEl.textContent = 'Перевірка saved search...';
      groupsEl.innerHTML = '';
      resultsEl.innerHTML = '';
      const response = await fetch('/api/saved-searches/' + encodeURIComponent(id) + '/run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        statusEl.textContent = data.error || 'run failed';
        return;
      }
      const alertText = data.alerts.length ? ' alerts: ' + data.alerts.length : '';
      const notificationCount = (data.notifications || []).filter((item) => item.ok).length;
      const notificationText = notificationCount ? ' notifications: ' + notificationCount : '';
      statusEl.textContent = 'Saved search: ' + data.search.name + alertText + notificationText;
      groupsEl.innerHTML = (data.result.groups || []).map(renderGroup).join('');
      resultsEl.innerHTML = data.result.products.map(renderProduct).join('');
      await loadSavedSearches();
    }
    async function loadPriceHistory(id) {
      const response = await fetch('/api/saved-searches/' + encodeURIComponent(id) + '/history');
      const data = await response.json();
      if (!response.ok) {
        statusEl.textContent = data.error || 'history failed';
        return;
      }
      historyEl.innerHTML = renderHistoryTable(data);
    }
    function renderSavedSearch(search) {
      const lastRun = search.lastRun ? ' · ' + new Date(search.lastRun.timestamp).toLocaleString() : '';
      return '<div class="saved-row"><div><strong>' + escapeHtml(search.name) + '</strong><div class="muted">' + escapeHtml(search.query) + lastRun + '</div></div><div class="saved-actions"><button class="secondary" type="button" data-history="' + escapeHtml(search.id) + '">History</button><a class="button-link" href="/api/saved-searches/' + encodeURIComponent(search.id) + '/export?format=csv">CSV</a><a class="button-link" href="/api/saved-searches/' + encodeURIComponent(search.id) + '/export?format=json">JSON</a><button class="secondary" type="button" data-run="' + escapeHtml(search.id) + '">Run</button></div></div>';
    }
    function renderHistoryTable(records) {
      if (!records.length) return '<div class="muted">Історії ще немає</div>';
      const rows = records.map((record) => {
        const cheapest = cheapestHistoryGroup(record);
        const price = cheapest ? formatHistoryPrice(cheapest) : '';
        return '<tr><td>' + escapeHtml(new Date(record.timestamp).toLocaleString()) + '</td><td>' + escapeHtml(String(record.groups.length)) + '</td><td>' + escapeHtml(String(record.alerts.length)) + '</td><td>' + escapeHtml(cheapest?.label || '') + '</td><td>' + escapeHtml(price) + '</td></tr>';
      }).join('');
      return '<table class="history-table"><thead><tr><th>Дата</th><th>Групи</th><th>Alerts</th><th>Найдешевша група</th><th>Ціна</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    function renderGroup(group) {
      const price = formatPriceRange(group);
      const sources = group.sources?.length ? group.sources.join(', ') : 'source';
      const sellerCount = group.sellerCount ? String(group.sellerCount) + ' продав.' : '';
      const specs = formatSpecs(group.specs);
      const bestUrl = group.bestOffer?.url || '#';
      return '<article class="group"><div><a class="title" href="' + bestUrl + '" target="_blank" rel="noreferrer">' + escapeHtml(group.label) + '</a><div class="meta"><span class="pill">' + group.offerCount + ' проп.</span>' + (sellerCount ? '<span class="pill">' + escapeHtml(sellerCount) + '</span>' : '') + (specs ? '<span class="pill">' + escapeHtml(specs) + '</span>' : '') + '<span class="pill">' + escapeHtml(sources) + '</span></div></div><div class="price">' + escapeHtml(price || '') + '</div></article>';
    }
    function renderProduct(product) {
      const price = product.price ? product.price + ' ' + (product.currency || '') : 'ціна невідома';
      const ai = product.ai?.summary ? '<div class="muted">' + escapeHtml(product.ai.summary) + '</div>' : '';
      const warnings = product.warnings?.length ? '<div class="muted">Warnings: ' + escapeHtml(product.warnings.join('; ')) + '</div>' : '';
      const evidence = product.evidence?.length ? '<div class="muted">Evidence: ' + escapeHtml(product.evidence.slice(0, 2).join('; ')) + '</div>' : '';
      const specs = formatSpecs(product.specs);
      return '<article class="item"><div><a class="title" href="' + product.url + '" target="_blank" rel="noreferrer">' + escapeHtml(product.title) + '</a><div class="meta"><span class="pill">' + escapeHtml(product.sourceSite || 'source') + '</span><span class="pill">' + escapeHtml(product.matchGrade || 'match') + '</span><span class="pill">rel ' + Number(product.relevanceScore || 0).toFixed(2) + '</span><span class="pill">' + escapeHtml(product.condition || product.availability || 'listed') + '</span>' + (specs ? '<span class="pill">' + escapeHtml(specs) + '</span>' : '') + '</div>' + ai + warnings + evidence + '</div><div class="price">' + escapeHtml(price) + '</div></article>';
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    }
    function formatPriceRange(group) {
      if (!group.minPrice && !group.maxPrice) return '';
      const currency = group.currency || '';
      if (group.minPrice === group.maxPrice) return (group.minPrice + ' ' + currency).trim();
      return ((group.minPrice || '?') + '-' + (group.maxPrice || '?') + ' ' + currency).trim();
    }
    function cheapestHistoryGroup(record) {
      return (record.groups || []).filter((group) => group.minPrice !== undefined).sort((a, b) => a.minPrice - b.minPrice)[0];
    }
    function formatHistoryPrice(group) {
      const currency = group.currency || '';
      if (group.minPrice === group.maxPrice) return (group.minPrice + ' ' + currency).trim();
      return ((group.minPrice || '?') + '-' + (group.maxPrice || '?') + ' ' + currency).trim();
    }
    function formatSpecs(specs) {
      if (!specs) return '';
      const parts = [
        specs.rodLengthM ? Number(specs.rodLengthM).toFixed(2).replace(/\\.00$/, '') + 'm' : '',
        specs.lureMaxG !== undefined ? ((specs.lureMinG !== undefined ? specs.lureMinG + '-' : '') + specs.lureMaxG + 'g') : '',
        specs.lineMaxLb !== undefined ? ((specs.lineMinLb !== undefined ? specs.lineMinLb + '-' : '') + specs.lineMaxLb + 'lb') : '',
        specs.power || '',
        specs.reelSize ? 'size ' + specs.reelSize : '',
        specs.gearRatio || '',
        specs.bearings || '',
        specs.handedness || ''
      ].filter(Boolean);
      return parts.join(' | ');
    }
  </script>
</body>
</html>`;
}
