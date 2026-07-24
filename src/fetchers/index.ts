import type { AgentConfig, FetchedPage } from "../types.js";
import { BrowserFetcher } from "./browserFetcher.js";
import { FirecrawlFetcher } from "./firecrawlFetcher.js";
import { SimpleHttpFetcher } from "./simpleHttpFetcher.js";
import type { PageFetcher } from "./types.js";

export function createFetchers(config: AgentConfig): PageFetcher[] {
  const http = new SimpleHttpFetcher();
  const firecrawl = new FirecrawlFetcher(config.firecrawlApiKey);
  const browser = new BrowserFetcher();

  if (config.fetchMode === "firecrawl") {
    return firecrawl.isConfigured() ? [firecrawl, http] : [http];
  }

  if (config.fetchMode === "browser") {
    return [browser, http];
  }

  if (config.fetchMode === "http") {
    return [http];
  }

  return firecrawl.isConfigured() ? [firecrawl, browser, http] : [browser, http];
}

export async function fetchWithFallback(fetchers: PageFetcher[], url: string): Promise<FetchedPage | undefined> {
  for (const fetcher of fetchers) {
    if (!fetcher.isConfigured()) {
      continue;
    }

    try {
      const page = await fetcher.fetch(url);
      if (page.html || page.markdown || page.text) {
        return page;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}
