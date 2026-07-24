import type { AgentConfig, FetchedPage } from "../types.js";
import { isBlockedPage } from "./blockedPage.js";
import { BrowserFetcher } from "./browserFetcher.js";
import { FirecrawlFetcher } from "./firecrawlFetcher.js";
import { SimpleHttpFetcher } from "./simpleHttpFetcher.js";
import type { PageFetcher } from "./types.js";

export function createFetchers(config: AgentConfig): PageFetcher[] {
  const http = new SimpleHttpFetcher();
  const firecrawl = new FirecrawlFetcher(config.firecrawlApiKey);
  const browser = new BrowserFetcher({
    headless: config.browserHeadless,
    humanInLoop: config.browserHumanInLoop,
    solveTimeoutMs: config.browserSolveTimeoutMs,
    userDataDir: config.browserUserDataDir
  });

  if (config.fetchMode === "firecrawl") {
    return firecrawl.isConfigured() ? [firecrawl, http, browser] : [http, browser];
  }

  if (config.fetchMode === "browser") {
    return [browser, http];
  }

  if (config.fetchMode === "http") {
    return [http];
  }

  return firecrawl.isConfigured() ? [http, firecrawl, browser] : [http, browser];
}

export async function fetchWithFallback(fetchers: PageFetcher[], url: string): Promise<FetchedPage | undefined> {
  for (const fetcher of fetchers) {
    if (!fetcher.isConfigured()) {
      continue;
    }

    if (shouldSkipFetcher(fetcher, url)) {
      continue;
    }

    try {
      const page = await fetcher.fetch(url);
      if ((page.html || page.markdown || page.text) && !isBlockedPage(page)) {
        return page;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function shouldSkipFetcher(fetcher: PageFetcher, url: string): boolean {
  if (fetcher.name !== "playwright-browser") {
    return false;
  }

  try {
    const host = new URL(url).host;
    return host === "product-api.rozetka.com.ua" || host === "search.rozetka.com.ua";
  } catch {
    return false;
  }
}
