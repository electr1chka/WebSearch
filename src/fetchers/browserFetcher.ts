import type { FetchedPage } from "../types.js";
import type { PageFetcher } from "./types.js";

export class BrowserFetcher implements PageFetcher {
  readonly name = "playwright-browser";

  isConfigured(): boolean {
    return true;
  }

  async fetch(url: string): Promise<FetchedPage> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        locale: "uk-UA",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      });

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.mouse.wheel(0, 1600).catch(() => undefined);
      await page.waitForTimeout(800);

      const title = await page.title().catch(() => undefined);
      const html = await page.content();
      const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => undefined);

      return {
        url,
        finalUrl: page.url(),
        title,
        html,
        text,
        status: response?.status(),
        fetcher: this.name
      };
    } finally {
      await browser.close();
    }
  }
}
