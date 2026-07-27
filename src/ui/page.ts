export function renderDashboardPage(): string {
  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Web Search Agent</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #0d1118;
      --bg-grid: rgba(116, 149, 186, .08);
      --panel: rgba(20, 27, 38, .92);
      --panel-strong: #182232;
      --line: rgba(137, 162, 194, .22);
      --line-strong: rgba(138, 235, 205, .42);
      --text: #eef5ff;
      --muted: #8ea0b7;
      --muted-strong: #bac7d8;
      --primary: #2bd3a6;
      --primary-dark: #17a981;
      --blue: #78a8ff;
      --amber: #f4c95d;
      --rose: #ff7d7d;
      --chip: rgba(123, 154, 195, .13);
      --shadow: 0 24px 80px rgba(0, 0, 0, .35);
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; overflow-x: hidden; }
    body {
      margin: 0;
      color: var(--text);
      background:
        linear-gradient(90deg, transparent 31px, var(--bg-grid) 32px),
        linear-gradient(0deg, transparent 31px, var(--bg-grid) 32px),
        linear-gradient(120deg, rgba(43, 211, 166, .12), transparent 26%),
        linear-gradient(215deg, rgba(120, 168, 255, .12), transparent 30%),
        linear-gradient(145deg, #0d1118 0%, #101723 48%, #0a0d13 100%);
      background-size: 32px 32px, 32px 32px, auto, auto;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(120deg, transparent 0 18%, rgba(120, 168, 255, .07) 18% 18.35%, transparent 18.35% 100%),
        linear-gradient(120deg, transparent 0 70%, rgba(43, 211, 166, .07) 70% 70.3%, transparent 70.3% 100%);
      opacity: .9;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--line);
      background: rgba(12, 16, 23, .82);
      backdrop-filter: blur(18px);
    }
    .topbar {
      width: 100%;
      max-width: 1180px;
      margin: 0 auto;
      padding: 17px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      font-size: 18px;
      font-weight: 850;
      letter-spacing: 0;
    }
    .brand-mark {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      border: 1px solid rgba(43, 211, 166, .5);
      background:
        linear-gradient(135deg, rgba(43, 211, 166, .9), rgba(120, 168, 255, .72)),
        #132234;
      box-shadow: 0 0 28px rgba(43, 211, 166, .24);
      position: relative;
      flex: 0 0 auto;
    }
    .brand-mark::after {
      content: "";
      position: absolute;
      inset: 8px;
      border: 2px solid rgba(13, 17, 24, .75);
      border-left-color: transparent;
      border-bottom-color: transparent;
      transform: rotate(45deg);
    }
    .runtime {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .runtime::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 16px rgba(43, 211, 166, .75);
    }
    main {
      width: 100%;
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 18px 42px;
      display: grid;
      gap: 16px;
    }
    .search-panel {
      position: relative;
      min-width: 0;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, .045), rgba(255, 255, 255, .012)),
        var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .search-panel::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, var(--primary), var(--blue), var(--amber));
    }
    form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(138px, 178px);
      gap: 10px;
      align-items: center;
    }
    input, button {
      width: 100%;
      min-width: 0;
      min-height: 52px;
      border-radius: 8px;
      font: inherit;
    }
    input {
      border: 1px solid rgba(137, 162, 194, .36);
      padding: 0 15px;
      color: var(--text);
      background: rgba(8, 12, 18, .72);
      font-size: 16px;
      caret-color: var(--primary);
    }
    input::placeholder { color: #67768a; }
    input:focus {
      outline: 2px solid rgba(43, 211, 166, .2);
      border-color: var(--line-strong);
      box-shadow: inset 0 0 0 1px rgba(43, 211, 166, .18);
    }
    button {
      border: 1px solid rgba(43, 211, 166, .7);
      color: #07120f;
      background: linear-gradient(180deg, #45e2b7, #22c69b);
      font-weight: 900;
      font-size: 16px;
      cursor: pointer;
      box-shadow: 0 14px 32px rgba(34, 198, 155, .24);
    }
    button:hover { background: linear-gradient(180deg, #5cebc4, #27d3a5); }
    button:disabled {
      opacity: .72;
      cursor: wait;
      color: rgba(7, 18, 15, .72);
    }
    .status {
      min-height: 34px;
      display: flex;
      align-items: center;
      color: var(--muted-strong);
      font-size: 14px;
    }
    .status.searching::before {
      content: "";
      width: 9px;
      height: 9px;
      margin-right: 9px;
      border-radius: 50%;
      background: var(--primary);
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(.75); opacity: .55; }
      50% { transform: scale(1.15); opacity: 1; }
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .metric {
      min-width: 0;
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(18, 25, 36, .76);
    }
    .metric strong {
      display: block;
      font-size: 23px;
      line-height: 1.05;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .metric span {
      display: block;
      margin-top: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    .section {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 4px;
    }
    h2 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0;
    }
    .subtle { color: var(--muted); font-size: 13px; }
    .group-item, .result-item, .empty {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(18, 25, 36, .82);
      box-shadow: 0 12px 34px rgba(0, 0, 0, .16);
    }
    .group-item {
      border-left: 4px solid var(--primary);
      padding: 13px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
    }
    .result-item {
      padding: 14px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      position: relative;
      overflow: hidden;
    }
    .result-item::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 2px;
      background: linear-gradient(180deg, transparent, rgba(120, 168, 255, .76), transparent);
    }
    .title {
      color: var(--text);
      font-weight: 820;
      text-decoration: none;
      overflow-wrap: anywhere;
      line-height: 1.35;
    }
    .title:hover { color: #ffffff; text-decoration: underline; }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .pill {
      min-width: 0;
      background: var(--chip);
      border: 1px solid rgba(137, 162, 194, .16);
      border-radius: 999px;
      padding: 4px 8px;
      color: #c4d0df;
      font-size: 12px;
    }
    .pill-amber { color: var(--amber); background: rgba(244, 201, 93, .1); }
    .pill-blue { color: #a9c5ff; background: rgba(120, 168, 255, .11); }
    .price {
      color: var(--primary);
      font-weight: 900;
      white-space: nowrap;
      text-align: right;
    }
    .empty {
      padding: 18px;
      color: var(--muted);
    }
    @media (max-width: 780px) {
      .topbar { align-items: flex-start; flex-direction: column; }
      .runtime { white-space: normal; }
      form, .metrics, .group-item, .result-item { grid-template-columns: 1fr; }
      .price { white-space: normal; text-align: left; }
    }
    @media (max-width: 520px) {
      main, .topbar { padding-left: 12px; padding-right: 12px; }
      main { padding-top: 18px; }
      .brand { font-size: 17px; }
      .search-panel { padding: 12px; }
      input, button { min-height: 48px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <div class="brand"><span class="brand-mark"></span><span>AI Web Search Agent</span></div>
      <div class="runtime">готовий</div>
    </div>
  </header>
  <main>
    <section class="search-panel">
      <form id="search-form">
        <input id="query" name="query" placeholder="Shimano Scorpion 151 DC, Twin Power 24..." autocomplete="off" autofocus />
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
      statusEl.classList.add('searching');
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
            browserHumanInLoop: false,
            save: true
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'search failed');

        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        statusEl.classList.remove('searching');
        statusEl.textContent = 'Готово за ' + seconds + ' c';
        renderMetrics(data);
        renderGroups(data.groups || []);
        renderProducts(data.products || []);
      } catch (error) {
        statusEl.classList.remove('searching');
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
        metric('Перевірено', data.candidates?.length || 0)
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
