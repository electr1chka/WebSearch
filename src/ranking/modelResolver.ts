export interface ModelCode {
  raw: string;
  normalized: string;
  prefix?: string;
  number: string;
  variant: string;
  suffix?: string;
}

export type ModelCompatibility = "exact" | "compatible" | "conflict" | "unknown";

const MODEL_CODE_PATTERN =
  /(?<![a-z0-9.])(?:([a-z]{1,8})[-\s]*)?(\d{2,3}(?:\.\d)?)([a-z]{1,4})(?:[-\s]*([a-z0-9]{2,8}(?:[-\s]+[a-z0-9]{2,8}){0,2}))?(?![a-z0-9])/giu;

export function extractModelCodes(value: string): ModelCode[] {
  const normalizedText = normalizeSeparators(value);
  const codes = new Map<string, ModelCode>();

  for (const match of normalizedText.matchAll(MODEL_CODE_PATTERN)) {
    const prefix = normalizePart(match[1]);
    const number = normalizePart(match[2]);
    const variant = normalizePart(match[3]);
    const suffix = normalizeSuffix(match[4]);

    if (!number || !variant || !looksLikeProductModel(prefix, variant, suffix)) {
      continue;
    }

    const normalized = [prefix, `${number}${variant}`, suffix].filter(Boolean).join("-");
    codes.set(normalized, {
      raw: match[0].trim(),
      normalized,
      prefix,
      number,
      variant,
      suffix
    });

    if (prefix) {
      const withoutPrefix = [`${number}${variant}`, suffix].filter(Boolean).join("-");
      codes.set(withoutPrefix, {
        raw: match[0].trim(),
        normalized: withoutPrefix,
        number,
        variant,
        suffix
      });
    }
  }

  return [...codes.values()];
}

export function getModelCompatibility(queryCodes: ModelCode[], productCodes: ModelCode[]): ModelCompatibility {
  if (queryCodes.length === 0) {
    return "unknown";
  }

  if (productCodes.length === 0) {
    return "unknown";
  }

  if (queryCodes.some((queryCode) => productCodes.some((productCode) => isExactModelMatch(queryCode, productCode)))) {
    return "exact";
  }

  if (queryCodes.some((queryCode) => productCodes.some((productCode) => isCompatibleModelMatch(queryCode, productCode)))) {
    return "compatible";
  }

  if (queryCodes.some((queryCode) => productCodes.some((productCode) => isModelConflict(queryCode, productCode)))) {
    return "conflict";
  }

  return "unknown";
}

export function modelCodeTokens(codes: ModelCode[]): string[] {
  return [...new Set(codes.flatMap((code) => [
    code.normalized,
    code.prefix ? `${code.prefix}-${code.number}${code.variant}` : undefined,
    `${code.number}${code.variant}`
  ]).filter((token): token is string => Boolean(token)))];
}

function isExactModelMatch(queryCode: ModelCode, productCode: ModelCode): boolean {
  return queryCode.normalized === productCode.normalized || productCode.normalized.startsWith(`${queryCode.normalized}-`);
}

function isCompatibleModelMatch(queryCode: ModelCode, productCode: ModelCode): boolean {
  if (queryCode.number !== productCode.number || queryCode.variant !== productCode.variant) {
    return false;
  }

  if (queryCode.prefix && productCode.prefix && queryCode.prefix !== productCode.prefix) {
    return false;
  }

  return true;
}

function isModelConflict(queryCode: ModelCode, productCode: ModelCode): boolean {
  if (queryCode.prefix && productCode.prefix && queryCode.prefix !== productCode.prefix) {
    return false;
  }

  if (queryCode.number !== productCode.number) {
    return true;
  }

  return queryCode.variant !== productCode.variant;
}

function looksLikeProductModel(prefix: string | undefined, variant: string, suffix: string | undefined): boolean {
  if (prefix) {
    return true;
  }

  if (suffix) {
    return true;
  }

  return variant.length >= 2;
}

function normalizeSeparators(value: string): string {
  return value.toLowerCase().replace(/[‐‑‒–—_]+/gu, "-");
}

function normalizePart(value: string | undefined): string | undefined {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9.]+/gu, "");
  return normalized || undefined;
}

function normalizeSuffix(value: string | undefined): string | undefined {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/g, "");
  return normalized || undefined;
}
