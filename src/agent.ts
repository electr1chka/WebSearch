import type { AgentConfig, ProductResult, SearchOptions, SearchRunResult } from "./types.js";
import { extractProductList } from "./extraction/listExtractor.js";
import { extractProduct } from "./extraction/productExtractor.js";
import { createFetchers, fetchWithFallback } from "./fetchers/index.js";
import { createSearchProviders } from "./providers/search/index.js";
import { analyzeProductsWithAi } from "./analysis/productAnalysis.js";
import { scoreAndFilterProducts } from "./ranking/productScoring.js";
import { discoverCandidates } from "./search/discover.js";
import { createQueryPlan } from "./search/queryPlanner.js";

export async function runSearchAgent(
  query: string,
  config: AgentConfig,
  options: SearchOptions = {}
): Promise<SearchRunResult> {
  const queryPlan = createQueryPlan(query);
  const providers = createSearchProviders(config);
  const discoveryLimit = options.sources?.length ? Math.max(config.maxResults, 100) : config.maxResults;
  const candidates = await discoverCandidates(providers, queryPlan.variants, discoveryLimit);
  const fetchers = createFetchers(config);
  const products: ProductResult[] = [];
  const fetchCandidates = filterCandidatesBySource(candidates, options.sources);

  for (const candidate of fetchCandidates.slice(0, config.maxPagesToFetch)) {
    const page = await fetchWithFallback(fetchers, candidate.url);

    if (!page) {
      continue;
    }

    const listProducts = extractProductList(page);

    if (listProducts.length > 0) {
      products.push(...listProducts);
      continue;
    }

    if (candidate.sourceProvider.startsWith("ukrainian-market-search:")) {
      continue;
    }

    const product = await extractProduct(page, config);

    if (product) {
      products.push(product);
    }
  }

  const rankedProducts = scoreAndFilterProducts(query, dedupeProducts(products), options);
  const analyzedProducts =
    options.ai ?? config.aiAnalysisEnabled
      ? await analyzeProductsWithAi(query, rankedProducts, config).catch(() => rankedProducts)
      : rankedProducts;

  return {
    queryPlan,
    candidates,
    products: analyzedProducts
  };
}

function dedupeProducts(products: ProductResult[]): ProductResult[] {
  const byUrl = new Map<string, ProductResult>();

  for (const product of products) {
    const existing = byUrl.get(product.url);

    if (!existing || product.confidence > existing.confidence) {
      byUrl.set(product.url, product);
    }
  }

  return [...byUrl.values()];
}

function filterCandidatesBySource(candidates: SearchRunResult["candidates"], sources?: string[]): SearchRunResult["candidates"] {
  if (!sources?.length) {
    return candidates;
  }

  const normalizedSources = sources.flatMap(normalizeCandidateSourceFilter);

  return candidates.filter((candidate) => {
    const provider = candidate.sourceProvider.toLowerCase();
    const host = safeHost(candidate.url)?.replace(/^www\./, "").toLowerCase() ?? "";

    return normalizedSources.some((source) => provider.includes(source) || host.includes(source));
  }).sort((a, b) => directCandidateScore(b) - directCandidateScore(a));
}

function normalizeCandidateSourceFilter(source: string): string[] {
  const normalized = source.toLowerCase().replace(/^www\./, "");
  const aliases: Record<string, string[]> = {
    "daiwa-ua": ["daiwa.in.ua"],
    ibis: ["ibis-gear.com"],
    "shimano-kiev": ["shimano.kiev.ua"],
    ek: ["ek.ua"],
    aquatory: ["aquatory.com.ua"],
    fanatik: ["fanatik.com.ua"],
    "jdm-com-ua": ["jdm.com.ua"]
  };

  return [normalized, ...(aliases[normalized] ?? [])];
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function directCandidateScore(candidate: SearchRunResult["candidates"][number]): number {
  let score = 0;
  const path = safePath(candidate.url);

  if (candidate.sourceProvider.startsWith("ukrainian-market-search:")) {
    score += 100;
  }

  if (candidate.sourceProvider.endsWith("-api")) {
    score += 140;
  }

  if (candidate.sourceProvider.includes("fishing_store_ua")) {
    score += 20;
  }

  if (path && !/^\/(?:ua\/)?search\/?$/i.test(path)) {
    score += 30;
  }

  return score;
}

function safePath(url: string): string | undefined {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
