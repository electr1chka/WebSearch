import * as cheerio from "cheerio";

export function extractJsonLd(html?: string): unknown[] {
  if (!html) {
    return [];
  }

  const $ = cheerio.load(html);
  const values: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      values.push(parsed);
    } catch {
      const repaired = raw.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      try {
        values.push(JSON.parse(repaired));
      } catch {
        // Ignore invalid embedded data.
      }
    }
  });

  return flattenJsonLd(values);
}

function flattenJsonLd(values: unknown[]): unknown[] {
  const output: unknown[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      output.push(...flattenJsonLd(value));
      continue;
    }

    if (isRecord(value) && Array.isArray(value["@graph"])) {
      output.push(...flattenJsonLd(value["@graph"]));
    }

    output.push(value);
  }

  return output;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
