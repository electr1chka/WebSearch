import type { SearchSettings } from "../search/settings.js";

export function renderSettingsPage(settings: SearchSettings, filePath: string): string {
  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Налаштування пошуку</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #0d1118;
      --panel: rgba(20, 27, 38, .92);
      --line: rgba(137, 162, 194, .22);
      --line-strong: rgba(138, 235, 205, .42);
      --text: #eef5ff;
      --muted: #8ea0b7;
      --muted-strong: #bac7d8;
      --primary: #2bd3a6;
      --blue: #78a8ff;
      --amber: #f4c95d;
      --shadow: 0 24px 80px rgba(0, 0, 0, .35);
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; overflow-x: hidden; }
    body {
      min-height: 100vh;
      margin: 0;
      color: var(--text);
      background: var(--bg);
      display: flex;
      flex-direction: column;
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
      color: var(--text);
      font-size: 18px;
      font-weight: 850;
      text-decoration: none;
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
    .back-link {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 13px;
      border: 1px solid rgba(137, 162, 194, .28);
      border-radius: 8px;
      color: var(--muted-strong);
      background: rgba(18, 25, 36, .74);
      text-decoration: none;
      font-weight: 780;
      white-space: nowrap;
    }
    .back-link:hover {
      color: var(--primary);
      border-color: rgba(43, 211, 166, .55);
    }
    main {
      flex: 1;
      width: 100%;
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 18px 42px;
      display: grid;
      align-content: start;
      gap: 16px;
    }
    .settings-panel {
      position: relative;
      min-width: 0;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, .045), rgba(255, 255, 255, .012)),
        var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .settings-panel::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, var(--primary), var(--blue), var(--amber));
    }
    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 18px;
      padding-left: 4px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .file-path {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    form {
      display: grid;
      gap: 18px;
    }
    .fieldset {
      display: grid;
      gap: 10px;
    }
    h2 {
      margin: 0;
      color: var(--muted-strong);
      font-size: 13px;
      font-weight: 850;
      letter-spacing: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    label {
      min-width: 0;
      display: grid;
      gap: 6px;
      color: var(--muted-strong);
      font-size: 13px;
      font-weight: 720;
    }
    input:not([type="checkbox"]), select {
      width: 100%;
      min-width: 0;
      min-height: 46px;
      border: 1px solid rgba(137, 162, 194, .36);
      border-radius: 8px;
      padding: 0 13px;
      color: var(--text);
      background: rgba(8, 12, 18, .72);
      font: inherit;
      font-size: 15px;
    }
    input::placeholder { color: #67768a; }
    input:focus, select:focus {
      outline: 2px solid rgba(43, 211, 166, .2);
      border-color: var(--line-strong);
      box-shadow: inset 0 0 0 1px rgba(43, 211, 166, .18);
    }
    .switches {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .switch {
      min-height: 50px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 13px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(18, 25, 36, .76);
      color: var(--text);
      font-size: 14px;
      font-weight: 780;
    }
    .switch input {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
      flex: 0 0 auto;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 2px;
    }
    button {
      min-height: 50px;
      min-width: 178px;
      border: 1px solid rgba(43, 211, 166, .7);
      border-radius: 8px;
      color: #07120f;
      background: linear-gradient(180deg, #45e2b7, #22c69b);
      font: inherit;
      font-weight: 900;
      font-size: 15px;
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
      min-height: 22px;
      color: var(--muted-strong);
      font-size: 13px;
    }
    @media (max-width: 820px) {
      .grid, .switches { grid-template-columns: 1fr; }
      .topbar, .panel-head, .actions { align-items: stretch; flex-direction: column; }
      .back-link, button { width: 100%; }
    }
    @media (max-width: 520px) {
      main, .topbar { padding-left: 12px; padding-right: 12px; }
      main { padding-top: 18px; }
      .settings-panel { padding: 14px; }
      .brand { font-size: 17px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <a class="brand" href="/"><span class="brand-mark"></span><span>AI Web Search Agent</span></a>
      <a class="back-link" href="/">Пошук</a>
    </div>
  </header>
  <main>
    <section class="settings-panel">
      <div class="panel-head">
        <div>
          <h1>Налаштування пошуку</h1>
          <div class="file-path">${escapeHtml(relativePath(filePath))}</div>
        </div>
      </div>
      <form id="settings-form">
        <section class="fieldset">
          <h2>Глибина</h2>
          <div class="grid">
            <label>Знайти посилань <input name="maxResults" type="number" min="1" value="${settings.maxResults}" /></label>
            <label>Відкрити сторінок <input name="maxPages" type="number" min="1" value="${settings.maxPages}" /></label>
            <label>Показати результатів <input name="limit" type="number" min="1" value="${settings.limit}" /></label>
          </div>
        </section>
        <section class="fieldset">
          <h2>Фільтри</h2>
          <div class="grid">
            <label>Джерела <input name="sources" value="${escapeHtml(settings.sources)}" placeholder="olx,zenmarket,ibis" /></label>
            <label>Мін. ціна <input name="minPrice" type="number" min="0" value="${settings.minPrice ?? ""}" /></label>
            <label>Макс. ціна <input name="maxPrice" type="number" min="0" value="${settings.maxPrice ?? ""}" /></label>
          </div>
          <div class="grid">
            <label>Стан
              <select name="condition">
                <option value=""${selected(settings.condition, "")}>будь-який</option>
                <option value="used"${selected(settings.condition, "used")}>б/в</option>
                <option value="new"${selected(settings.condition, "new")}>новий</option>
              </select>
            </label>
            <label>Завантаження
              <select name="fetchMode">
                <option value="auto"${selected(settings.fetchMode, "auto")}>auto</option>
                <option value="http"${selected(settings.fetchMode, "http")}>http</option>
                <option value="browser"${selected(settings.fetchMode, "browser")}>browser</option>
                <option value="firecrawl"${selected(settings.fetchMode, "firecrawl")}>firecrawl</option>
              </select>
            </label>
          </div>
        </section>
        <section class="fieldset">
          <h2>Поведінка</h2>
          <div class="switches">
            <label class="switch"><input name="ai" type="checkbox"${checked(settings.ai)} /> AI-аналіз</label>
            <label class="switch"><input name="save" type="checkbox"${checked(settings.save)} /> Зберігати пошуки</label>
            <label class="switch"><input name="browserHumanInLoop" type="checkbox"${checked(settings.browserHumanInLoop)} /> Видимий браузер</label>
          </div>
        </section>
        <div class="actions">
          <div id="status" class="status"></div>
          <button id="save" type="submit">Зберегти</button>
        </div>
      </form>
    </section>
  </main>
  <script>
    const form = document.querySelector('#settings-form');
    const saveButton = document.querySelector('#save');
    const statusEl = document.querySelector('#status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      saveButton.disabled = true;
      statusEl.textContent = 'Зберігаю...';

      const formData = new FormData(form);
      const payload = {
        maxResults: Number(formData.get('maxResults')),
        maxPages: Number(formData.get('maxPages')),
        limit: Number(formData.get('limit')),
        fetchMode: String(formData.get('fetchMode') || 'auto'),
        browserHumanInLoop: formData.has('browserHumanInLoop'),
        ai: formData.has('ai'),
        save: formData.has('save'),
        sources: String(formData.get('sources') || ''),
        condition: String(formData.get('condition') || ''),
        minPrice: optionalNumber(formData.get('minPrice')),
        maxPrice: optionalNumber(formData.get('maxPrice'))
      };

      try {
        const response = await fetch('/api/search-settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'save failed');
        statusEl.textContent = 'Збережено';
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        saveButton.disabled = false;
      }
    });

    function optionalNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  </script>
</body>
</html>`;
}

function checked(value: boolean): string {
  return value ? " checked" : "";
}

function selected(current: string, value: string): string {
  return current === value ? " selected" : "";
}

function relativePath(filePath: string): string {
  return filePath.replace(`${process.cwd()}/`, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char] ?? char);
}
