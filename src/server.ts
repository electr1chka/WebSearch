import express from "express";
import { loadConfig } from "./config.js";
import { runSearchAgent } from "./agent.js";
import { readSearchHistory, saveSearchRun } from "./storage/history.js";
import type { SearchOptions } from "./types.js";

const app = express();
const config = loadConfig();
const port = Number(process.env.PORT ?? 8787);

app.use(express.json({ limit: "1mb" }));

app.get("/", (_, response) => {
  response.type("html").send(renderPage());
});

app.get("/api/history", async (_, response) => {
  response.json(await readSearchHistory(config.storagePath, 20));
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
    save: Boolean(request.body?.save)
  };

  if (request.body?.maxResults) {
    config.maxResults = Number(request.body.maxResults);
  }

  if (request.body?.maxPages) {
    config.maxPagesToFetch = Number(request.body.maxPages);
  }

  const result = await runSearchAgent(query, config, options);

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
    .grid { display: grid; gap: 10px; }
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
    <div id="status" class="status"></div>
    <section id="results" class="grid"></section>
  </main>
  <script>
    const form = document.querySelector('#search-form');
    const statusEl = document.querySelector('#status');
    const resultsEl = document.querySelector('#results');
    const submit = document.querySelector('#submit');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      statusEl.textContent = 'Пошук...';
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
        statusEl.textContent = 'Знайдено ' + data.products.length + ' товарів за ' + ((Date.now() - started) / 1000).toFixed(1) + ' c';
        resultsEl.innerHTML = data.products.map(renderProduct).join('');
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
    function renderProduct(product) {
      const price = product.price ? product.price + ' ' + (product.currency || '') : 'ціна невідома';
      const ai = product.ai?.summary ? '<div class="muted">' + escapeHtml(product.ai.summary) + '</div>' : '';
      const warnings = product.warnings?.length ? '<div class="muted">Warnings: ' + escapeHtml(product.warnings.join('; ')) + '</div>' : '';
      const evidence = product.evidence?.length ? '<div class="muted">Evidence: ' + escapeHtml(product.evidence.slice(0, 2).join('; ')) + '</div>' : '';
      return '<article class="item"><div><a class="title" href="' + product.url + '" target="_blank" rel="noreferrer">' + escapeHtml(product.title) + '</a><div class="meta"><span class="pill">' + escapeHtml(product.sourceSite || 'source') + '</span><span class="pill">' + escapeHtml(product.matchGrade || 'match') + '</span><span class="pill">rel ' + Number(product.relevanceScore || 0).toFixed(2) + '</span><span class="pill">' + escapeHtml(product.condition || product.availability || 'listed') + '</span></div>' + ai + warnings + evidence + '</div><div class="price">' + escapeHtml(price) + '</div></article>';
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    }
  </script>
</body>
</html>`;
}
