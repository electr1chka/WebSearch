import type { SearchCandidate } from "../../types.js";
import { fetchJson } from "../../utils/http.js";
import type { SearchProvider } from "./types.js";

interface RozetkaSearchResponse {
  data?: {
    goods?: Array<{
      id?: number;
      relevance?: number | null;
    }>;
    meta?: {
      h1?: string;
      title?: string;
    };
  };
}

interface RozetkaProductMainResponse {
  data?: {
    id?: number;
    title?: string;
    price?: number;
    old_price?: number;
    href?: string;
    sell_status?: string;
    status?: string;
  };
}

const ROZETKA_SEARCH_API = "https://search.rozetka.com.ua/search/api/v6/";
const ROZETKA_PRODUCT_MAIN_API = "https://product-api.rozetka.com.ua/v4/goods/get-main";
const MAX_ROZETKA_RESULTS = 12;

export class RozetkaSearchProvider implements SearchProvider {
  readonly name = "rozetka-api";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL(ROZETKA_SEARCH_API);
    url.searchParams.set("text", query);
    url.searchParams.set("lang", "ua");

    const response = await fetchJson<RozetkaSearchResponse>(url.toString(), {
      headers: {
        "accept": "application/json",
        "origin": "https://rozetka.com.ua",
        "referer": "https://rozetka.com.ua/ua/"
      }
    });
    const goods = (response.data?.goods ?? [])
      .filter((item): item is { id: number; relevance?: number | null } => Number.isFinite(item.id))
      .slice(0, Math.min(limit, MAX_ROZETKA_RESULTS));
    const products = await Promise.allSettled(goods.map((item) => fetchRozetkaProductMain(item.id)));

    return products.flatMap((result, index) => {
      if (result.status !== "fulfilled") {
        return [];
      }

      const product = result.value.data;

      if (!product) {
        return [];
      }

      const productId = product.id;

      if (typeof productId !== "number" || !Number.isFinite(productId)) {
        return [];
      }

      const productUrl = createRozetkaProductMainUrl(productId);
      const price = product.price ? `${product.price} UAH` : undefined;
      const availability = product.sell_status ?? product.status;
      const fallbackSnippet = response.data?.meta?.title ?? `Rozetka search API result for ${query}`;

      return [{
        title: product.title ?? `Rozetka product ${productId}`,
        url: productUrl,
        snippet: [price, availability, product.href].filter(Boolean).join(" | ") || fallbackSnippet,
        sourceProvider: this.name,
        rank: index + 1
      }];
    });
  }
}

function createRozetkaProductMainUrl(goodsId: number): string {
  const url = new URL(ROZETKA_PRODUCT_MAIN_API);
  url.searchParams.set("goodsId", String(goodsId));
  url.searchParams.set("front-type", "xl");
  url.searchParams.set("country", "UA");
  url.searchParams.set("lang", "ua");
  return url.toString();
}

async function fetchRozetkaProductMain(goodsId: number): Promise<RozetkaProductMainResponse> {
  return fetchJson<RozetkaProductMainResponse>(createRozetkaProductMainUrl(goodsId), {
    headers: {
      "accept": "application/json",
      "referer": "https://rozetka.com.ua/ua/",
      "user-agent": "2bad/rozetka"
    }
  });
}
