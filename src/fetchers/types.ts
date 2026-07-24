import type { FetchedPage } from "../types.js";

export interface PageFetcher {
  readonly name: string;
  isConfigured(): boolean;
  fetch(url: string): Promise<FetchedPage>;
}
