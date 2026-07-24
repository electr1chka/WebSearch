#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runSearchAgent } from "./agent.js";
import {
  fetchOpenRouterModels,
  formatModelLine,
  rankFreeTextModels,
  selectBestFreeModel,
  updateEnvFile,
  type OpenRouterModelSort
} from "./openrouter/modelManager.js";
import { saveSearchRun } from "./storage/history.js";
import type { AgentConfig, ProductResult, SearchOptions } from "./types.js";

const program = new Command();

program
  .name("ai-web-search-agent")
  .description("AI-assisted web product search across many websites")
  .version("0.1.0");

const openrouter = program.command("openrouter").description("OpenRouter model utilities");

openrouter
  .command("models")
  .description("list free text models from OpenRouter")
  .option("--sort <sort>", "OpenRouter sort order", "intelligence-high-to-low")
  .option("--count <number>", "number of models to print", "10")
  .option("--json", "print raw JSON")
  .action(async (options: Record<string, string | boolean | undefined>) => {
    const sort = String(options.sort ?? "intelligence-high-to-low") as OpenRouterModelSort;
    const limit = Number(options.count ?? 10);
    const models = await fetchOpenRouterModels(sort);
    const ranked = rankFreeTextModels(models).slice(0, limit);

    if (options.json) {
      console.log(JSON.stringify(ranked, null, 2));
      return;
    }

    console.log(`Top ${ranked.length} free OpenRouter text models by ${sort}:\n`);
    ranked.forEach((model, index) => {
      console.log(formatModelLine(model, index + 1));
      console.log(`   ${model.selectionReason}`);
    });
  });

openrouter
  .command("select-free")
  .description("select the best free OpenRouter text model and write it to .env")
  .option("--sort <sort>", "OpenRouter sort order", "intelligence-high-to-low")
  .option("--env <path>", "env file path", ".env")
  .option("--dry-run", "print selection without writing .env")
  .action(async (options: Record<string, string | boolean | undefined>) => {
    const sort = String(options.sort ?? "intelligence-high-to-low") as OpenRouterModelSort;
    const envPath = String(options.env ?? ".env");
    const best = await selectBestFreeModel(sort);

    console.log("Selected OpenRouter free model:");
    console.log(formatModelLine(best, 1));
    console.log(`   ${best.selectionReason}`);

    if (options.dryRun) {
      return;
    }

    await updateEnvFile(envPath, {
      LLM_PROVIDER: "openrouter",
      OPENROUTER_MODEL: best.id
    });
    console.log(`Updated ${envPath}: OPENROUTER_MODEL=${best.id}`);
  });

program
  .command("search")
  .argument("<query>", "search query")
  .option("--json", "print raw JSON")
  .option("--max-results <number>", "maximum search candidates")
  .option("--max-pages <number>", "maximum pages to fetch")
  .option("--fetch-mode <mode>", "auto, http, browser, firecrawl")
  .option("--max-price <number>", "filter products above this price")
  .option("--min-price <number>", "filter products below this price")
  .option("--used", "only used products")
  .option("--new", "only new products")
  .option("--source <list>", "comma-separated source filter, e.g. olx,prom,hotline")
  .option("--limit <number>", "maximum products to print")
  .option("--ai", "use configured LLM for product analysis")
  .option("--save", "save search run to local history")
  .action(async (query: string, options: Record<string, string | boolean | undefined>) => {
    const config = loadConfig();
    const searchOptions = applyCliOptions(config, options);
    const result = await runSearchAgent(query, config, searchOptions);

    if (searchOptions.save) {
      await saveSearchRun(config.storagePath, query, result);
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printHumanResult(result.products, result.candidates.length);
  });

program
  .argument("[query]", "search query")
  .option("--json", "print raw JSON")
  .option("--max-results <number>", "maximum search candidates")
  .option("--max-pages <number>", "maximum pages to fetch")
  .option("--fetch-mode <mode>", "auto, http, browser, firecrawl")
  .option("--max-price <number>", "filter products above this price")
  .option("--min-price <number>", "filter products below this price")
  .option("--used", "only used products")
  .option("--new", "only new products")
  .option("--source <list>", "comma-separated source filter, e.g. olx,prom,hotline")
  .option("--limit <number>", "maximum products to print")
  .option("--ai", "use configured LLM for product analysis")
  .option("--save", "save search run to local history")
  .action(async (query: string | undefined, options: Record<string, string | boolean | undefined>) => {
    if (!query) {
      program.help();
      return;
    }

    const config = loadConfig();
    const searchOptions = applyCliOptions(config, options);
    const result = await runSearchAgent(query, config, searchOptions);

    if (searchOptions.save) {
      await saveSearchRun(config.storagePath, query, result);
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printHumanResult(result.products, result.candidates.length);
  });

await program.parseAsync();

function applyCliOptions(
  config: AgentConfig,
  options: Record<string, string | boolean | undefined>
): SearchOptions {
  if (options.maxResults) {
    config.maxResults = Number(options.maxResults);
  }

  if (options.maxPages) {
    config.maxPagesToFetch = Number(options.maxPages);
  }

  if (options.fetchMode) {
    config.fetchMode = String(options.fetchMode) as typeof config.fetchMode;
  }

  return {
    maxPrice: options.maxPrice ? Number(options.maxPrice) : undefined,
    minPrice: options.minPrice ? Number(options.minPrice) : undefined,
    condition: options.used ? "used" : options.new ? "new" : undefined,
    sources: typeof options.source === "string" ? options.source.split(",").map((item) => item.trim()) : undefined,
    productLimit: options.limit ? Number(options.limit) : undefined,
    ai: Boolean(options.ai),
    save: Boolean(options.save)
  };
}

function printHumanResult(products: ProductResult[], candidateCount: number): void {
  console.log(`Found ${products.length} product-like pages from ${candidateCount} candidates.\n`);

  if (products.length === 0) {
    console.log("No product-like pages extracted. Try adding API keys or increasing --max-results/--max-pages.");
    return;
  }

  for (const [index, product] of products.entries()) {
    const price = product.price ? `${product.price} ${product.currency ?? ""}`.trim() : "price unknown";
    const condition = product.condition ? `, ${product.condition}` : "";
    const availability = product.availability ? `, ${product.availability}` : "";
    const relevance = product.relevanceScore !== undefined ? ` | relevance: ${product.relevanceScore.toFixed(2)}` : "";
    const grade = product.matchGrade ? ` | ${product.matchGrade}` : "";

    console.log(`${index + 1}. ${product.title}`);
    console.log(`   ${price}${condition}${availability}`);
    console.log(`   confidence: ${product.confidence.toFixed(2)}${relevance}${grade} | ${product.sourceSite ?? "unknown source"}`);
    console.log(`   ${product.url}`);

    if (product.matchReason) {
      console.log(`   match: ${product.matchReason}`);
    }

    if (product.ai?.summary) {
      console.log(`   ai: ${product.ai.summary}`);
    }

    if (product.warnings?.length) {
      console.log(`   warnings: ${product.warnings.join("; ")}`);
    }

    if (product.evidence.length > 0) {
      console.log(`   evidence: ${product.evidence.join("; ")}`);
    }

    console.log("");
  }
}
