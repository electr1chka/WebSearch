import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchMode } from "../types.js";

export interface SearchSettings {
  maxResults: number;
  maxPages: number;
  limit: number;
  fetchMode: FetchMode;
  browserHumanInLoop: boolean;
  ai: boolean;
  save: boolean;
  sources: string;
  condition: "" | "new" | "used";
  minPrice: number | null;
  maxPrice: number | null;
}

export const searchSettingsPath = path.resolve(process.cwd(), "settings/search-settings.json");

export const defaultSearchSettings: SearchSettings = {
  maxResults: 220,
  maxPages: 60,
  limit: 120,
  fetchMode: "auto",
  browserHumanInLoop: false,
  ai: false,
  save: true,
  sources: "",
  condition: "",
  minPrice: null,
  maxPrice: null
};

export async function readSearchSettings(): Promise<SearchSettings> {
  try {
    const raw = await readFile(searchSettingsPath, "utf8");
    return normalizeSearchSettings(JSON.parse(raw));
  } catch (error) {
    if (isNotFound(error)) {
      await writeSearchSettings(defaultSearchSettings);
      return defaultSearchSettings;
    }

    throw error;
  }
}

export async function writeSearchSettings(value: unknown): Promise<SearchSettings> {
  const settings = normalizeSearchSettings(value);
  await mkdir(path.dirname(searchSettingsPath), { recursive: true });
  await writeFile(searchSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

function normalizeSearchSettings(value: unknown): SearchSettings {
  const input = isRecord(value) ? value : {};

  return {
    maxResults: positiveInteger(input.maxResults, defaultSearchSettings.maxResults),
    maxPages: positiveInteger(input.maxPages, defaultSearchSettings.maxPages),
    limit: positiveInteger(input.limit, defaultSearchSettings.limit),
    fetchMode: fetchMode(input.fetchMode, defaultSearchSettings.fetchMode),
    browserHumanInLoop: booleanValue(input.browserHumanInLoop, defaultSearchSettings.browserHumanInLoop),
    ai: booleanValue(input.ai, defaultSearchSettings.ai),
    save: booleanValue(input.save, defaultSearchSettings.save),
    sources: stringValue(input.sources),
    condition: conditionValue(input.condition),
    minPrice: optionalPositiveNumber(input.minPrice),
    maxPrice: optionalPositiveNumber(input.maxPrice)
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function fetchMode(value: unknown, fallback: FetchMode): FetchMode {
  return value === "auto" || value === "http" || value === "browser" || value === "firecrawl" ? value : fallback;
}

function conditionValue(value: unknown): SearchSettings["condition"] {
  return value === "new" || value === "used" ? value : "";
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
