import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";
import {
  JDM_DIRECT_SEARCH_SOURCES,
  UKRAINIAN_DIRECT_SEARCH_SOURCES,
  normalizeDirectSearchQuery
} from "./marketCatalog.js";

export class UkrainianMarketSearchProvider implements SearchProvider {
  readonly name = "ukrainian-market-search";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const normalizedQuery = normalizeDirectSearchQuery(query);
    const includeJdm = shouldIncludeJdm(normalizedQuery);
    const sources = includeJdm
      ? [...UKRAINIAN_DIRECT_SEARCH_SOURCES, ...JDM_DIRECT_SEARCH_SOURCES]
      : UKRAINIAN_DIRECT_SEARCH_SOURCES;
    const sourceLimit = includeJdm ? sources.length : Math.max(limit, 20);

    return sources
      .sort((a, b) => a.priority - b.priority)
      .slice(0, sourceLimit)
      .map((source, index) => ({
        title: `${source.label} search: ${normalizedQuery}`,
        url: source.searchUrl(normalizedQuery),
        snippet: `Direct ${source.group} search page generated from the user query.`,
        sourceProvider: `${this.name}:${source.id}`,
        rank: index + 1
      }));
  }
}

function shouldIncludeJdm(query: string): boolean {
  return /\b(jdm|japan|japanese|shimano|daiwa|megabass|evergreen|tenryu|graphiteleader|yamaga|zenaq|twin\s?power|stella|vanquish|stradic|scorpion|metanium|aldebaran|calcutta|curado|bantam|certate|exist)\b/i.test(query);
}
