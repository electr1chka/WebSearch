import type { ProductGroup, ProductResult } from "../types.js";
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
  const sortedOffers = [...offers].sort(compareOffers);
  const bestOffer = sortedOffers[0];
  const prices = sortedOffers.map((offer) => offer.price).filter((price): price is number => Number.isFinite(price));
  const sources = [...new Set(sortedOffers.map((offer) => offer.sourceSite).filter((source): source is string => Boolean(source)))];
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

  const source = product.sourceSite?.replace(/^www\./, "").toLowerCase() ?? "unknown-source";
  return `title:${source}:${normalizeTitle(product.title)}`;
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
    .filter((token) => token.length > 2)
    .slice(0, 10)
    .join("-");
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
