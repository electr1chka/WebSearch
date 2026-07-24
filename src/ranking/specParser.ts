import type { ProductSpecs } from "../types.js";

export function parseProductSpecs(value: string): ProductSpecs | undefined {
  const normalized = value.replace(",", ".").replace(/\s+/g, " ");
  const specs: ProductSpecs = {};
  const length = parseRodLength(normalized);
  const lure = parseLureTest(normalized);
  const line = parseLineTest(normalized);
  const weight = parseWeight(normalized);
  const bearings = normalized.match(/\b\d+\s*\+\s*\d+\s*(?:bb|підшип|подшип)/i)?.[0];
  const gearRatio = normalized.match(/\b\d+(?:\.\d+)?\s*:\s*1\b/)?.[0]?.replace(/\s+/g, "");
  const reelSize = normalized.match(/\b(?:c)?(?:1000|1500|2000|2500|3000|4000|5000|6000|8000|10000|12000|14000)(?:s|hg|xg|pg|fc|fd|fi|fj)?\b/i)?.[0];

  if (length) {
    specs.rodLengthM = length;
  }

  if (lure) {
    specs.lureMinG = lure.min;
    specs.lureMaxG = lure.max;
  }

  if (line) {
    specs.lineMinLb = line.min;
    specs.lineMaxLb = line.max;
  }

  if (weight) {
    specs.weightG = weight;
  }

  if (bearings) {
    specs.bearings = bearings.replace(/\s+/g, "");
  }

  if (gearRatio) {
    specs.gearRatio = gearRatio;
  }

  if (reelSize) {
    specs.reelSize = reelSize.toUpperCase();
  }

  if (/\b(?:left|lh|left hand)\b|ліва|лев/i.test(normalized)) {
    specs.handedness = "left";
  } else if (/\b(?:right|rh|right hand)\b|права|прав/i.test(normalized)) {
    specs.handedness = "right";
  }

  const power = normalized.match(/\b(?:UL|SUL|XUL|L|ML|M|MH|H|XH|XXH|LL)\b/i)?.[0];

  if (power) {
    specs.power = power.toUpperCase();
  }

  return Object.keys(specs).length ? specs : undefined;
}

export function formatProductSpecs(specs?: ProductSpecs): string | undefined {
  if (!specs) {
    return undefined;
  }

  const parts = [
    specs.rodLengthM ? `${trimNumber(specs.rodLengthM)}m` : undefined,
    specs.lureMaxG !== undefined
      ? `${specs.lureMinG !== undefined ? `${trimNumber(specs.lureMinG)}-` : ""}${trimNumber(specs.lureMaxG)}g`
      : undefined,
    specs.lineMaxLb !== undefined
      ? `${specs.lineMinLb !== undefined ? `${trimNumber(specs.lineMinLb)}-` : ""}${trimNumber(specs.lineMaxLb)}lb`
      : undefined,
    specs.power,
    specs.weightG ? `${trimNumber(specs.weightG)}g weight` : undefined,
    specs.reelSize ? `size ${specs.reelSize}` : undefined,
    specs.gearRatio,
    specs.bearings,
    specs.handedness
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : undefined;
}

export function specsCompatibilityScore(querySpecs?: ProductSpecs, productSpecs?: ProductSpecs): number {
  if (!querySpecs || !productSpecs) {
    return 0;
  }

  let score = 0;

  if (querySpecs.rodLengthM && productSpecs.rodLengthM) {
    score += Math.abs(querySpecs.rodLengthM - productSpecs.rodLengthM) <= 0.08 ? 8 : -8;
  }

  if (querySpecs.lureMaxG !== undefined && productSpecs.lureMaxG !== undefined) {
    const queryMin = querySpecs.lureMinG ?? 0;
    const productMin = productSpecs.lureMinG ?? 0;
    const overlaps = queryMin <= productSpecs.lureMaxG && productMin <= querySpecs.lureMaxG;
    score += overlaps ? 10 : -14;
  }

  if (querySpecs.reelSize && productSpecs.reelSize) {
    score += querySpecs.reelSize === productSpecs.reelSize ? 8 : -8;
  }

  if (querySpecs.handedness && productSpecs.handedness) {
    score += querySpecs.handedness === productSpecs.handedness ? 6 : -10;
  }

  if (querySpecs.power && productSpecs.power) {
    score += querySpecs.power === productSpecs.power ? 6 : -6;
  }

  return score;
}

function parseRodLength(value: string): number | undefined {
  const metric = value.match(/\b(?<length>\d(?:\.\d{1,2})?)\s?(?:m|м|метр)/i);

  if (metric?.groups?.length) {
    const parsed = Number(metric.groups.length);
    return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 6 ? parsed : undefined;
  }

  const imperial = value.match(/\b(?<feet>[4-9])\s?(?:'|ft|фут)\s?(?<inches>\d{1,2})?(?:"|in|дюйм)?/i);

  if (imperial?.groups?.feet) {
    const feet = Number(imperial.groups.feet);
    const inches = Number(imperial.groups.inches ?? 0);
    const meters = (feet * 12 + inches) * 0.0254;
    return Number.isFinite(meters) ? Number(meters.toFixed(2)) : undefined;
  }

  return undefined;
}

function parseLureTest(value: string): { min?: number; max: number } | undefined {
  const range = value.match(/\b(?<min>\d+(?:\.\d+)?)\s?[-–]\s?(?<max>\d+(?:\.\d+)?)\s?(?:g|gr|гр|г)\b/i);

  if (range?.groups?.max) {
    return {
      min: Number(range.groups.min),
      max: Number(range.groups.max)
    };
  }

  const max = value.match(/\b(?:max|до|тест)\s?(?<max>\d+(?:\.\d+)?)\s?(?:g|gr|гр|г)\b/i);

  if (max?.groups?.max) {
    return {
      max: Number(max.groups.max)
    };
  }

  return undefined;
}

function parseLineTest(value: string): { min?: number; max: number } | undefined {
  const range = value.match(/\b(?<min>\d+(?:\.\d+)?)\s?[-–]\s?(?<max>\d+(?:\.\d+)?)\s?(?:lb|lbs|лб)\b/i);

  if (!range?.groups?.max) {
    return undefined;
  }

  return {
    min: Number(range.groups.min),
    max: Number(range.groups.max)
  };
}

function parseWeight(value: string): number | undefined {
  const match = value.match(/\b(?:weight|вага|вес)\s?:?\s?(?<weight>\d+(?:\.\d+)?)\s?(?:g|гр|г)\b/i);
  const parsed = match?.groups?.weight ? Number(match.groups.weight) : undefined;
  return parsed && Number.isFinite(parsed) ? parsed : undefined;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
