export function renderDashboardPage(): string {
  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Web Search Agent</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #f3f5f7;
      --panel: #ffffff;
      --line: #d8e0e8;
      --line-strong: #b9c6d3;
      --text: #18232f;
      --muted: #657385;
      --soft: #eef3f7;
      --primary: #176b5b;
      --primary-dark: #105343;
      --blue: #285f9f;
      --amber: #8a5a13;
      --danger: #a33939;
      --radius: 8px;
    }
    * { box-sizing: border-box; }
    html, body { max-width: 100%; overflow-x: hidden; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    header { background: var(--panel); border-bottom: 1px solid var(--line); }
    .topbar { width: 100%; max-width: 1280px; margin: 0 auto; padding: 16px 22px; display: flex; justify-content: space-between; gap: 18px; align-items: center; }
    h1 { font-size: 21px; margin: 0; letter-spacing: 0; }
    .top-status { min-width: 0; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
    main { width: 100%; max-width: 1280px; margin: 0 auto; padding: 18px 22px 36px; display: grid; gap: 14px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 440px); gap: 14px; align-items: start; }
    .layout > *, .search-row > *, .filter-row > *, .advanced-grid > *, .model-actions > *, .model-select-row > *, .panel-head > * { min-width: 0; }
    .panel, .result-item, .group-item, .saved-row { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
    .panel { min-width: 0; padding: 14px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .panel-title { margin: 0; font-size: 16px; font-weight: 700; }
    .subtle { color: var(--muted); font-size: 13px; }
    form { display: grid; gap: 12px; }
    .search-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(120px, 155px) minmax(135px, 170px); gap: 10px; align-items: end; }
    .filter-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(135px, 170px); gap: 10px; align-items: end; }
    label { display: grid; gap: 5px; font-size: 12px; color: var(--muted); font-weight: 650; }
    input, select, button { width: 100%; min-width: 0; max-width: 100%; min-height: 38px; border: 1px solid var(--line-strong); border-radius: 7px; padding: 0 10px; font: inherit; background: #fff; color: var(--text); }
    input:focus, select:focus { outline: 2px solid rgba(40, 95, 159, .18); border-color: var(--blue); }
    button { display: inline-flex; align-items: center; justify-content: center; border-color: var(--primary); background: var(--primary); color: #fff; font-weight: 700; cursor: pointer; line-height: 1.2; text-align: center; white-space: normal; }
    .panel-head > button { width: auto; flex: 0 0 auto; }
    button:hover { background: var(--primary-dark); }
    button:disabled { opacity: .65; cursor: wait; }
    .secondary { background: #fff; color: var(--primary); border-color: #8bbdad; }
    .secondary:hover { background: #edf7f4; }
    .quiet { background: var(--soft); color: var(--text); border-color: var(--line); }
    .quiet:hover { background: #e3ebf2; }
    .danger-text { color: var(--danger); }
    .primary-action { min-height: 42px; font-size: 16px; }
    .toggle-row { grid-column: 1 / -1; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding-top: 2px; }
    .check { display: inline-flex; align-items: center; gap: 7px; color: var(--text); font-size: 14px; font-weight: 600; }
    .check input { min-height: auto; width: 17px; height: 17px; flex: 0 0 auto; }
    .source-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
    .chip { width: auto; min-height: 28px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--soft); color: var(--text); font-size: 12px; font-weight: 650; flex: 0 0 auto; }
    .chip:hover { background: #dfeaf2; }
    details { border-top: 1px solid var(--line); padding-top: 10px; }
    summary { cursor: pointer; color: var(--blue); font-weight: 700; font-size: 13px; }
    .advanced-grid { margin-top: 10px; display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; }
    .hint { color: var(--muted); font-size: 11px; font-weight: 500; line-height: 1.35; }
    .model-panel { display: grid; gap: 10px; }
    .model-current { border: 1px solid var(--line); background: #f9fbfc; border-radius: var(--radius); padding: 10px; display: grid; gap: 4px; }
    .model-name { font-weight: 750; overflow-wrap: anywhere; }
    .model-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .model-select-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(96px, auto); gap: 8px; }
    #model-select { overflow: hidden; text-overflow: ellipsis; }
    .status { min-height: 22px; color: var(--muted); font-size: 14px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .metric { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; }
    .metric strong { display: block; font-size: 18px; }
    .metric span { color: var(--muted); font-size: 12px; }
    .section-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .groups { display: grid; gap: 8px; }
    .group-item { border-left: 4px solid var(--primary); padding: 11px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
    .result-item { padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; }
    .title { color: #10283e; font-weight: 750; text-decoration: none; overflow-wrap: anywhere; }
    .title:hover { text-decoration: underline; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
    .pill { background: var(--soft); border: 1px solid transparent; border-radius: 999px; padding: 3px 8px; font-size: 12px; color: #33475b; }
    .pill-blue { background: #e8f0fb; color: var(--blue); }
    .pill-amber { background: #fff4df; color: var(--amber); }
    .price { font-weight: 800; color: var(--primary-dark); white-space: nowrap; }
    .saved-list { display: grid; gap: 8px; }
    .saved-row { padding: 10px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
    .saved-actions { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
    .saved-actions button { width: auto; }
    .button-link { min-height: 34px; display: inline-flex; align-items: center; border: 1px solid #8bbdad; border-radius: 7px; padding: 0 10px; color: var(--primary); text-decoration: none; font-weight: 700; background: #fff; }
    .history-table { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    .history-table th, .history-table td { border-top: 1px solid var(--line); padding: 8px 7px; text-align: left; vertical-align: top; }
    .history-table th { color: var(--muted); font-weight: 700; background: #f8fafc; }
    @media (max-width: 1120px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .topbar { align-items: flex-start; flex-direction: column; gap: 6px; }
      .top-status { justify-content: flex-start; }
      .search-row, .filter-row, .advanced-grid, .metrics { grid-template-columns: 1fr; }
      .model-actions, .model-select-row { grid-template-columns: 1fr; }
      .toggle-row { border-top: 1px solid var(--line); padding-top: 10px; }
    }
    @media (max-width: 620px) {
      main, .topbar { padding-left: 12px; padding-right: 12px; }
      .result-item, .group-item, .saved-row { grid-template-columns: 1fr; }
      .price { white-space: normal; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <h1>AI Web Search Agent</h1>
      <div class="top-status">
        <span id="model-topline">Модель: завантаження...</span>
      </div>
    </div>
  </header>
  <main>
    <div class="layout">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Пошук товарів</h2>
            <div class="subtle">Введи модель, характеристики або опис потрібної речі.</div>
          </div>
        </div>
        <form id="search-form">
          <div class="search-row">
            <label>Що шукаємо
              <input id="query" name="query" value="Shimano Expride 266L" autocomplete="off" />
            </label>
            <label>Бюджет до, грн
              <input id="maxPrice" name="maxPrice" type="number" min="0" placeholder="8000" />
            </label>
            <button id="submit" class="primary-action" type="submit">Шукати</button>
          </div>
          <div class="filter-row">
            <label>Джерела
              <input id="sources" name="sources" placeholder="olx,prom,rozetka" />
              <div class="source-chips">
                <button class="chip" type="button" data-sources="olx,prom">OLX + Prom</button>
                <button class="chip" type="button" data-sources="rozetka">Rozetka</button>
                <button class="chip" type="button" data-sources="flagman,ibis,fish-fish,shimano-kiev">Риболовні</button>
                <button class="chip" type="button" data-sources="jdm-com-ua,ibis,fish-fish,zenmarket,digitaka,japantackle,jdmtackleheaven,ebay">JDM</button>
                <button class="chip" type="button" data-sources="">Усі</button>
              </div>
            </label>
            <label>Стан
              <select id="condition" name="condition">
                <option value="">будь-який</option>
                <option value="used">б/в</option>
                <option value="new">новий</option>
              </select>
            </label>
            <div class="toggle-row">
              <label class="check"><input id="ai" type="checkbox" /> AI-аналіз</label>
              <label class="check"><input id="save" type="checkbox" checked /> зберегти запуск</label>
            </div>
          </div>
          <details>
            <summary>Розширені параметри пошуку</summary>
            <div class="advanced-grid">
              <label>Ширина пошуку
                <input id="maxResults" name="maxResults" type="number" min="1" value="24" />
                <span class="hint">Скільки потенційних результатів зібрати з пошуку.</span>
              </label>
              <label>Сторінок відкрити
                <input id="maxPages" name="maxPages" type="number" min="1" value="12" />
                <span class="hint">Скільки знайдених сторінок реально перевірити.</span>
              </label>
              <label>Товарів показати
                <input id="limit" name="limit" type="number" min="1" value="30" />
                <span class="hint">Максимум товарів у відповіді.</span>
              </label>
              <label>Режим відкриття
                <select id="fetchMode" name="fetchMode">
                  <option value="auto">auto</option>
                  <option value="http">http</option>
                  <option value="browser">browser</option>
                  <option value="firecrawl">firecrawl</option>
                </select>
                <span class="hint">Auto сам обирає швидкий або браузерний режим.</span>
              </label>
            </div>
          </details>
        </form>
      </section>

      <aside class="panel model-panel">
        <div class="panel-head">
          <h2 class="panel-title">AI-модель</h2>
          <button id="refresh-models" class="quiet" type="button">Оновити топ 10</button>
        </div>
        <div class="model-current">
          <span class="subtle">Поточна модель OpenRouter</span>
          <span id="current-model" class="model-name">завантаження...</span>
          <span id="model-state" class="subtle"></span>
        </div>
        <div class="model-actions">
          <button id="auto-model" type="button">Автопідібрати найкращу free</button>
          <button id="load-models" class="secondary" type="button">Показати топ</button>
        </div>
        <div class="model-select-row">
          <select id="model-select">
            <option value="">Топ free моделей ще не завантажений</option>
          </select>
          <button id="set-model" class="secondary" type="button">Вибрати</button>
        </div>
        <div id="model-note" class="subtle"></div>
      </aside>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Збережені пошуки</h2>
        <div class="saved-actions">
          <button id="save-current" class="secondary" type="button">Зберегти поточний</button>
          <button id="refresh-saved" class="quiet" type="button">Оновити</button>
        </div>
      </div>
      <div id="saved-list" class="saved-list"></div>
      <div id="price-history"></div>
    </section>

    <div id="status" class="status"></div>
    <section class="metrics" id="metrics"></section>
    <section id="groups" class="section-grid"></section>
    <section id="results" class="section-grid"></section>
  </main>
  <script>
    const form = document.querySelector('#search-form');
    const statusEl = document.querySelector('#status');
    const groupsEl = document.querySelector('#groups');
    const resultsEl = document.querySelector('#results');
    const metricsEl = document.querySelector('#metrics');
    const savedListEl = document.querySelector('#saved-list');
    const historyEl = document.querySelector('#price-history');
    const submit = document.querySelector('#submit');
    const currentModelEl = document.querySelector('#current-model');
    const modelToplineEl = document.querySelector('#model-topline');
    const modelStateEl = document.querySelector('#model-state');
    const modelSelectEl = document.querySelector('#model-select');
    const modelNoteEl = document.querySelector('#model-note');

    document.querySelector('#refresh-saved').addEventListener('click', loadSavedSearches);
    document.querySelector('#save-current').addEventListener('click', saveCurrentSearch);
    document.querySelector('#load-models').addEventListener('click', () => loadModels(false));
    document.querySelector('#refresh-models').addEventListener('click', () => loadModels(true));
    document.querySelector('#auto-model').addEventListener('click', autoSelectModel);
    document.querySelector('#set-model').addEventListener('click', setSelectedModel);
    document.querySelectorAll('[data-sources]').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelector('#sources').value = button.getAttribute('data-sources') || '';
      });
    });

    loadModelStatus();
    loadSavedSearches();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      statusEl.textContent = 'Шукаю товари...';
      groupsEl.innerHTML = '';
      resultsEl.innerHTML = '';
      metricsEl.innerHTML = '';
      historyEl.innerHTML = '';
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
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        statusEl.textContent = 'Готово за ' + seconds + ' c';
        renderMetrics(data);
        groupsEl.innerHTML = renderSection('Групи товарів', (data.groups || []).map(renderGroup).join(''), 'Групи зʼявляться після пошуку.');
        resultsEl.innerHTML = renderSection('Знайдені товари', data.products.map(renderProduct).join(''), 'Товарів не знайдено.');
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });

    async function loadModelStatus() {
      const response = await fetch('/api/openrouter/status');
      const data = await response.json();
      currentModelEl.textContent = data.model || 'не вибрана';
      modelToplineEl.textContent = 'Модель: ' + (data.model || 'не вибрана');
      modelStateEl.textContent = data.configured ? 'Ключ OpenRouter налаштований' : 'Ключ OpenRouter не налаштований';
    }

    async function loadModels(refresh) {
      modelNoteEl.textContent = 'Завантажую free моделі...';
      const response = await fetch('/api/openrouter/free-models?count=10&refresh=' + String(Boolean(refresh)));
      const data = await response.json();
      if (!response.ok) {
        modelNoteEl.textContent = data.error || 'Не вдалося завантажити моделі';
        return;
      }
      modelSelectEl.innerHTML = data.models.map((model, index) => {
        const label = (index + 1) + '. ' + model.id + ' | ctx ' + model.context + ' | score ' + model.score;
        return '<option value="' + escapeHtml(model.id) + '">' + escapeHtml(label) + '</option>';
      }).join('');
      modelNoteEl.textContent = data.models.length ? 'Топ free моделей завантажено.' : 'Free моделей не знайдено.';
    }

    async function autoSelectModel() {
      modelNoteEl.textContent = 'Підбираю модель...';
      const response = await fetch('/api/openrouter/select-free', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        modelNoteEl.textContent = data.error || 'Автопідбір не вдався';
        return;
      }
      currentModelEl.textContent = data.currentModel;
      modelToplineEl.textContent = 'Модель: ' + data.currentModel;
      modelSelectEl.innerHTML = data.models.map((model, index) => {
        const label = (index + 1) + '. ' + model.id + ' | ctx ' + model.context + ' | score ' + model.score;
        return '<option value="' + escapeHtml(model.id) + '">' + escapeHtml(label) + '</option>';
      }).join('');
      modelNoteEl.textContent = 'Вибрано: ' + data.selected.id;
    }

    async function setSelectedModel() {
      const model = modelSelectEl.value;
      if (!model) return;
      modelNoteEl.textContent = 'Зберігаю модель...';
      const response = await fetch('/api/openrouter/model', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model })
      });
      const data = await response.json();
      if (!response.ok) {
        modelNoteEl.textContent = data.error || 'Не вдалося зберегти модель';
        return;
      }
      currentModelEl.textContent = data.currentModel;
      modelToplineEl.textContent = 'Модель: ' + data.currentModel;
      modelNoteEl.textContent = 'Модель збережена в .env';
    }

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
      savedListEl.innerHTML = searches.length ? searches.map(renderSavedSearch).join('') : '<div class="subtle">Немає збережених пошуків</div>';
      savedListEl.querySelectorAll('[data-run]').forEach((button) => {
        button.addEventListener('click', () => runSavedSearch(button.getAttribute('data-run')));
      });
      savedListEl.querySelectorAll('[data-history]').forEach((button) => {
        button.addEventListener('click', () => loadPriceHistory(button.getAttribute('data-history')));
      });
    }

    async function runSavedSearch(id) {
      statusEl.textContent = 'Перевіряю saved search...';
      groupsEl.innerHTML = '';
      resultsEl.innerHTML = '';
      metricsEl.innerHTML = '';
      const response = await fetch('/api/saved-searches/' + encodeURIComponent(id) + '/run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        statusEl.textContent = data.error || 'run failed';
        return;
      }
      const alertText = data.alerts.length ? ' · сповіщень: ' + data.alerts.length : '';
      statusEl.textContent = 'Збережений пошук: ' + data.search.name + alertText;
      renderMetrics(data.result);
      groupsEl.innerHTML = renderSection('Групи товарів', (data.result.groups || []).map(renderGroup).join(''), 'Групи не знайдені.');
      resultsEl.innerHTML = renderSection('Знайдені товари', data.result.products.map(renderProduct).join(''), 'Товарів не знайдено.');
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

    function renderMetrics(data) {
      metricsEl.innerHTML = [
        metric('Товари', data.products.length),
        metric('Групи', (data.groups || []).length),
        metric('Джерела', unique((data.products || []).map((item) => item.sourceSite).filter(Boolean)).length),
        metric('Перевірено сторінок', data.candidates.length)
      ].join('');
    }

    function metric(label, value) {
      return '<div class="metric"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>';
    }

    function renderSection(title, body, emptyText) {
      return '<div class="panel"><div class="panel-head"><h2 class="panel-title">' + escapeHtml(title) + '</h2></div>' + (body || '<div class="subtle">' + escapeHtml(emptyText) + '</div>') + '</div>';
    }

    function renderSavedSearch(search) {
      const lastRun = search.lastRun ? ' · ' + new Date(search.lastRun.timestamp).toLocaleString() : '';
      return '<div class="saved-row"><div><strong>' + escapeHtml(search.name) + '</strong><div class="subtle">' + escapeHtml(search.query) + lastRun + '</div></div><div class="saved-actions"><button class="secondary" type="button" data-history="' + escapeHtml(search.id) + '">Історія</button><a class="button-link" href="/api/saved-searches/' + encodeURIComponent(search.id) + '/export?format=csv">CSV</a><a class="button-link" href="/api/saved-searches/' + encodeURIComponent(search.id) + '/export?format=json">JSON</a><button class="secondary" type="button" data-run="' + escapeHtml(search.id) + '">Запустити</button></div></div>';
    }

    function renderHistoryTable(records) {
      if (!records.length) return '<div class="subtle">Історії ще немає</div>';
      const rows = records.map((record) => {
        const cheapest = cheapestHistoryGroup(record);
        const price = cheapest ? formatHistoryPrice(cheapest) : '';
        return '<tr><td>' + escapeHtml(new Date(record.timestamp).toLocaleString()) + '</td><td>' + escapeHtml(String(record.groups.length)) + '</td><td>' + escapeHtml(String(record.alerts.length)) + '</td><td>' + escapeHtml(cheapest?.label || '') + '</td><td>' + escapeHtml(price) + '</td></tr>';
      }).join('');
      return '<table class="history-table"><thead><tr><th>Дата</th><th>Групи</th><th>Alerts</th><th>Найдешевша група</th><th>Ціна</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderGroup(group) {
      const price = formatPriceRange(group);
      const sources = group.sources?.length ? group.sources.join(', ') : 'джерело';
      const sellerCount = group.sellerCount ? String(group.sellerCount) + ' продав.' : '';
      const specs = formatSpecs(group.specs);
      const bestUrl = group.bestOffer?.url || '#';
      return '<article class="group-item"><div><a class="title" href="' + bestUrl + '" target="_blank" rel="noreferrer">' + escapeHtml(group.label) + '</a><div class="meta"><span class="pill">' + group.offerCount + ' проп.</span>' + (sellerCount ? '<span class="pill">' + escapeHtml(sellerCount) + '</span>' : '') + (specs ? '<span class="pill pill-blue">' + escapeHtml(specs) + '</span>' : '') + '<span class="pill">' + escapeHtml(sources) + '</span></div></div><div class="price">' + escapeHtml(price || '') + '</div></article>';
    }

    function renderProduct(product) {
      const price = product.price ? product.price + ' ' + (product.currency || '') : 'ціна невідома';
      const ai = product.ai?.summary ? '<div class="subtle">' + escapeHtml(product.ai.summary) + '</div>' : '';
      const warnings = product.warnings?.length ? '<div class="subtle danger-text">Попередження: ' + escapeHtml(product.warnings.join('; ')) + '</div>' : '';
      const evidence = product.evidence?.length ? '<div class="subtle">Підстави: ' + escapeHtml(product.evidence.slice(0, 2).join('; ')) + '</div>' : '';
      const specs = formatSpecs(product.specs);
      return '<article class="result-item"><div><a class="title" href="' + product.url + '" target="_blank" rel="noreferrer">' + escapeHtml(product.title) + '</a><div class="meta"><span class="pill">' + escapeHtml(product.sourceSite || 'джерело') + '</span><span class="pill pill-amber">' + escapeHtml(product.matchGrade || 'match') + '</span><span class="pill">точність ' + Number(product.relevanceScore || 0).toFixed(2) + '</span><span class="pill">' + escapeHtml(product.condition || product.availability || 'у списку') + '</span>' + (specs ? '<span class="pill pill-blue">' + escapeHtml(specs) + '</span>' : '') + '</div>' + ai + warnings + evidence + '</div><div class="price">' + escapeHtml(price) + '</div></article>';
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    }
    function unique(values) {
      return [...new Set(values)];
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
