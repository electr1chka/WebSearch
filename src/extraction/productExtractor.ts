import * as cheerio from "cheerio";
import type { AgentConfig, FetchedPage, ProductResult } from "../types.js";
import { chatJson, isLlmConfigured } from "../llm/client.js";
import { extractJsonLd, isRecord } from "./jsonLd.js";

interface LlmProductExtraction {
  title?: string;
  price?: number;
  currency?: string;
  availability?: string;
  condition?: string;
  seller?: string;
  imageUrl?: string;
  evidence?: string[];
  confidence?: number;
}

export async function extractProduct(page: FetchedPage, config: AgentConfig): Promise<ProductResult | undefined> {
  const structured = extractFromStructuredData(page);
  const heuristic = extractHeuristically(page);
  const merged = mergeProducts(page, structured, heuristic);

  if (isLlmConfigured(config) && shouldUseLlm(merged)) {
    const llm = await extractWithLlm(page, config).catch(() => undefined);
    return mergeProducts(page, merged, llm);
  }

  return merged.confidence >= 0.25 ? merged : undefined;
}

function extractFromStructuredData(page: FetchedPage): LlmProductExtraction | undefined {
  const nodes = extractJsonLd(page.html);
  const productNode = nodes.find((node) => {
    if (!isRecord(node)) {
      return false;
    }

    const type = node["@type"];
    return Array.isArray(type) ? type.includes("Product") : type === "Product";
  });

  if (!isRecord(productNode)) {
    return undefined;
  }

  const offers = normalizeOffer(productNode.offers);
  const image = Array.isArray(productNode.image) ? productNode.image[0] : productNode.image;

  return {
    title: stringValue(productNode.name),
    price: numberValue(offers?.price ?? productNode.price),
    currency: stringValue(offers?.priceCurrency ?? productNode.priceCurrency),
    availability: normalizeAvailability(stringValue(offers?.availability)),
    condition: normalizeAvailability(stringValue(offers?.itemCondition)),
    imageUrl: stringValue(image),
    evidence: ["json-ld Product"],
    confidence: 0.78
  };
}

function extractHeuristically(page: FetchedPage): LlmProductExtraction {
  const $ = cheerio.load(page.html ?? "");
  const metaTitle =
    $('meta[property="og:title"]').attr("content") ??
    $("title").first().text() ??
    page.title ??
    firstMeaningfulLine(page.text);
  const isSearchPage = isLikelySearchResultsPage(page.finalUrl, metaTitle) || isLikelySearchResultsPage(page.url, metaTitle);
  const imageUrl = $('meta[property="og:image"]').attr("content") ?? undefined;
  const text = `${page.title ?? ""}\n${page.text ?? page.markdown ?? ""}`.slice(0, 80_000);
  const price = isSearchPage ? {} : extractPrice(text);
  const availability = isSearchPage ? undefined : extractAvailability(text);
  const condition = isSearchPage ? undefined : extractCondition(text);
  const evidence = [
    isSearchPage ? "search results page" : undefined,
    price.raw ? `price pattern: ${price.raw}` : undefined,
    availability ? `availability pattern: ${availability}` : undefined,
    condition ? `condition pattern: ${condition}` : undefined
  ].filter(Boolean) as string[];

  return {
    title: cleanTitle(metaTitle),
    price: price.amount,
    currency: price.currency,
    availability,
    condition,
    imageUrl,
    evidence,
    confidence: isSearchPage ? 0.35 : [metaTitle, price.amount, availability, condition].filter(Boolean).length / 6
  };
}

async function extractWithLlm(page: FetchedPage, config: AgentConfig): Promise<LlmProductExtraction | undefined> {
  const pageText = [
    `URL: ${page.finalUrl}`,
    `Title: ${page.title ?? ""}`,
    (page.markdown ?? page.text ?? "").slice(0, 18_000)
  ].join("\n\n");

  const parsed = await chatJson<LlmProductExtraction>(config, {
    temperature: 0,
    system:
      "Extract product listing data from a webpage. Return compact JSON only with keys: title, price, currency, availability, condition, seller, imageUrl, evidence, confidence. Use null for unknown values. confidence must be 0..1.",
    user: pageText
  });

  if (!parsed) {
    return undefined;
  }

  return {
    ...parsed,
    evidence: parsed.evidence?.slice(0, 5),
    confidence: clamp(parsed.confidence ?? 0.5, 0, 1)
  };
}

function mergeProducts(
  page: FetchedPage,
  primary?: LlmProductExtraction | ProductResult,
  secondary?: LlmProductExtraction
): ProductResult {
  const sourceSite = safeHost(page.finalUrl);
  const title = primary?.title ?? secondary?.title ?? page.title ?? sourceSite ?? page.finalUrl;
  const confidence = Math.max(primary?.confidence ?? 0, secondary?.confidence ?? 0, 0.15);

  return {
    title,
    url: page.finalUrl,
    price: primary?.price ?? secondary?.price,
    currency: primary?.currency ?? secondary?.currency,
    availability: primary?.availability ?? secondary?.availability,
    condition: primary?.condition ?? secondary?.condition,
    seller: primary?.seller ?? secondary?.seller,
    imageUrl: primary?.imageUrl ?? secondary?.imageUrl,
    sourceSite,
    evidence: unique([...(primary?.evidence ?? []), ...(secondary?.evidence ?? [])]).slice(0, 8),
    confidence
  };
}

function normalizeOffer(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value) && Array.isArray(value.offers)) {
    return value.offers.find(isRecord) ?? value;
  }

  if (Array.isArray(value)) {
    return value.find(isRecord);
  }

  return isRecord(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/[^\d.,\s\u00a0]/g, "").replace(/[\s\u00a0]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractPrice(text: string): { amount?: number; currency?: string; raw?: string } {
  const patterns = [
    /(?<currency>¥|￥|JPY)\s?(?<amount>\d{1,3}(?:[,\s\u00a0]\d{3})+|\d+(?:\.\d+)?)/i,
    /(?<amount>\d{1,3}(?:[,\s\u00a0]\d{3})+|\d+(?:\.\d+)?)\s?(?<currency>円|JPY|USD|EUR|UAH|грн|₴|\$|€)/i,
    /(?<currency>\$|€|₴)\s?(?<amount>\d{1,3}(?:[,\s\u00a0]\d{3})+|\d+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const amount = match?.groups?.amount;
    const currency = normalizeCurrency(match?.groups?.currency);

    if (amount) {
      return {
        amount: Number.parseFloat(amount.replace(/[,\s\u00a0]/g, "")),
        currency,
        raw: match?.[0]
      };
    }
  }

  return {};
}

function extractAvailability(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (/sold out|out of stock|売り切れ|在庫なし|продано|немає в наявності/.test(lower)) {
    return "out_of_stock";
  }

  if (/in stock|available|在庫あり|販売中|в наявності/.test(lower)) {
    return "in_stock";
  }

  return undefined;
}

function extractCondition(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (/中古|used|pre-owned|second hand|б\/в|вживан/.test(lower)) {
    return "used";
  }

  if (/新品|new with tags|brand new|новий|нова/.test(lower)) {
    return "new";
  }

  return undefined;
}

function normalizeCurrency(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  const map: Record<string, string> = {
    "¥": "JPY",
    "￥": "JPY",
    "円": "JPY",
    "$": "USD",
    "€": "EUR",
    "₴": "UAH",
    "ГРН": "UAH"
  };

  return map[upper] ?? map[value] ?? upper;
}

function normalizeAvailability(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/OutOfStock|SoldOut/i.test(value)) {
    return "out_of_stock";
  }

  if (/InStock|Available/i.test(value)) {
    return "in_stock";
  }

  if (/UsedCondition/i.test(value)) {
    return "used";
  }

  if (/NewCondition/i.test(value)) {
    return "new";
  }

  return value;
}

function cleanTitle(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\s+/g, " ").replace(/\s+[|｜-]\s+.*$/, "").trim();
}

function firstMeaningfulLine(text?: string): string | undefined {
  return text
    ?.split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 8);
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function shouldUseLlm(product: ProductResult): boolean {
  return product.confidence < 0.65 || !product.price || !product.currency;
}

function isLikelySearchResultsPage(url: string, title?: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    const titleText = title?.toLowerCase() ?? "";

    return (
      path.includes("/search") ||
      path.includes("/s/") ||
      query.includes("keyword=") ||
      query.includes("search=") ||
      query.includes("search_=") ||
      query.includes("search_term=") ||
      query.includes("?p=") ||
      query.includes("&p=") ||
      query.includes("q=") ||
      titleText.includes("search") ||
      titleText.includes("検索") ||
      titleText.includes("一覧")
    );
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
