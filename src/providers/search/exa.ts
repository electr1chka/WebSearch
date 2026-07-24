import { fetchJson } from "../../utils/http.js";
import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";

interface ExaResponse {
  results?: Array<{
    title?: string;
    url?: string;
    text?: string;
    summary?: string;
    highlights?: string[];
  }>;
}

export class ExaSearchProvider implements SearchProvider {
  readonly name = "exa";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    if (!this.apiKey) {
      return [];
    }

    const data = await fetchJson<ExaResponse>("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey
      },
      body: JSON.stringify({
        query,
        type: "neural",
        numResults: Math.min(limit, 20),
        contents: {
          highlights: {
            numSentences: 2
          },
          summary: {
            query
          }
        }
      })
    });

    return (data.results ?? [])
      .filter((item) => item.url)
      .map((item, index) => ({
        title: item.title ?? item.url ?? "Untitled",
        url: item.url ?? "",
        snippet: item.summary ?? item.highlights?.join(" "),
        sourceProvider: this.name,
        rank: index + 1
      }));
  }
}
