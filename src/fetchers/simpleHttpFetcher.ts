import * as cheerio from "cheerio";
import { fetchText } from "../utils/http.js";
import type { FetchedPage } from "../types.js";
import type { PageFetcher } from "./types.js";

export class SimpleHttpFetcher implements PageFetcher {
  readonly name = "simple-http";

  isConfigured(): boolean {
    return true;
  }

  async fetch(url: string): Promise<FetchedPage> {
    const { text, status, finalUrl } = await fetchText(url);
    const $ = cheerio.load(text);
    const title = $("title").first().text().replace(/\s+/g, " ").trim() || undefined;
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 80_000);

    return {
      url,
      finalUrl,
      title,
      html: text,
      text: bodyText,
      status,
      fetcher: this.name
    };
  }
}
