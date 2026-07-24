import type { SearchQueryPlan } from "../types.js";

const UKRAINE_MARKET_TERMS = [
  "Україна",
  "купити",
  "ціна",
  "в наявності",
  "б/в",
  "вудилище",
  "спінінг",
  "котушка",
  "OLX",
  "Rozetka",
  "Prom",
  "Hotline"
];
const JDM_PRODUCT_TERMS =
  /\b(jdm|japan|japanese|shimano|daiwa|megabass|evergreen|tenryu|graphiteleader|yamaga|zenaq|twin\s?power|stella|vanquish|stradic|scorpion|metanium|aldebaran|calcutta|curado|bantam|certate|exist)\b/i;

export function createQueryPlan(original: string): SearchQueryPlan {
  const normalized = original.replace(/\s+/g, " ").trim();
  const quotedModel = quoteLikelyModel(normalized);
  const jdmRelevant = isJdmRelevant(normalized);
  const variants = unique([
    normalized,
    `${normalized} купити Україна`,
    `${normalized} ціна Україна`,
    `${normalized} в наявності`,
    `${normalized} б/в OLX`,
    `${normalized} site:olx.ua OR site:prom.ua OR site:rozetka.com.ua`,
    `${normalized} site:hotline.ua OR site:ek.ua`,
    `${normalized} site:flagman.ua OR site:ibis-gear.com OR site:fish-fish.com.ua`,
    quotedModel ? `${quotedModel} купити Україна` : undefined,
    quotedModel ? `${quotedModel} ціна` : undefined,
    jdmRelevant ? `${normalized} Japan used` : undefined,
    jdmRelevant ? `${normalized} JDM fishing tackle` : undefined
  ]);

  return {
    original: normalized,
    variants,
    languageHints: jdmRelevant ? ["uk", "en", "ja"] : ["uk", "en"],
    productHints: jdmRelevant ? [...UKRAINE_MARKET_TERMS, "Japan", "JDM", "used"] : UKRAINE_MARKET_TERMS
  };
}

function quoteLikelyModel(query: string): string | undefined {
  const tokens = query.split(" ");
  const likelyModelTokens = tokens.filter((token) => /[A-Za-z]*\d+[A-Za-z0-9-]*/.test(token));

  if (likelyModelTokens.length === 0) {
    return undefined;
  }

  return `"${likelyModelTokens.join(" ")}"`;
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(value);
    }
  }

  return output;
}

function isJdmRelevant(query: string): boolean {
  return JDM_PRODUCT_TERMS.test(query);
}
