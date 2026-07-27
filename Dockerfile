FROM mcr.microsoft.com/playwright:v1.49.1-noble AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY settings ./settings
RUN npm run build
RUN npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    STORAGE_PATH=/data/search-history.jsonl \
    SAVED_SEARCHES_PATH=/data/saved-searches.json \
    PRICE_HISTORY_PATH=/data/price-history.jsonl \
    SEARCH_SETTINGS_PATH=/data/search-settings.json \
    BROWSER_USER_DATA_DIR=/data/browser-profile \
    BROWSER_HEADLESS=true \
    BROWSER_HUMAN_IN_LOOP=false

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/settings ./settings

RUN mkdir -p /data/browser-profile && chown -R pwuser:pwuser /app /data

USER pwuser

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
