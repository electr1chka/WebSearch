import type { SearchCandidate } from "../../types.js";

export interface SearchProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string, limit: number): Promise<SearchCandidate[]>;
}
