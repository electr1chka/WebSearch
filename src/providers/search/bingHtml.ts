import * as cheerio from "cheerio";
import { fetchText } from "../../utils/http.js";
import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";

export class BingHtmlProvider implements SearchProvider {
  readonly name = "bing-html";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL("https://www.bing.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(limit, 20)));

    const { text } = await fetchText(url.toString(), {
      headers: {
        "accept-language": "en-US,en;q=0.9,ja;q=0.8,uk;q=0.7"
      }
    });
    const $ = cheerio.load(text);
    const results: SearchCandidate[] = [];

    $("li.b_algo").each((index, element) => {
      if (results.length >= limit) {
        return false;
      }

      const link = $(element).find("h2 a").first();
      const url = unwrapBingUrl(link.attr("href"));
      const title = link.text().replace(/\s+/g, " ").trim();
      const snippet = $(element).find(".b_caption p").first().text().replace(/\s+/g, " ").trim();

      if (url && title && /^https?:\/\//.test(url)) {
        results.push({
          title,
          url,
          snippet,
          sourceProvider: this.name,
          rank: index + 1
        });
      }

      return undefined;
    });

    return results;
  }
}

function unwrapBingUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    const encoded = url.searchParams.get("u");

    if (!encoded) {
      return rawUrl;
    }

    const payload = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");

    return decoded.startsWith("http") ? decoded : rawUrl;
  } catch {
    return rawUrl;
  }
}
