import type { ProductResult } from "../types.js";

export function canonicalProductUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/g, "") || "/";

    const shopifyProductPath = url.pathname.match(/^\/collections\/[^/]+(\/products\/[^/]+)$/);
    if (shopifyProductPath) {
      url.pathname = shopifyProductPath[1] ?? url.pathname;
    }

    for (const param of [...url.searchParams.keys()]) {
      const normalizedParam = param.toLowerCase();

      if (normalizedParam.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(normalizedParam)) {
        url.searchParams.delete(param);
      }
    }

    url.searchParams.sort();
    return url.toString();
  } catch {
    return undefined;
  }
}

export function productIdentityKey(product: ProductResult): string {
  const canonicalUrl = canonicalProductUrl(product.url);

  if (canonicalUrl) {
    return `url:${canonicalUrl}`;
  }

  return [
    "signature",
    normalizeProductSource(product.sourceSite) ?? safeHost(product.url) ?? "unknown-source",
    normalizeProductSeller(product) ?? "unknown-seller",
    normalizeText(product.title),
    product.price ?? "unknown-price"
  ].join(":");
}

export function normalizeProductSource(source: string | undefined): string | undefined {
  return source?.replace(/^www\./, "").trim().toLowerCase() || undefined;
}

export function normalizeProductSeller(product: ProductResult): string | undefined {
  const seller = product.seller?.replace(/\s+/g, " ").trim();

  if (seller) {
    return seller;
  }

  return normalizeProductSource(product.sourceSite);
}

function safeHost(value: string): string | undefined {
  try {
    return new URL(value).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, "-");
}

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "yclid",
  "msclkid",
  "_pos",
  "_sid",
  "_ss",
  "ref",
  "referrer",
  "utm"
]);
