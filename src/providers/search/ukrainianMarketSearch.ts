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
    const baseCandidates = sources
      .sort((a, b) => a.priority - b.priority)
      .slice(0, sourceLimit)
      .map((source, index) => ({
        title: `${source.label} search: ${normalizedQuery}`,
        url: source.searchUrl(normalizedQuery),
        snippet: `Direct ${source.group} search page generated from the user query.`,
        sourceProvider: `${this.name}:${source.id}`,
        rank: index + 1
      }));

    return [...baseCandidates, ...createSpecializedJdmCandidates(normalizedQuery, baseCandidates.length)];
  }
}

function shouldIncludeJdm(query: string): boolean {
  return /\b(jdm|japan|japanese|shimano|daiwa|megabass|evergreen|tenryu|graphiteleader|yamaga|zenaq|tict|34|varivas|area\s?rod|ice\s?cube|ic-\d{2,3}[a-z](?:-[a-z]+)?|twin\s?power|stella|vanquish|stradic|scorpion|metanium|aldebaran|calcutta|curado|bantam|certate|exist)\b/i.test(query);
}

function createSpecializedJdmCandidates(query: string, startRank: number): SearchCandidate[] {
  if (!/\bscorpion\b/i.test(query) || !/\bdc\b/i.test(query)) {
    return [];
  }

  return [
    {
      title: "JapanTackle product: Shimano 21 Scorpion DC150/151",
      url: "https://japantackle.com/casting-reels/shimano/low-profile-casting-reels/shimano-21scorpiondc.html",
      snippet: "Site-specific JDM product page for Shimano Scorpion DC 150/151 variants.",
      sourceProvider: "ukrainian-market-search:japantackle-detail",
      rank: startRank + 1
    },
    {
      title: "JDM Tackle Heaven collection: Shimano Scorpion DC",
      url: "https://jdmtackleheaven.com/collections/shimano-scorpion-dc",
      snippet: "Site-specific Shopify collection for Shimano Scorpion DC variants.",
      sourceProvider: "ukrainian-market-search:jdmtackleheaven-collection",
      rank: startRank + 2
    }
  ];
}
