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
  const candidates = await discoverCandidates(providers, queryPlan.variants, config.maxResults);
  const fetchers = createFetchers(config);
  const products: ProductResult[] = [];

  for (const candidate of candidates.slice(0, config.maxPagesToFetch)) {
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
