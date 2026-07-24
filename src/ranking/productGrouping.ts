import type { ProductGroup, ProductResult } from "../types.js";
import {
  normalizeProductSeller,
  normalizeProductSource,
  productIdentityKey
} from "../utils/productIdentity.js";
import { extractModelCodes, modelFamilyKeys } from "./modelResolver.js";

export function groupProducts(products: ProductResult[]): ProductGroup[] {
  const groups = new Map<string, ProductResult[]>();

  for (const product of products) {
    const key = groupKey(product);
    const offers = groups.get(key) ?? [];
    offers.push(product);
    groups.set(key, offers);
  }

  return [...groups.entries()]
    .map(([key, offers]) => createGroup(key, offers))
    .sort((a, b) => {
      const countDelta = b.offerCount - a.offerCount;
      if (countDelta !== 0) {
        return countDelta;
      }

      const relevanceDelta = (b.bestOffer.relevanceScore ?? 0) - (a.bestOffer.relevanceScore ?? 0);
      if (Math.abs(relevanceDelta) > 0.001) {
        return relevanceDelta;
      }

      return (a.minPrice ?? Number.MAX_SAFE_INTEGER) - (b.minPrice ?? Number.MAX_SAFE_INTEGER);
    });
}

function createGroup(key: string, offers: ProductResult[]): ProductGroup {
  const sortedOffers = dedupeOffers(offers).sort(compareOffers);
  const bestOffer = sortedOffers[0];
  const prices = sortedOffers.map((offer) => offer.price).filter((price): price is number => Number.isFinite(price));
  const sources = uniqueValues(sortedOffers.map((offer) => normalizeProductSource(offer.sourceSite)).filter(isDefined));
  const sellers = uniqueValues(sortedOffers.map((offer) => normalizeProductSeller(offer)).filter(isDefined));
  const modelCodes = [...new Set(sortedOffers.flatMap((offer) => offer.normalized?.modelCodes ?? []))];
  const brand = bestOffer.normalized?.brand;
  const modelKey = firstModelFamily(bestOffer);

  return {
    key,
    label: createLabel(bestOffer, brand, modelKey),
    brand,
    modelKey,
    modelCodes,
    offerCount: sortedOffers.length,
    sources,
    sellers,
    sellerCount: sellers.length,
    minPrice: prices.length ? Math.min(...prices) : undefined,
    maxPrice: prices.length ? Math.max(...prices) : undefined,
    currency: mostCommon(sortedOffers.map((offer) => offer.currency).filter((currency): currency is string => Boolean(currency))),
    bestOffer,
    offers: sortedOffers
  };
}

function groupKey(product: ProductResult): string {
  const brand = product.normalized?.brand ?? "unknown-brand";
  const modelKey = firstModelFamily(product);

  if (modelKey) {
    return `model:${brand}:${modelKey}`;
  }

  return `title:${brand}:${normalizeTitle(product.title)}`;
}

function firstModelFamily(product: ProductResult): string | undefined {
  const familyKeys = modelFamilyKeys(extractModelCodes(product.title));
  return familyKeys.find((key) => key.includes("-")) ?? familyKeys[0];
}

function createLabel(bestOffer: ProductResult, brand: string | undefined, modelKey: string | undefined): string {
  if (brand && modelKey) {
    return `${capitalize(brand)} ${modelKey.toUpperCase()}`;
  }

  if (modelKey) {
    return modelKey.toUpperCase();
  }

  return bestOffer.title;
}

function compareOffers(a: ProductResult, b: ProductResult): number {
  const relevanceDelta = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
  if (Math.abs(relevanceDelta) > 0.001) {
    return relevanceDelta;
  }

  const aPrice = a.price ?? Number.MAX_SAFE_INTEGER;
  const bPrice = b.price ?? Number.MAX_SAFE_INTEGER;
  if (aPrice !== bPrice) {
    return aPrice - bPrice;
  }

  return b.confidence - a.confidence;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !TITLE_STOP_WORDS.has(token))
    .slice(0, 12)
    .join("-");
}

function dedupeOffers(offers: ProductResult[]): ProductResult[] {
  const byKey = new Map<string, ProductResult>();

  for (const offer of offers) {
    const key = offerKey(offer);
    const existing = byKey.get(key);

    if (!existing || compareOffers(offer, existing) < 0) {
      byKey.set(key, offer);
    }
  }

  return [...byKey.values()];
}

function offerKey(offer: ProductResult): string {
  return productIdentityKey(offer);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function isDefined(value: string | undefined): value is string {
  return Boolean(value);
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const TITLE_STOP_WORDS = new Set([
  "buy",
  "new",
  "used",
  "sale",
  "uah",
  "грн",
  "купити",
  "ціна",
  "новий",
  "нова",
  "нове",
  "бу",
  "вудилище",
  "спінінг",
  "спиннинг",
  "удилище"
]);
