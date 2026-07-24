import { fetchJson } from "../../utils/http.js";
import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";

interface BraveResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    if (!this.apiKey) {
      return [];
    }

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(limit, 20)));
    url.searchParams.set("search_lang", "en");
    url.searchParams.set("safesearch", "moderate");

    const data = await fetchJson<BraveResponse>(url.toString(), {
      headers: {
        "accept": "application/json",
        "x-subscription-token": this.apiKey
      }
    });

    return (data.web?.results ?? [])
      .filter((item) => item.url && item.title)
      .map((item, index) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.description,
        sourceProvider: this.name,
        rank: index + 1
      }));
  }
}
