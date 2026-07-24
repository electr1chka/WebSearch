import * as cheerio from "cheerio";
import type { FetchedPage, ProductResult } from "../types.js";
import { extractJsonLd, isRecord } from "./jsonLd.js";
import { toAbsoluteUrl } from "../utils/http.js";

const MAX_PRODUCTS_PER_PAGE = 12;

export function extractProductList(page: FetchedPage): ProductResult[] {
  const host = safeHost(page.finalUrl);

  if (!host) {
    return [];
  }

  if (host.includes("olx.ua")) {
    return extractOlxList(page);
  }

  if (host.includes("prom.ua") || host.includes("bigl.ua")) {
    return extractJsonLdProductList(page, host, "json-ld Product list");
  }

  if (host.includes("hotline.ua")) {
    return extractHotlineList(page);
  }

  if (host.includes("zabros.com.ua")) {
    return extractZabrosList(page);
  }

  if (host.includes("fish-fish.com.ua")) {
    return extractFishFishList(page);
  }

  if (host.includes("aquatory.com.ua")) {
    return extractAquatoryList(page);
  }

  if (host.includes("daiwa.in.ua")) {
    return extractDaiwaList(page);
  }

  return extractJsonLdProductList(page, host, "generic json-ld Product list");
}

function extractOlxList(page: FetchedPage): ProductResult[] {
  const html = page.html ?? "";
  const match = html.match(/window\.__PRERENDERED_STATE__=\s*("(?:\\.|[^"\\])*")/);

  if (!match) {
    return [];
  }

  try {
    const state = JSON.parse(JSON.parse(match[1])) as unknown;
    const ads = getPath(state, ["listing", "listing", "ads"]);

    if (!Array.isArray(ads)) {
      return [];
    }

    return ads
      .filter(isRecord)
      .map((ad): ProductResult | undefined => {
        const title = stringValue(ad.title);
        const url = stringValue(ad.url);

        if (!title || !url) {
          return undefined;
        }

        const price = getPath(ad, ["price", "regularPrice", "value"]);
        const currency = getPath(ad, ["price", "regularPrice", "currencyCode"]);
        const condition = extractOlxCondition(ad);
        const location = stringValue(getPath(ad, ["location", "pathName"]));
        const image = Array.isArray(ad.photos) ? stringValue(ad.photos[0]) : undefined;

        return {
          title,
          url,
          price: numberValue(price),
          currency: stringValue(currency) ?? "UAH",
          availability: "listed",
          condition,
          seller: location,
          imageUrl: image,
          sourceSite: "olx.ua",
          evidence: ["olx prerendered listing state"],
          confidence: 0.9
        };
      })
      .filter(Boolean)
      .slice(0, MAX_PRODUCTS_PER_PAGE) as ProductResult[];
  } catch {
    return [];
  }
}

function extractJsonLdProductList(page: FetchedPage, sourceSite: string, evidence: string): ProductResult[] {
  return extractJsonLd(page.html)
    .filter(isRecord)
    .filter((node) => jsonLdTypeIncludes(node, "Product"))
    .map((node): ProductResult | undefined => {
      const title = stringValue(node.name);
      const url = stringValue(node.url) ?? stringValue(getPath(node, ["offers", "url"]));

      if (!title || !url) {
        return undefined;
      }

      const offers = firstRecord(node.offers);
      const image = Array.isArray(node.image) ? stringValue(node.image[0]) : stringValue(node.image);
      const seller = stringValue(getPath(offers, ["seller", "name"])) ?? stringValue(getPath(node, ["brand", "name"]));

      return {
        title,
        url: toAbsoluteUrl(url, page.finalUrl) ?? url,
        price: numberValue(offers?.price),
        currency: stringValue(offers?.priceCurrency),
        availability: normalizeAvailability(stringValue(offers?.availability)),
        condition: normalizeAvailability(stringValue(offers?.itemCondition)),
        seller,
        imageUrl: image ? toAbsoluteUrl(image, page.finalUrl) ?? image : undefined,
        sourceSite,
        evidence: [evidence],
        confidence: 0.82
      };
    })
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS_PER_PAGE) as ProductResult[];
}

function extractHotlineList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".list-item").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.item-title[href], a[href*='/ua/']").filter((__, link) => {
      const href = $(link).attr("href") ?? "";
      const text = cleanText($(link).text());
      return text.length > 8 && !href.includes("tab=reviews") && !href.includes("/sr/");
    }).first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const price = extractPrice(cardText);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "hotline.ua",
      evidence: [price.raw ? `hotline list item; price pattern: ${price.raw}` : "hotline list item"],
      confidence: price.amount ? 0.78 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractZabrosList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".catalog-item").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.catalog-item-link[href], a[href*='/ua/']").filter((__, link) => {
      const text = cleanText($(link).text());
      const href = $(link).attr("href") ?? "";
      return text.length > 8 && !href.includes("#comments");
    }).first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const price = extractPrice(cardText);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: /є в наявності/i.test(cardText) ? "in_stock" : "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "zabros.com.ua",
      evidence: [price.raw ? `zabros catalog item; price pattern: ${price.raw}` : "zabros catalog item"],
      confidence: price.amount ? 0.76 : 0.66
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractDaiwaList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".product-layout").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a[href]").filter((__, link) => {
      const href = $(link).attr("href") ?? "";
      const text = cleanText($(link).text());
      return text.length > 6 && /^https?:\/\//.test(href);
    }).last();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const price = extractLastPrice(cardText);
    const image = card.find("img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: /в корзину|купити/i.test(cardText) ? "in_stock" : "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "daiwa.in.ua",
      evidence: [price.raw ? `daiwa product grid; price pattern: ${price.raw}` : "daiwa product grid"],
      confidence: price.amount ? 0.76 : 0.66
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractFishFishList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".product-brief[data-product-brief]").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.product-brief__name[href]").first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const cardText = cleanText(card.text());
    const priceText = cleanText(card.find("[data-product-brief-price], .product-brief__price").first().text());
    const price = extractPrice(priceText || cardText);
    const image = card.find("a[data-product-brief-picture] img[src], img[src], img[data-src]").first();
    const rawImage = image.attr("src") ?? image.attr("data-src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, page.finalUrl) ?? rawUrl,
      price: price.amount,
      currency: price.currency,
      availability: /купити|в кошик|вибрати/i.test(cardText) ? "in_stock" : "listed",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "fish-fish.com.ua",
      evidence: [price.raw ? `fish-fish product brief; price pattern: ${price.raw}` : "fish-fish product brief"],
      confidence: price.amount ? 0.77 : 0.67
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractAquatoryList(page: FetchedPage): ProductResult[] {
  const $ = cheerio.load(page.html ?? "");
  const products: ProductResult[] = [];

  $(".preview.fn_product").each((_, element) => {
    if (products.length >= MAX_PRODUCTS_PER_PAGE) {
      return false;
    }

    const card = $(element);
    const titleLink = card.find("a.product_name[href]").first();
    const title = cleanText(titleLink.text());
    const rawUrl = titleLink.attr("href");

    if (!title || !rawUrl) {
      return undefined;
    }

    const priceText = cleanText(card.find(".price .fn_price").first().text());
    const currency = cleanText(card.find(".price_currency").first().text());
    const cardText = cleanText(card.text());
    const image = card.find("img.preview_img[src], img.fn_img[src]").first();
    const rawImage = image.attr("src");

    products.push({
      title,
      url: toAbsoluteUrl(rawUrl, "https://aquatory.com.ua/") ?? rawUrl,
      price: numberValue(priceText),
      currency: normalizeCurrency(currency) ?? "UAH",
      availability: /купити|в наявності/i.test(cardText) ? "in_stock" : "listed",
      condition: "new",
      imageUrl: rawImage ? toAbsoluteUrl(rawImage, page.finalUrl) ?? rawImage : undefined,
      sourceSite: "aquatory.com.ua",
      evidence: [priceText ? `aquatory product card; price ${priceText} ${currency}` : "aquatory product card"],
      confidence: priceText ? 0.79 : 0.68
    });

    return undefined;
  });

  return dedupeProducts(products);
}

function extractOlxCondition(ad: Record<string, unknown>): string | undefined {
  const params = ad.params;

  if (!Array.isArray(params)) {
    return undefined;
  }

  const state = params.filter(isRecord).find((param) => param.key === "state");
  return stringValue(state?.normalizedValue) ?? stringValue(state?.value);
}

function jsonLdTypeIncludes(node: Record<string, unknown>, typeName: string): boolean {
  const type = node["@type"];
  return Array.isArray(type) ? type.includes(typeName) : type === typeName;
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value) && Array.isArray(value.offers)) {
    return value.offers.find(isRecord) ?? value;
  }

  if (Array.isArray(value)) {
    return value.find(isRecord);
  }

  return isRecord(value) ? value : undefined;
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
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
    /(?<amount>\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[.,]\d+)?)\s?(?<currency>грн|₴|UAH)/i,
    /(?<currency>грн|₴|UAH)\s?(?<amount>\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[.,]\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const amount = match?.groups?.amount;

    if (amount) {
      return {
        amount: Number.parseFloat(amount.replace(/[ \u00a0]/g, "").replace(",", ".")),
        currency: normalizeCurrency(match?.groups?.currency),
        raw: match?.[0]
      };
    }
  }

  return {};
}

function extractLastPrice(text: string): { amount?: number; currency?: string; raw?: string } {
  const matches = [
    ...text.matchAll(/(?<amount>\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[.,]\d+)?)\s?(?<currency>грн|₴|UAH)/gi),
    ...text.matchAll(/(?<currency>грн|₴|UAH)\s?(?<amount>\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[.,]\d+)?)/gi)
  ];
  const match = matches.at(-1);
  const amount = match?.groups?.amount;

  if (!amount) {
    return {};
  }

  return {
    amount: Number.parseFloat(amount.replace(/[ \u00a0]/g, "").replace(",", ".")),
    currency: normalizeCurrency(match?.groups?.currency),
    raw: match?.[0]
  };
}

function normalizeCurrency(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  const map: Record<string, string> = {
    "₴": "UAH",
    "ГРН": "UAH"
  };

  return map[upper] ?? upper;
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

function dedupeProducts(products: ProductResult[]): ProductResult[] {
  const byUrl = new Map<string, ProductResult>();

  for (const product of products) {
    if (!byUrl.has(product.url)) {
      byUrl.set(product.url, product);
    }
  }

  return [...byUrl.values()];
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}
