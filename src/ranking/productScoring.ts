import type { ProductResult, SearchOptions } from "../types.js";
import {
  extractModelCodes,
  getModelCompatibility,
  modelCodeTokens,
  type ModelCode
} from "./modelResolver.js";
import {
  parseProductSpecs,
  specsCompatibilityScore
} from "./specParser.js";

interface QueryProfile {
  raw: string;
  tokens: string[];
  modelTokens: string[];
  modelCodes: ModelCode[];
  brand?: string;
  specs?: ReturnType<typeof parseProductSpecs>;
}

const BRAND_ALIASES: Record<string, string[]> = {
  shimano: ["shimano", "шимано"],
  daiwa: ["daiwa", "дайва"],
  megabass: ["megabass", "мегабас"],
  evergreen: ["evergreen", "евергрін"],
  favorite: ["favorite", "фаворит"],
  flagman: ["flagman", "флагман"],
  tict: ["tict", "тікт"]
};

export function scoreAndFilterProducts(
  query: string,
  products: ProductResult[],
  options: SearchOptions = {}
): ProductResult[] {
  const profile = createQueryProfile(query);

  return products
    .map((product) => enrichProduct(profile, product))
    .filter((product) => passesFilters(profile, product, options))
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
  const productModelCodes = extractModelCodes(product.title);
  const modelTokens = extractModelTokens(product.title, productModelCodes);
  const brand = detectBrand(product.title);
  const specs = parseProductSpecs([
    product.title,
    product.evidence.join(" "),
    product.ai?.summary ?? ""
  ].join(" "));
  const tokenMatches = profile.tokens.filter((token) => titleTokens.includes(token));
  const modelMatches = profile.modelTokens.filter((token) => titleTokens.includes(token) || modelTokens.includes(token));
  const modelMatch = getModelCompatibility(profile.modelCodes, productModelCodes);
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

  if (modelMatch === "exact") {
    score += 24;
  } else if (modelMatch === "compatible") {
    score += 18;
  } else if (modelMatch === "conflict") {
    score -= 55;
    warnings.push(`model mismatch: requested ${formatModelCodes(profile.modelCodes)}, found ${formatModelCodes(productModelCodes)}`);
  }

  if (phraseIncluded(product.title, profile.raw)) {
    score += 12;
  }

  if (product.price) {
    score += 4;
  }

  score += specsCompatibilityScore(profile.specs, specs);

  if (product.condition === "used") {
    score += 2;
  }

  const relevanceScore = clamp(score / 100, 0, 1);

  return {
    ...product,
    relevanceScore,
    matchGrade: gradeScore(relevanceScore),
    matchReason: createReason(profile, tokenMatches, modelMatches, brand, specs),
    warnings,
    specs,
    normalized: {
      brand,
      modelCodes: productModelCodes.map((code) => code.normalized),
      modelMatch,
      modelTokens,
      titleTokens
    }
  };
}

function passesFilters(profile: QueryProfile, product: ProductResult, options: SearchOptions): boolean {
  if (product.normalized?.modelMatch === "conflict") {
    return false;
  }

  if (
    profile.modelCodes.length > 0 &&
    product.normalized?.modelMatch === "unknown" &&
    !hasNonYearTokenCoverage(profile, product) &&
    (product.relevanceScore ?? 0) < 0.75
  ) {
    return false;
  }

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
    const allowed = options.sources.flatMap((item) => normalizeSourceFilter(item));

    if (!source || !allowed.some((item) => source.includes(item))) {
      return false;
    }
  }

  return true;
}

function normalizeSourceFilter(source: string): string[] {
  const normalized = source.replace(/^www\./, "").toLowerCase();
  const aliases: Record<string, string[]> = {
    "daiwa-ua": ["daiwa.in.ua"],
    ibis: ["ibis-gear.com"],
    "shimano-kiev": ["shimano.kiev.ua"],
    ek: ["ek.ua"],
    aquatory: ["aquatory.com.ua"],
    fanatik: ["fanatik.com.ua"],
    "jdm-com-ua": ["jdm.com.ua"],
    zenmarket: ["zenmarket.jp"],
    digitaka: ["digitaka.com"],
    japantackle: ["japantackle.com"],
    jdmtackleheaven: ["jdmtackleheaven.com"],
    ebay: ["ebay.com"]
  };

  return [normalized, ...(aliases[normalized] ?? [])];
}

function createQueryProfile(query: string): QueryProfile {
  const modelCodes = extractModelCodes(query);

  return {
    raw: query,
    tokens: tokenize(query),
    modelCodes,
    modelTokens: extractModelTokens(query, modelCodes),
    brand: detectBrand(query),
    specs: parseProductSpecs(query)
  };
}

function tokenize(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function hasNonYearTokenCoverage(profile: QueryProfile, product: ProductResult): boolean {
  const productTokens = new Set([
    ...(product.normalized?.titleTokens ?? []),
    ...(product.normalized?.modelTokens ?? [])
  ]);
  const requiredTokens = profile.tokens.filter((token) => !/^\d{2}$/.test(token));

  return requiredTokens.length >= 2 && requiredTokens.every((token) => productTokens.has(token));
}

function extractModelTokens(value: string, modelCodes = extractModelCodes(value)): string[] {
  return [...new Set([
    ...tokenize(value).filter((token) => /[a-zа-яіїєґ]*\d+[a-zа-яіїєґ0-9-]*/iu.test(token)),
    ...modelCodeTokens(modelCodes)
  ])];
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

function createReason(
  profile: QueryProfile,
  tokenMatches: string[],
  modelMatches: string[],
  brand?: string,
  specs?: ReturnType<typeof parseProductSpecs>
): string {
  const parts = [
    brand && profile.brand === brand ? `brand ${brand}` : undefined,
    modelMatches.length ? `model tokens: ${modelMatches.join(", ")}` : undefined,
    profile.specs && specs ? "specs compatible" : undefined,
    tokenMatches.length ? `matched: ${tokenMatches.slice(0, 6).join(", ")}` : undefined
  ].filter(Boolean);

  return parts.join("; ") || "low textual match";
}

function formatModelCodes(codes: ModelCode[]): string {
  return codes.map((code) => code.normalized).join(", ") || "unknown";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
