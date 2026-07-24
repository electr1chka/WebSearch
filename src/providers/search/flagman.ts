import type { SearchCandidate } from "../../types.js";
import { fetchJson } from "../../utils/http.js";
import type { SearchProvider } from "./types.js";

interface FlagmanSearchResponse {
  results?: {
    items?: Array<{
      id?: string;
      name?: string;
      url?: string;
      brand?: string;
      price?: number;
      currency?: string;
      is_presence?: boolean;
    }>;
  };
}

export class FlagmanSearchProvider implements SearchProvider {
  readonly name = "flagman-api";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL("https://api.multisearch.io/");
    url.searchParams.set("id", "12442");
    url.searchParams.set("query", query);
    url.searchParams.set("uid", "ai-web-search-agent");
    url.searchParams.set("autocomplete", "true");
    url.searchParams.set("key", "b1ca3d7b6c1d66db09382e3539e87c70");

    const data = await fetchJson<FlagmanSearchResponse>(url.toString(), {
      headers: {
        "accept": "application/json"
      }
    });

    return (data.results?.items ?? [])
      .filter((item) => item.url && item.name)
      .slice(0, Math.min(limit, 20))
      .map((item, index) => ({
        title: item.name ?? item.url ?? "Flagman product",
        url: normalizeFlagmanUrl(item.url ?? ""),
        snippet: [
          item.brand,
          item.price ? `${item.price} ${item.currency ?? "UAH"}` : undefined,
          item.is_presence ? "in stock" : undefined
        ].filter(Boolean).join(" | "),
        sourceProvider: this.name,
        rank: index + 1
      }));
  }
}

function normalizeFlagmanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.host = "flagman.ua";
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return url;
  }
}
