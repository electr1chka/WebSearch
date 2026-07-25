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
      --bg: #f4f6f8;
      --panel: #ffffff;
      --line: #d8e0e8;
      --text: #17212e;
      --muted: #66758a;
      --primary: #176b5b;
      --primary-dark: #105343;
      --blue: #2d5f9a;
      --amber-bg: #fff4dd;
      --amber: #805612;
      --soft: #eef3f7;
    }
    * { box-sizing: border-box; }
    html, body { max-width: 100%; overflow-x: hidden; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    header { background: var(--panel); border-bottom: 1px solid var(--line); }
    .topbar { width: 100%; max-width: 1120px; margin: 0 auto; padding: 16px 18px; display: flex; align-items: center; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
    main { width: 100%; max-width: 1120px; margin: 0 auto; padding: 18px; display: grid; gap: 14px; }
    .search-panel, .result-item, .group-item, .empty { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .search-panel { padding: 14px; }
    form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, 170px); gap: 10px; align-items: center; }
    input, button { width: 100%; min-width: 0; min-height: 46px; border-radius: 7px; font: inherit; }
    input { border: 1px solid #b9c6d3; padding: 0 13px; color: var(--text); background: #fff; font-size: 16px; }
    input:focus { outline: 2px solid rgba(45, 95, 154, .2); border-color: var(--blue); }
    button { border: 1px solid var(--primary); background: var(--primary); color: #fff; font-weight: 800; cursor: pointer; font-size: 16px; }
    button:hover { background: var(--primary-dark); }
    button:disabled { opacity: .7; cursor: wait; }
    .status { min-height: 22px; color: var(--muted); font-size: 14px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .metric { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
    .metric strong { display: block; font-size: 20px; }
    .metric span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; }
    .section { display: grid; gap: 8px; }
    .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 15px; }
    .subtle { color: var(--muted); font-size: 13px; }
    .group-item { border-left: 4px solid var(--primary); padding: 11px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
    .result-item { padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; }
    .title { color: #10283e; font-weight: 800; text-decoration: none; overflow-wrap: anywhere; }
    .title:hover { text-decoration: underline; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
    .pill { background: var(--soft); border-radius: 999px; padding: 3px 8px; color: #33475b; font-size: 12px; }
    .pill-amber { background: var(--amber-bg); color: var(--amber); }
    .pill-blue { background: #e8f0fb; color: var(--blue); }
    .price { font-weight: 850; color: var(--primary-dark); white-space: nowrap; }
    .empty { padding: 16px; color: var(--muted); }
    @media (max-width: 720px) {
      form, .metrics, .group-item, .result-item { grid-template-columns: 1fr; }
      .price { white-space: normal; }
      main, .topbar { padding-left: 12px; padding-right: 12px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <h1>AI Web Search Agent</h1>
    </div>
  </header>
  <main>
    <section class="search-panel">
      <form id="search-form">
        <input id="query" name="query" value="shimano scorpion 151 dc" autocomplete="off" autofocus />
        <button id="submit" type="submit">Знайти</button>
      </form>
    </section>
    <div id="status" class="status"></div>
    <section id="metrics" class="metrics"></section>
    <section id="groups" class="section"></section>
    <section id="results" class="section"></section>
  </main>
  <script>
    const form = document.querySelector('#search-form');
    const queryEl = document.querySelector('#query');
    const submit = document.querySelector('#submit');
    const statusEl = document.querySelector('#status');
    const metricsEl = document.querySelector('#metrics');
    const groupsEl = document.querySelector('#groups');
    const resultsEl = document.querySelector('#results');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = queryEl.value.trim();
      if (!query) return;

      submit.disabled = true;
      statusEl.textContent = 'Шукаю...';
      metricsEl.innerHTML = '';
      groupsEl.innerHTML = '';
      resultsEl.innerHTML = '';
      const started = Date.now();

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query,
            maxResults: 220,
            maxPages: 60,
            limit: 120,
            fetchMode: 'auto',
            browserHumanInLoop: true,
            save: true
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'search failed');

        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        statusEl.textContent = 'Готово за ' + seconds + ' c';
        renderMetrics(data);
        renderGroups(data.groups || []);
        renderProducts(data.products || []);
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });

    function renderMetrics(data) {
      metricsEl.innerHTML = [
        metric('Товари', data.products?.length || 0),
        metric('Групи', data.groups?.length || 0),
        metric('Джерела', unique((data.products || []).map((item) => item.sourceSite).filter(Boolean)).length),
        metric('Сторінки', data.candidates?.length || 0)
      ].join('');
    }

    function renderGroups(groups) {
      if (!groups.length) {
        groupsEl.innerHTML = '';
        return;
      }

      groupsEl.innerHTML = '<div class="section-head"><h2>Групи</h2><span class="subtle">' + groups.length + '</span></div>' + groups.map(renderGroup).join('');
    }

    function renderProducts(products) {
      if (!products.length) {
        resultsEl.innerHTML = '<div class="empty">Товарів не знайдено.</div>';
        return;
      }

      resultsEl.innerHTML = '<div class="section-head"><h2>Результати</h2><span class="subtle">' + products.length + '</span></div>' + products.map(renderProduct).join('');
    }

    function renderGroup(group) {
      const price = formatPriceRange(group);
      const sources = group.sources?.length ? group.sources.join(', ') : 'джерело';
      const bestUrl = group.bestOffer?.url || '#';
      return '<article class="group-item"><div><a class="title" href="' + bestUrl + '" target="_blank" rel="noreferrer">' + escapeHtml(group.label) + '</a><div class="meta"><span class="pill">' + group.offerCount + ' проп.</span><span class="pill">' + escapeHtml(sources) + '</span></div></div><div class="price">' + escapeHtml(price || '') + '</div></article>';
    }

    function renderProduct(product) {
      const price = product.price ? product.price + ' ' + (product.currency || '') : 'ціна невідома';
      const specs = formatSpecs(product.specs);
      return '<article class="result-item"><div><a class="title" href="' + product.url + '" target="_blank" rel="noreferrer">' + escapeHtml(product.title) + '</a><div class="meta"><span class="pill">' + escapeHtml(product.sourceSite || 'джерело') + '</span><span class="pill pill-amber">' + escapeHtml(product.matchGrade || 'match') + '</span><span class="pill">точність ' + Number(product.relevanceScore || 0).toFixed(2) + '</span><span class="pill">' + escapeHtml(product.condition || product.availability || 'у списку') + '</span>' + (specs ? '<span class="pill pill-blue">' + escapeHtml(specs) + '</span>' : '') + '</div></div><div class="price">' + escapeHtml(price) + '</div></article>';
    }

    function metric(label, value) {
      return '<div class="metric"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>';
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
