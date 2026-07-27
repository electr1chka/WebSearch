# Production Deployment

Цей проєкт треба деплоїти як Node.js server з Playwright/Chromium і persistent volume.

## VPS + Docker Compose

1. Скопіюй репозиторій на сервер.
2. Створи production env:

```bash
cp .env.production.example .env.production
```

3. Заповни в `.env.production`:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_SITE_URL=https://your-domain.example
APP_USERNAME=...
APP_PASSWORD=...
```

4. Запусти:

```bash
docker compose up -d --build
```

5. Перевір:

```bash
curl http://127.0.0.1:8787/health
```

## Persistent Data

Docker Compose монтує volume `websearch-data` в `/data`.

Там зберігаються:

- `/data/search-history.jsonl`
- `/data/saved-searches.json`
- `/data/price-history.jsonl`
- `/data/search-settings.json`
- `/data/browser-profile`

`/data/browser-profile` потрібен для повторного використання браузерної сесії ZenMarket.

## HTTPS

Перед публічним доступом постав reverse proxy з HTTPS, наприклад Caddy або Nginx.

Приклад Caddy:

```text
your-domain.example {
  reverse_proxy 127.0.0.1:8787
}
```

## Auth

Production env вмикає Basic Auth:

```bash
APP_AUTH_ENABLED=true
APP_USERNAME=admin
APP_PASSWORD=change-this-long-random-password
```

`/health` лишається відкритим для healthchecks. UI та API захищені.

## Notes

- Не коміть `.env.production`.
- Не запускай це як serverless app: пошуки довгі, потрібен Chromium і persistent browser profile.
- Для Fly.io/Railway/Render потрібен Docker deploy і volume, змонтований у `/data`.
