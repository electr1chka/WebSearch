import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SearchRunResult } from "../types.js";

export interface StoredSearchRun {
  timestamp: string;
  query: string;
  result: SearchRunResult;
}

export async function saveSearchRun(path: string, query: string, result: SearchRunResult): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const record: StoredSearchRun = {
    timestamp: new Date().toISOString(),
    query,
    result
  };

  await writeFile(path, `${JSON.stringify(record)}\n`, {
    flag: "a"
  });
}

export async function readSearchHistory(path: string, limit = 30): Promise<StoredSearchRun[]> {
  try {
    const content = await readFile(path, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredSearchRun)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
