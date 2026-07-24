import type { AgentConfig, ProductResult, SearchOptions, SearchRunResult } from "./types.js";
import { extractProductList } from "./extraction/listExtractor.js";
import { extractProduct } from "./extraction/productExtractor.js";
import { createFetchers, fetchWithFallback } from "./fetchers/index.js";
import { createSearchProviders } from "./providers/search/index.js";
import { analyzeProductsWithAi } from "./analysis/productAnalysis.js";
import { groupProducts } from "./ranking/productGrouping.js";
import { scoreAndFilterProducts } from "./ranking/productScoring.js";
import { discoverCandidates } from "./search/discover.js";
import { createQueryPlan } from "./search/queryPlanner.js";
import { productIdentityKey } from "./utils/productIdentity.js";

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
  const fetchCandidates = orderCandidatesForFetch(filterCandidatesBySource(candidates, options.sources));

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
    products: analyzedProducts,
    groups: groupProducts(analyzedProducts)
  };
}

function dedupeProducts(products: ProductResult[]): ProductResult[] {
  const byKey = new Map<string, ProductResult>();

  for (const product of products) {
    const key = productIdentityKey(product);
    const existing = byKey.get(key);

    if (!existing || product.confidence > existing.confidence) {
      byKey.set(key, product);
    }
  }

  return [...byKey.values()];
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
  });
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
  const host = safeHost(candidate.url)?.replace(/^www\./, "").toLowerCase() ?? "";

  if (candidate.sourceProvider.startsWith("ukrainian-market-search:")) {
    score += 100;
  }

  if (candidate.sourceProvider.endsWith("-api")) {
    score += 140;
  }

  if (candidate.sourceProvider.includes("fishing_store_ua")) {
    score += 20;
  }

  if (isPriorityStoreHost(host)) {
    score += 35;
  }

  if (path && !isSearchPath(path)) {
    score += 30;
  }

  return score;
}

function orderCandidatesForFetch(candidates: SearchRunResult["candidates"]): SearchRunResult["candidates"] {
  return [...candidates].sort((a, b) => {
    const directDelta = directCandidateScore(b) - directCandidateScore(a);
    if (directDelta !== 0) {
      return directDelta;
    }

    return a.rank - b.rank;
  });
}

function isPriorityStoreHost(host: string): boolean {
  return [
    "ibis-gear.com",
    "flagman.ua",
    "shimano.kiev.ua",
    "fish-fish.com.ua",
    "zabros.com.ua",
    "daiwa.in.ua",
    "aquatory.com.ua",
    "fanatik.com.ua",
    "jdm.com.ua"
  ].some((priorityHost) => host === priorityHost || host.endsWith(`.${priorityHost}`));
}

function isSearchPath(path: string): boolean {
  return /^\/(?:ua\/)?(?:search|sr|ek-list)\b/i.test(path);
}

function safePath(url: string): string | undefined {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
