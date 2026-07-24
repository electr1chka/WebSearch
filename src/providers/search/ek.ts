import * as cheerio from "cheerio";
import type { SearchCandidate } from "../../types.js";
import { fetchText, toAbsoluteUrl } from "../../utils/http.js";
import type { SearchProvider } from "./types.js";

const EK_QUICK_SEARCH_URL = "https://ek.ua/ua/mtools/mui_qs3.php";
const MAX_EK_RESULTS = 10;

export class EkSearchProvider implements SearchProvider {
  readonly name = "ek-api";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL(EK_QUICK_SEARCH_URL);
    url.searchParams.set("input_dom_id_", "ek-search");
    url.searchParams.set("data_", query);

    const response = await fetchText(url.toString(), {
      headers: {
        "accept": "text/html,*/*;q=0.8",
        "referer": "https://ek.ua/ua/",
        "x-requested-with": "XMLHttpRequest"
      }
    });

    const $ = cheerio.load(response.text);
    const candidates: SearchCandidate[] = [];

    $("a.qs-link[href]").each((index, element) => {
      if (candidates.length >= Math.min(limit, MAX_EK_RESULTS)) {
        return false;
      }

      const link = $(element);
      const rawUrl = link.attr("href");
      const url = rawUrl ? toAbsoluteUrl(rawUrl, "https://ek.ua/") : undefined;
      const title = cleanText(link.find(".qs-str").text());

      if (!url || !title || !isProductUrl(url)) {
        return undefined;
      }

      const price = cleanText(link.find(".qs-model-price").text());

      candidates.push({
        title,
        url,
        snippet: price ? `E-Katalog quick search | ${price}` : "E-Katalog quick search",
        sourceProvider: this.name,
        rank: index + 1
      });

      return undefined;
    });

    return candidates;
  }
}

function isProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.host === "ek.ua" && /\/ua\/[A-Z0-9-]+\.htm$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
