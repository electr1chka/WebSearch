import "dotenv/config";
import { z } from "zod";
import type { AgentConfig, FetchMode, LlmProvider } from "./types.js";

const EnvSchema = z.object({
  LLM_PROVIDER: z.enum(["none", "openrouter", "openai"]).optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openrouter/free"),
  OPENROUTER_SITE_URL: z.string().optional(),
  OPENROUTER_APP_TITLE: z.string().default("AI Web Search Agent"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  BRAVE_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  DEFAULT_COUNTRY: z.string().default("UA"),
  DEFAULT_LANGUAGE: z.string().default("uk"),
  MAX_RESULTS: z.coerce.number().int().positive().default(12),
  MAX_PAGES_TO_FETCH: z.coerce.number().int().positive().default(8),
  FETCH_MODE: z.enum(["auto", "http", "browser", "firecrawl"]).default("auto"),
  STORAGE_PATH: z.string().default("results/search-history.jsonl"),
  SAVED_SEARCHES_PATH: z.string().default("results/saved-searches.json"),
  AI_ANALYSIS_ENABLED: z.coerce.boolean().default(false)
});

export function loadConfig(): AgentConfig {
  const env = EnvSchema.parse(process.env);
  const openRouterApiKey = emptyToUndefined(env.OPENROUTER_API_KEY);
  const openaiApiKey = emptyToUndefined(env.OPENAI_API_KEY);
  const llmProvider = resolveLlmProvider(env.LLM_PROVIDER, openRouterApiKey, openaiApiKey);

  return {
    llmProvider,
    openRouterApiKey,
    openRouterModel: env.OPENROUTER_MODEL,
    openRouterSiteUrl: emptyToUndefined(env.OPENROUTER_SITE_URL),
    openRouterAppTitle: env.OPENROUTER_APP_TITLE,
    openaiApiKey,
    openaiModel: env.OPENAI_MODEL,
    braveApiKey: emptyToUndefined(env.BRAVE_API_KEY),
    tavilyApiKey: emptyToUndefined(env.TAVILY_API_KEY),
    exaApiKey: emptyToUndefined(env.EXA_API_KEY),
    serpApiKey: emptyToUndefined(env.SERPAPI_API_KEY),
    firecrawlApiKey: emptyToUndefined(env.FIRECRAWL_API_KEY),
    defaultCountry: env.DEFAULT_COUNTRY,
    defaultLanguage: env.DEFAULT_LANGUAGE,
    maxResults: env.MAX_RESULTS,
    maxPagesToFetch: env.MAX_PAGES_TO_FETCH,
    fetchMode: env.FETCH_MODE as FetchMode,
    storagePath: env.STORAGE_PATH,
    savedSearchesPath: env.SAVED_SEARCHES_PATH,
    aiAnalysisEnabled: env.AI_ANALYSIS_ENABLED
  };
}

function resolveLlmProvider(
  configured: LlmProvider | undefined,
  openRouterApiKey?: string,
  openaiApiKey?: string
): LlmProvider {
  if (configured) {
    return configured;
  }

  if (openRouterApiKey) {
    return "openrouter";
  }

  if (openaiApiKey) {
    return "openai";
  }

  return "none";
}

function emptyToUndefined(value?: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}
