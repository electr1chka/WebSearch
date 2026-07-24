import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  SavedSearch,
  SavedSearchAlert,
  SavedSearchRuntimeOptions,
  SavedSearchSnapshot,
  SearchRunResult
} from "../types.js";

export async function readSavedSearches(path: string): Promise<SavedSearch[]> {
  try {
    const content = await readFile(path, "utf8");
    const parsed = JSON.parse(content) as SavedSearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeSavedSearches(path: string, searches: SavedSearch[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(searches, null, 2)}\n`);
}

export async function addSavedSearch(
  path: string,
  input: {
    name?: string;
    query: string;
    options: SavedSearchRuntimeOptions;
  }
): Promise<SavedSearch> {
  const searches = await readSavedSearches(path);
  const timestamp = new Date().toISOString();
  const search: SavedSearch = {
    id: randomUUID().slice(0, 8),
    name: input.name?.trim() || input.query,
    query: input.query,
    options: input.options,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  searches.push(search);
  await writeSavedSearches(path, searches);
  return search;
}

export async function updateSavedSearch(path: string, updatedSearch: SavedSearch): Promise<void> {
  const searches = await readSavedSearches(path);
  const nextSearches = searches.map((search) => search.id === updatedSearch.id ? updatedSearch : search);
  await writeSavedSearches(path, nextSearches);
}

export function findSavedSearch(searches: SavedSearch[], idOrName: string): SavedSearch | undefined {
  const normalized = idOrName.toLowerCase();
  return searches.find((search) => search.id === idOrName || search.name.toLowerCase() === normalized);
}

export function createSnapshot(result: SearchRunResult): SavedSearchSnapshot {
  return {
    timestamp: new Date().toISOString(),
    groups: result.groups.map((group) => ({
      key: group.key,
      label: group.label,
      minPrice: group.minPrice,
      offerUrls: group.offers.map((offer) => offer.url)
    }))
  };
}

export function compareSavedSearchRun(search: SavedSearch, result: SearchRunResult): SavedSearchAlert[] {
  if (!search.lastRun) {
    return result.groups.map((group) => ({
      type: "new_group",
      message: `Initial match: ${group.label}`,
      groupKey: group.key,
      currentPrice: group.minPrice
    }));
  }

  const alerts: SavedSearchAlert[] = [];
  const previousGroups = new Map(search.lastRun.groups.map((group) => [group.key, group]));

  for (const group of result.groups) {
    const previousGroup = previousGroups.get(group.key);

    if (!previousGroup) {
      alerts.push({
        type: "new_group",
        message: `New group: ${group.label}`,
        groupKey: group.key,
        currentPrice: group.minPrice
      });
      continue;
    }

    if (
      previousGroup.minPrice !== undefined &&
      group.minPrice !== undefined &&
      group.minPrice < previousGroup.minPrice
    ) {
      alerts.push({
        type: "price_drop",
        message: `Price dropped for ${group.label}: ${previousGroup.minPrice} -> ${group.minPrice}`,
        groupKey: group.key,
        previousPrice: previousGroup.minPrice,
        currentPrice: group.minPrice
      });
    }

    const previousUrls = new Set(previousGroup.offerUrls);

    for (const offer of group.offers) {
      if (!previousUrls.has(offer.url)) {
        alerts.push({
          type: "new_offer",
          message: `New offer for ${group.label}: ${offer.title}`,
          groupKey: group.key,
          url: offer.url,
          currentPrice: offer.price
        });
      }
    }
  }

  return alerts;
}
