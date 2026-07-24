import type { FetchedPage } from "../types.js";
import { fetchJson } from "../utils/http.js";
import type { PageFetcher } from "./types.js";

interface FirecrawlResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      url?: string;
      statusCode?: number;
    };
  };
}

export class FirecrawlFetcher implements PageFetcher {
  readonly name = "firecrawl";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async fetch(url: string): Promise<FetchedPage> {
    if (!this.apiKey) {
      throw new Error("Firecrawl API key is not configured");
    }

    const data = await fetchJson<FirecrawlResponse>("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false
      })
    });

    return {
      url,
      finalUrl: data.data?.metadata?.sourceURL ?? data.data?.metadata?.url ?? url,
      title: data.data?.metadata?.title,
      html: data.data?.html,
      markdown: data.data?.markdown,
      text: data.data?.markdown,
      status: data.data?.metadata?.statusCode,
      fetcher: this.name
    };
  }
}
