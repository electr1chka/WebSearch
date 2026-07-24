import * as cheerio from "cheerio";
import { fetchText, toAbsoluteUrl } from "../../utils/http.js";
import type { SearchCandidate } from "../../types.js";
import type { SearchProvider } from "./types.js";

export class DuckDuckGoHtmlProvider implements SearchProvider {
  readonly name = "duckduckgo-html";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, limit: number): Promise<SearchCandidate[]> {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);

    const { text } = await fetchText(url.toString(), {
      method: "GET"
    });
    const $ = cheerio.load(text);
    const results: SearchCandidate[] = [];

    $(".result").each((index, element) => {
      if (results.length >= limit) {
        return false;
      }

      const titleNode = $(element).find(".result__title a").first();
      const rawHref = titleNode.attr("href");
      const absoluteUrl = rawHref ? unwrapDuckDuckGoUrl(toAbsoluteUrl(rawHref, url.toString()) ?? rawHref) : undefined;
      const title = titleNode.text().replace(/\s+/g, " ").trim();
      const snippet = $(element).find(".result__snippet").text().replace(/\s+/g, " ").trim();

      if (absoluteUrl && title) {
        results.push({
          title,
          url: absoluteUrl,
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

function unwrapDuckDuckGoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const uddg = parsed.searchParams.get("uddg");

    if (uddg) {
      return decodeURIComponent(uddg);
    }

    return url;
  } catch {
    return url;
  }
}
