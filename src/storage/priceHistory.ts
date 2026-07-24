import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PriceHistoryRecord, ProductGroup, SavedSearch, SavedSearchAlert } from "../types.js";

export async function appendPriceHistoryRecord(path: string, record: PriceHistoryRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record)}\n`, { flag: "a" });
}

export async function readPriceHistory(
  path: string,
  options: {
    savedSearchId?: string;
    limit?: number;
  } = {}
): Promise<PriceHistoryRecord[]> {
  try {
    const content = await readFile(path, "utf8");
    const records = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PriceHistoryRecord)
      .filter((record) => !options.savedSearchId || record.savedSearchId === options.savedSearchId);

    return records.slice(-(options.limit ?? 30)).reverse();
  } catch {
    return [];
  }
}

export function createPriceHistoryRecord(
  search: SavedSearch,
  groups: ProductGroup[],
  alerts: SavedSearchAlert[]
): PriceHistoryRecord {
  return {
    timestamp: new Date().toISOString(),
    savedSearchId: search.id,
    savedSearchName: search.name,
    query: search.query,
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      minPrice: group.minPrice,
      maxPrice: group.maxPrice,
      currency: group.currency,
      offerCount: group.offerCount,
      sources: group.sources,
      sellers: group.sellers,
      sellerCount: group.sellerCount,
      bestOfferUrl: group.bestOffer.url
    })),
    alerts
  };
}
