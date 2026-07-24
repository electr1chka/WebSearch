import type { AgentConfig } from "../../types.js";
import type { SearchProvider } from "./types.js";
import { BingHtmlProvider } from "./bingHtml.js";
import { BraveSearchProvider } from "./brave.js";
import { DuckDuckGoHtmlProvider } from "./duckduckgoHtml.js";
import { ExaSearchProvider } from "./exa.js";
import { FlagmanSearchProvider } from "./flagman.js";
import { IbisSearchProvider } from "./ibis.js";
import { SerpApiProvider } from "./serpapi.js";
import { ShimanoKievSearchProvider } from "./shimanoKiev.js";
import { TavilySearchProvider } from "./tavily.js";
import { UkrainianMarketSearchProvider } from "./ukrainianMarketSearch.js";

export function createSearchProviders(config: AgentConfig): SearchProvider[] {
  const apiProviders: SearchProvider[] = [
    new ExaSearchProvider(config.exaApiKey),
    new BraveSearchProvider(config.braveApiKey),
    new TavilySearchProvider(config.tavilyApiKey),
    new SerpApiProvider(config.serpApiKey)
  ];
  const directProviders = [
    new UkrainianMarketSearchProvider(),
    new FlagmanSearchProvider(),
    new IbisSearchProvider(),
    new ShimanoKievSearchProvider()
  ];
  const configuredApiProviders = apiProviders.filter((provider) => provider.isConfigured());

  if (configuredApiProviders.length > 0) {
    return [...configuredApiProviders, ...directProviders];
  }

  return [new DuckDuckGoHtmlProvider(), new BingHtmlProvider(), ...directProviders];
}
