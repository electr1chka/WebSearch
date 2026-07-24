import type { ProductResult, SearchOptions } from "../types.js";

interface QueryProfile {
  raw: string;
  tokens: string[];
  modelTokens: string[];
  brand?: string;
}

const BRAND_ALIASES: Record<string, string[]> = {
  shimano: ["shimano", "шимано"],
  daiwa: ["daiwa", "дайва"],
  megabass: ["megabass", "мегабас"],
  evergreen: ["evergreen", "евергрін"],
  favorite: ["favorite", "фаворит"],
  flagman: ["flagman", "флагман"]
};

export function scoreAndFilterProducts(
  query: string,
  products: ProductResult[],
  options: SearchOptions = {}
): ProductResult[] {
  const profile = createQueryProfile(query);

  return products
    .map((product) => enrichProduct(profile, product))
    .filter((product) => passesFilters(product, options))
    .sort((a, b) => {
      const relevanceDelta = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
      if (Math.abs(relevanceDelta) > 0.001) {
        return relevanceDelta;
      }

      return b.confidence - a.confidence;
    })
    .slice(0, options.productLimit);
}

function enrichProduct(profile: QueryProfile, product: ProductResult): ProductResult {
  const titleTokens = tokenize(product.title);
  const modelTokens = extractModelTokens(product.title);
  const brand = detectBrand(product.title);
  const tokenMatches = profile.tokens.filter((token) => titleTokens.includes(token));
  const modelMatches = profile.modelTokens.filter((token) => titleTokens.includes(token) || modelTokens.includes(token));
  let score = 0;
  const warnings: string[] = [...(product.warnings ?? [])];

  if (profile.brand && brand === profile.brand) {
    score += 30;
  } else if (profile.brand && brand && brand !== profile.brand) {
    score -= 18;
    warnings.push(`brand mismatch: expected ${profile.brand}, found ${brand}`);
  }

  score += safeRatio(tokenMatches.length, profile.tokens.length) * 35;
  score += safeRatio(modelMatches.length, Math.max(1, profile.modelTokens.length)) * 25;

  if (phraseIncluded(product.title, profile.raw)) {
    score += 12;
  }

  if (product.price) {
    score += 4;
  }

  if (product.condition === "used") {
    score += 2;
  }

  const relevanceScore = clamp(score / 100, 0, 1);

  return {
    ...product,
    relevanceScore,
    matchGrade: gradeScore(relevanceScore),
    matchReason: createReason(profile, tokenMatches, modelMatches, brand),
    warnings,
    normalized: {
      brand,
      modelTokens,
      titleTokens
    }
  };
}

function passesFilters(product: ProductResult, options: SearchOptions): boolean {
  if (options.minPrice !== undefined && (!product.price || product.price < options.minPrice)) {
    return false;
  }

  if (options.maxPrice !== undefined && (!product.price || product.price > options.maxPrice)) {
    return false;
  }

  if (options.condition && product.condition !== options.condition) {
    return false;
  }

  if (options.sources?.length) {
    const source = product.sourceSite?.replace(/^www\./, "").toLowerCase();
    const allowed = options.sources.map((item) => item.replace(/^www\./, "").toLowerCase());

    if (!source || !allowed.some((item) => source.includes(item))) {
      return false;
    }
  }

  return true;
}

function createQueryProfile(query: string): QueryProfile {
  return {
    raw: query,
    tokens: tokenize(query),
    modelTokens: extractModelTokens(query),
    brand: detectBrand(query)
  };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function extractModelTokens(value: string): string[] {
  return tokenize(value).filter((token) => /[a-zа-яіїєґ]*\d+[a-zа-яіїєґ0-9-]*/iu.test(token));
}

function detectBrand(value: string): string | undefined {
  const tokens = tokenize(value);

  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    if (aliases.some((alias) => tokens.includes(alias))) {
      return brand;
    }
  }

  return undefined;
}

function phraseIncluded(title: string, query: string): boolean {
  const normalizedTitle = title.toLowerCase();
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ").trim();
  return normalizedQuery.length > 4 && normalizedTitle.includes(normalizedQuery);
}

function safeRatio(value: number, total: number): number {
  return total <= 0 ? 0 : value / total;
}

function gradeScore(score: number): ProductResult["matchGrade"] {
  if (score >= 0.82) {
    return "exact";
  }

  if (score >= 0.58) {
    return "close";
  }

  if (score >= 0.34) {
    return "broad";
  }

  return "weak";
}

function createReason(profile: QueryProfile, tokenMatches: string[], modelMatches: string[], brand?: string): string {
  const parts = [
    brand && profile.brand === brand ? `brand ${brand}` : undefined,
    modelMatches.length ? `model tokens: ${modelMatches.join(", ")}` : undefined,
    tokenMatches.length ? `matched: ${tokenMatches.slice(0, 6).join(", ")}` : undefined
  ].filter(Boolean);

  return parts.join("; ") || "low textual match";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
