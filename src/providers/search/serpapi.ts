import { fetchJson } from "../../utils/http.js";
import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";

interface SerpApiResponse {
  organic_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    position?: number;
  }>;
  shopping_results?: Array<{
    title?: string;
    link?: string;
    source?: string;
    price?: string;
    position?: number;
  }>;
}

export class SerpApiProvider implements SearchProvider {
  readonly name = "serpapi";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    if (!this.apiKey) {
      return [];
    }

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(limit, 20)));
    url.searchParams.set("api_key", this.apiKey);

    const data = await fetchJson<SerpApiResponse>(url.toString());
    const organic = (data.organic_results ?? []).map((item, index) => ({
      title: item.title ?? item.link ?? "Untitled",
      url: item.link ?? "",
      snippet: item.snippet,
      sourceProvider: this.name,
      rank: item.position ?? index + 1
    }));
    const shopping = (data.shopping_results ?? []).map((item, index) => ({
      title: item.title ?? item.link ?? "Untitled",
      url: item.link ?? "",
      snippet: [item.source, item.price].filter(Boolean).join(" - "),
      sourceProvider: `${this.name}:shopping`,
      rank: item.position ?? index + 1
    }));

    return [...shopping, ...organic].filter((item) => item.url).slice(0, limit);
  }
}
