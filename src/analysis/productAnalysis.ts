import type { AgentConfig, ProductResult } from "../types.js";
import { chatJson, isLlmConfigured } from "../llm/client.js";

interface AiProductAnalysisResponse {
  products?: Array<{
    url: string;
    summary?: string;
    fit?: "exact" | "close" | "partial" | "not_relevant" | "unknown";
    riskFlags?: string[];
  }>;
}

export async function analyzeProductsWithAi(
  query: string,
  products: ProductResult[],
  config: AgentConfig
): Promise<ProductResult[]> {
  if (!isLlmConfigured(config) || products.length === 0) {
    return products;
  }

  const topProducts = products.slice(0, 20);
  const response = await chatJson<AiProductAnalysisResponse>(config, {
    temperature: 0,
    system:
      "You analyze shopping search results for a Ukrainian buyer. Return compact JSON only. For each product, judge whether it matches the user's query, mention model/brand mismatch, suspiciously low price, missing condition, or marketplace caveats. Keep summaries short.",
    user: JSON.stringify({
      query,
      products: topProducts.map((product) => ({
        title: product.title,
        url: product.url,
        price: product.price,
        currency: product.currency,
        sourceSite: product.sourceSite,
        condition: product.condition,
        availability: product.availability,
        relevanceScore: product.relevanceScore,
        matchGrade: product.matchGrade
      })),
      responseShape: {
        products: [
          {
            url: "same URL as input",
            summary: "one short sentence in Ukrainian",
            fit: "exact | close | partial | not_relevant | unknown",
            riskFlags: ["short Ukrainian risk labels"]
          }
        ]
      }
    })
  });

  if (!response?.products?.length) {
    return products;
  }

  const byUrl = new Map(response.products.map((item) => [item.url, item]));

  return products.map((product) => {
    const ai = byUrl.get(product.url);

    if (!ai) {
      return product;
    }

    return {
      ...product,
      ai: {
        summary: ai.summary,
        fit: ai.fit ?? "unknown",
        riskFlags: ai.riskFlags ?? []
      },
      warnings: [...(product.warnings ?? []), ...(ai.riskFlags ?? [])]
    };
  });
}
