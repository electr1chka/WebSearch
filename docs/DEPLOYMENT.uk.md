# Production Deployment

Цей проєкт треба деплоїти як Node.js server з Playwright/Chromium і persistent volume.

## VPS + Docker Compose

1. Скопіюй репозиторій на сервер.
2. Направ DNS `A` record домену на IP сервера.
3. Створи production env:

```bash
cp .env.production.example .env.production
```

4. Заповни в `.env.production`:

```bash
DOMAIN=your-domain.example
OPENROUTER_API_KEY=...
OPENROUTER_SITE_URL=https://your-domain.example
APP_USERNAME=...
APP_PASSWORD=...
```

5. Запусти production stack з HTTPS:

```bash
scripts/deploy-prod.sh
```

6. Перевір:

```bash
curl http://127.0.0.1:8787/health
curl https://your-domain.example/health
```

Для локального HTTP-only запуску без Caddy:

```bash
docker compose up -d --build
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

Production override `docker-compose.prod.yml` запускає Caddy. Конфіг лежить у `deploy/Caddyfile`:

```text
{$DOMAIN} {
  encode zstd gzip
  reverse_proxy websearch:8787
}
```

Caddy сам випускає і поновлює TLS-сертифікати, якщо `DOMAIN` дивиться на сервер і порти `80/443` відкриті.

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

## Backup

Зробити backup persistent volume:

```bash
scripts/backup-data.sh
```

За замовчуванням архів пишеться в `backups/`.

Відновити backup:

```bash
scripts/restore-data.sh backups/websearch-data-YYYYMMDDTHHMMSSZ.tar.gz
```

Перед оновленням production бажано зробити backup:

```bash
scripts/backup-data.sh
git pull
scripts/deploy-prod.sh
```

## Production Checklist

- `DOMAIN` вказує на IP сервера.
- Порти `80` і `443` відкриті.
- `.env.production` створено і не закомічено.
- `APP_AUTH_ENABLED=true`.
- `APP_PASSWORD` довгий і унікальний.
- `OPENROUTER_API_KEY` заданий через env.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` показує healthy/running сервіси.
- `/health` відповідає через HTTPS.
- `scripts/backup-data.sh` створює архів.
