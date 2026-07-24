import type { SearchCandidate } from "../../types.js";
import { fetchJson } from "../../utils/http.js";
import type { SearchProvider } from "./types.js";

interface ShimanoKievSearchResponse {
  success?: boolean;
  data?: {
    items?: ShimanoKievSearchItem[];
  };
}

interface ShimanoKievSearchItem {
  id?: string;
  sku?: string;
  name?: string;
  url?: string;
  image?: string;
  price?: number;
  full_price?: number;
  available?: number;
  brand_name?: string;
}

const TARGIO_API_URL = "https://8fc5dd601c.targio.io/7ea2692baa065a3682bb2aba980c1551:uk/v1";

export class ShimanoKievSearchProvider implements SearchProvider {
  readonly name = "shimano-kiev-api";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL(TARGIO_API_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));
    url.searchParams.set("is_grouped", "0");
    url.searchParams.set("is_strict", "0");

    const data = await fetchJson<ShimanoKievSearchResponse>(url.toString(), {
      headers: {
        "accept": "application/json",
        "origin": "https://shimano.kiev.ua",
        "referer": "https://shimano.kiev.ua/"
      }
    });

    return (data.data?.items ?? [])
      .filter((item) => item.url && item.name)
      .slice(0, Math.min(limit, 20))
      .map((item, index) => ({
        title: item.name ?? item.url ?? "Shimano Kiev product",
        url: normalizeShimanoKievUrl(item.url ?? ""),
        snippet: [
          item.brand_name,
          item.sku ? `SKU ${item.sku}` : undefined,
          item.price ? `${item.price} UAH` : undefined,
          item.available ? "in stock" : undefined
        ].filter(Boolean).join(" | "),
        sourceProvider: this.name,
        rank: index + 1
      }));
  }
}

function normalizeShimanoKievUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.host = "shimano.kiev.ua";
    parsed.protocol = "https:";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
