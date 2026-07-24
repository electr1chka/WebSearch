import type { SearchCandidate } from "../../types.js";
import { fetchJson } from "../../utils/http.js";
import type { SearchProvider } from "./types.js";

interface IbisSearchResponse {
  results?: {
    items?: IbisSearchItem[];
  };
}

interface IbisSearchItem {
  id?: string;
  brand?: string;
  name?: string;
  url?: string;
  price?: number;
  currency?: string;
  is_presence?: boolean;
}

const IBIS_SITE_ID = "12494";
const IBIS_SECURITY_KEY = "8cc5196edad15508395941c8c572fee5";

export class IbisSearchProvider implements SearchProvider {
  readonly name = "ibis-api";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL("https://api.multisearch.io/");
    url.searchParams.set("id", IBIS_SITE_ID);
    url.searchParams.set("key", IBIS_SECURITY_KEY);
    url.searchParams.set("query", query);
    url.searchParams.set("categories", "0");
    url.searchParams.set("fields", "true");
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));
    url.searchParams.set("offset", "0");
    url.searchParams.set("lang", "uk");
    url.searchParams.set("sort", "relevance");
    url.searchParams.set("filters", "true");

    const data = await fetchJson<IbisSearchResponse>(url.toString(), {
      headers: {
        "accept": "application/json"
      }
    });

    return (data.results?.items ?? [])
      .filter((item) => item.url && item.name)
      .slice(0, Math.min(limit, 20))
      .map((item, index) => ({
        title: item.name ?? item.url ?? "IBIS product",
        url: normalizeIbisUrl(item.url ?? ""),
        snippet: [
          item.brand,
          normalizeIbisPrice(item.price, item.currency),
          item.is_presence ? "in stock" : undefined
        ].filter(Boolean).join(" | "),
        sourceProvider: this.name,
        rank: index + 1
      }));
  }
}

function normalizeIbisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.host = "ibis-gear.com";
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeIbisPrice(price?: number, currency?: string): string | undefined {
  if (!price) {
    return undefined;
  }

  return `${Math.round(price / 100)} ${normalizeCurrency(currency)}`;
}

function normalizeCurrency(currency?: string): string {
  if (!currency) {
    return "UAH";
  }

  return /^грн$/i.test(currency) ? "UAH" : currency;
}
