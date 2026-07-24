export type FetchMode = "auto" | "http" | "browser" | "firecrawl";
export type LlmProvider = "none" | "openrouter" | "openai";

export interface AgentConfig {
  llmProvider: LlmProvider;
  openRouterApiKey?: string;
  openRouterModel: string;
  openRouterSiteUrl?: string;
  openRouterAppTitle: string;
  openaiApiKey?: string;
  openaiModel: string;
  braveApiKey?: string;
  tavilyApiKey?: string;
  exaApiKey?: string;
  serpApiKey?: string;
  firecrawlApiKey?: string;
  defaultCountry: string;
  defaultLanguage: string;
  maxResults: number;
  maxPagesToFetch: number;
  fetchMode: FetchMode;
  storagePath: string;
  aiAnalysisEnabled: boolean;
}

export interface SearchQueryPlan {
  original: string;
  variants: string[];
  languageHints: string[];
  productHints: string[];
}

export interface SearchCandidate {
  title: string;
  url: string;
  snippet?: string;
  sourceProvider: string;
  rank: number;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  title?: string;
  html?: string;
  markdown?: string;
  text?: string;
  status?: number;
  fetcher: string;
}

export interface ProductResult {
  title: string;
  url: string;
  price?: number;
  currency?: string;
  availability?: string;
  condition?: string;
  seller?: string;
  imageUrl?: string;
  sourceSite?: string;
  evidence: string[];
  confidence: number;
  relevanceScore?: number;
  matchGrade?: "exact" | "close" | "broad" | "weak";
  matchReason?: string;
  warnings?: string[];
  normalized?: {
    brand?: string;
    modelTokens: string[];
    modelCodes?: string[];
    modelMatch?: "exact" | "compatible" | "conflict" | "unknown";
    titleTokens: string[];
  };
  ai?: {
    summary?: string;
    fit?: "exact" | "close" | "partial" | "not_relevant" | "unknown";
    riskFlags: string[];
  };
}

export interface SearchRunResult {
  queryPlan: SearchQueryPlan;
  candidates: SearchCandidate[];
  products: ProductResult[];
}

export interface SearchOptions {
  maxPrice?: number;
  minPrice?: number;
  condition?: "new" | "used";
  sources?: string[];
  productLimit?: number;
  ai?: boolean;
  save?: boolean;
}
