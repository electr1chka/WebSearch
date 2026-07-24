import { fetchJson } from "../../utils/http.js";
import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    if (!this.apiKey) {
      return [];
    }

    const data = await fetchJson<TavilyResponse>("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: Math.min(limit, 20),
        search_depth: "advanced",
        include_answer: false,
        include_raw_content: false
      })
    });

    return (data.results ?? [])
      .filter((item) => item.url && item.title)
      .map((item, index) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.content,
        sourceProvider: this.name,
        rank: index + 1
      }));
  }
}
