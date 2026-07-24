import type { Page } from "playwright";
import type { FetchedPage } from "../types.js";
import { isBlockedPage } from "./blockedPage.js";
import type { PageFetcher } from "./types.js";

export interface BrowserFetcherOptions {
  headless: boolean;
  humanInLoop: boolean;
  solveTimeoutMs: number;
  userDataDir?: string;
}

export class BrowserFetcher implements PageFetcher {
  readonly name = "playwright-browser";

  constructor(private readonly options: BrowserFetcherOptions) {}

  isConfigured(): boolean {
    return true;
  }

  async fetch(url: string): Promise<FetchedPage> {
    const { chromium } = await import("playwright");
    const headless = this.options.humanInLoop ? false : this.options.headless;
    const context = this.options.userDataDir || this.options.humanInLoop
      ? await chromium.launchPersistentContext(this.options.userDataDir ?? "results/browser-profile", {
          headless,
          locale: "uk-UA",
          userAgent: BROWSER_USER_AGENT
        })
      : undefined;
    const browser = context ? undefined : await chromium.launch({ headless });

    try {
      const page = context
        ? await context.newPage()
        : await browser!.newPage({
            locale: "uk-UA",
            userAgent: BROWSER_USER_AGENT
          });

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.mouse.wheel(0, 1600).catch(() => undefined);
      await page.waitForTimeout(800);

      let fetched = await collectPage(url, page, response?.status());

      if (this.options.humanInLoop && isBlockedPage(fetched)) {
        console.error(`Manual browser check required: ${url}`);
        console.error(`Solve the challenge in the opened browser. Waiting up to ${Math.round(this.options.solveTimeoutMs / 1000)} seconds.`);
        await page.waitForFunction(() => {
          const title = document.title.toLowerCase();
          const text = document.body?.innerText.toLowerCase() ?? "";
          const html = document.documentElement.outerHTML.toLowerCase();
          return !(
            title.includes("just a moment") ||
            text.includes("verify you are human") ||
            text.includes("checking your browser") ||
            html.includes("challenges.cloudflare.com") ||
            html.includes("cf-chl")
          );
        }, undefined, { timeout: this.options.solveTimeoutMs }).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        fetched = await collectPage(url, page, response?.status());
      }

      return fetched;
    } catch (error) {
      if (error instanceof Error && /Executable doesn't exist|playwright install/i.test(error.message)) {
        console.error("Playwright browser is not installed. Run: npx playwright install chromium");
      }

      throw error;
    } finally {
      await context?.close();
      await browser?.close();
    }
  }
}

async function collectPage(url: string, page: Page, status?: number): Promise<FetchedPage> {
  const title = await page.title().catch(() => undefined);
  const html = await page.content();
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => undefined);

  return {
    url,
    finalUrl: page.url(),
    title,
    html,
    text,
    status,
    fetcher: "playwright-browser"
  };
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
