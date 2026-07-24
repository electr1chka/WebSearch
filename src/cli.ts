#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runSearchAgent } from "./agent.js";
import {
  exportPriceHistoryCsv,
  exportPriceHistoryJson
} from "./export/priceHistoryExport.js";
import {
  fetchOpenRouterModels,
  formatModelLine,
  rankFreeTextModels,
  selectBestFreeModel,
  updateEnvFile,
  type OpenRouterModelSort
} from "./openrouter/modelManager.js";
import { sendSavedSearchNotifications } from "./notifications/notifier.js";
import { saveSearchRun } from "./storage/history.js";
import {
  appendPriceHistoryRecord,
  createPriceHistoryRecord,
  readPriceHistory
} from "./storage/priceHistory.js";
import {
  addSavedSearch,
  compareSavedSearchRun,
  createSnapshot,
  findSavedSearch,
  readSavedSearches,
  updateSavedSearch
} from "./storage/savedSearches.js";
import type {
  AgentConfig,
  ProductGroup,
  ProductResult,
  NotificationResult,
  SavedSearch,
  SavedSearchAlert,
  SavedSearchRuntimeOptions,
  SearchOptions,
  PriceHistoryRecord
} from "./types.js";

const program = new Command();

program
  .name("ai-web-search-agent")
  .description("AI-assisted web product search across many websites")
  .version("0.1.0");

const openrouter = program.command("openrouter").description("OpenRouter model utilities");
const saved = program.command("saved").description("saved search utilities");

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

saved
  .command("add")
  .argument("<query>", "search query")
  .option("--name <name>", "saved search name")
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
  .action(async (query: string, options: Record<string, string | boolean | undefined>) => {
    const config = loadConfig();
    const search = await addSavedSearch(config.savedSearchesPath, {
      name: typeof options.name === "string" ? options.name : undefined,
      query,
      options: createSavedRuntimeOptions(options)
    });

    console.log(`Saved search ${search.id}: ${search.name}`);
  });

saved
  .command("list")
  .option("--json", "print raw JSON")
  .action(async (options: Record<string, string | boolean | undefined>) => {
    const config = loadConfig();
    const searches = await readSavedSearches(config.savedSearchesPath);

    if (options.json) {
      console.log(JSON.stringify(searches, null, 2));
      return;
    }

    if (searches.length === 0) {
      console.log("No saved searches.");
      return;
    }

    for (const search of searches) {
      const lastRun = search.lastRun ? ` | last run ${search.lastRun.timestamp}` : "";
      console.log(`${search.id} | ${search.name} | ${search.query}${lastRun}`);
    }
  });

saved
  .command("run")
  .argument("[idOrName]", "saved search id or exact name")
  .option("--all", "run all saved searches")
  .option("--notify", "send configured notifications for alerts")
  .option("--json", "print raw JSON")
  .action(async (idOrName: string | undefined, options: Record<string, string | boolean | undefined>) => {
    const config = loadConfig();
    const searches = await readSavedSearches(config.savedSearchesPath);
    const selectedSearches = selectSavedSearches(searches, idOrName, Boolean(options.all));

    if (selectedSearches.length === 0) {
      console.log("No saved searches matched.");
      return;
    }

    const runs = [];

    for (const search of selectedSearches) {
      const runConfig = applySavedRuntimeConfig(config, search.options);
      const result = await runSearchAgent(search.query, runConfig, search.options);
      const alerts = compareSavedSearchRun(search, result);
      const updatedSearch: SavedSearch = {
        ...search,
        updatedAt: new Date().toISOString(),
        lastRun: createSnapshot(result)
      };
      await updateSavedSearch(config.savedSearchesPath, updatedSearch);
      await appendPriceHistoryRecord(config.priceHistoryPath, createPriceHistoryRecord(updatedSearch, result.groups, alerts));
      const notifications = await sendSavedSearchNotifications(config, updatedSearch, alerts, result.groups, {
        force: Boolean(options.notify)
      });
      runs.push({ search: updatedSearch, alerts, notifications, result });

      if (!options.json) {
        printSavedRun(updatedSearch, alerts, result.groups);
        printNotificationResults(notifications, Boolean(options.notify), alerts.length);
      }
    }

    if (options.json) {
      console.log(JSON.stringify(runs, null, 2));
    }
  });

saved
  .command("history")
  .argument("[idOrName]", "saved search id or exact name")
  .option("--limit <number>", "history rows to print", "20")
  .option("--json", "print raw JSON")
  .action(async (idOrName: string | undefined, options: Record<string, string | boolean | undefined>) => {
    const config = loadConfig();
    const searches = await readSavedSearches(config.savedSearchesPath);
    const search = idOrName ? findSavedSearch(searches, idOrName) : undefined;
    const limit = Number(options.limit ?? 20);
    const records = await readPriceHistory(config.priceHistoryPath, {
      savedSearchId: search?.id,
      limit
    });

    if (options.json) {
      console.log(JSON.stringify(records, null, 2));
      return;
    }

    if (idOrName && !search) {
      console.log("Saved search not found.");
      return;
    }

    printPriceHistory(records);
  });

saved
  .command("export")
  .argument("[idOrName]", "saved search id or exact name")
  .option("--format <format>", "csv or json", "csv")
  .option("--limit <number>", "history rows to export", "1000")
  .option("--out <path>", "write export to file instead of stdout")
  .action(async (idOrName: string | undefined, options: Record<string, string | boolean | undefined>) => {
    const config = loadConfig();
    const searches = await readSavedSearches(config.savedSearchesPath);
    const search = idOrName ? findSavedSearch(searches, idOrName) : undefined;
    const format = options.format === "json" ? "json" : "csv";
    const limit = Number(options.limit ?? 1000);

    if (idOrName && !search) {
      console.log("Saved search not found.");
      return;
    }

    const records = await readPriceHistory(config.priceHistoryPath, {
      savedSearchId: search?.id,
      limit
    });
    const content = format === "json" ? exportPriceHistoryJson(records) : exportPriceHistoryCsv(records);

    if (typeof options.out === "string" && options.out.trim()) {
      await writeExportFile(options.out, content);
      console.log(`Wrote ${options.out}`);
      return;
    }

    process.stdout.write(content);
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

    printHumanResult(result.products, result.candidates.length, result.groups);
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

    printHumanResult(result.products, result.candidates.length, result.groups);
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

function createSavedRuntimeOptions(options: Record<string, string | boolean | undefined>): SavedSearchRuntimeOptions {
  return {
    maxPrice: options.maxPrice ? Number(options.maxPrice) : undefined,
    minPrice: options.minPrice ? Number(options.minPrice) : undefined,
    condition: options.used ? "used" : options.new ? "new" : undefined,
    sources: typeof options.source === "string" ? options.source.split(",").map((item) => item.trim()) : undefined,
    productLimit: options.limit ? Number(options.limit) : undefined,
    maxResults: options.maxResults ? Number(options.maxResults) : undefined,
    maxPages: options.maxPages ? Number(options.maxPages) : undefined,
    fetchMode: options.fetchMode ? String(options.fetchMode) as SavedSearchRuntimeOptions["fetchMode"] : undefined,
    ai: Boolean(options.ai),
    save: true
  };
}

function applySavedRuntimeConfig(config: AgentConfig, options: SavedSearchRuntimeOptions): AgentConfig {
  return {
    ...config,
    maxResults: options.maxResults ?? config.maxResults,
    maxPagesToFetch: options.maxPages ?? config.maxPagesToFetch,
    fetchMode: options.fetchMode ?? config.fetchMode
  };
}

function selectSavedSearches(searches: SavedSearch[], idOrName: string | undefined, all: boolean): SavedSearch[] {
  if (all) {
    return searches;
  }

  if (!idOrName) {
    return [];
  }

  const search = findSavedSearch(searches, idOrName);
  return search ? [search] : [];
}

function printSavedRun(search: SavedSearch, alerts: SavedSearchAlert[], groups: ProductGroup[]): void {
  console.log(`\nSaved search ${search.id}: ${search.name}`);
  console.log(`Query: ${search.query}`);
  console.log(`Groups: ${groups.length}`);

  if (alerts.length === 0) {
    console.log("Alerts: none");
  } else {
    console.log("Alerts:");
    for (const alert of alerts) {
      const price = alert.currentPrice ? ` | ${alert.currentPrice}` : "";
      const url = alert.url ? ` | ${alert.url}` : "";
      console.log(`- ${alert.type}: ${alert.message}${price}${url}`);
    }
  }

  if (groups.length > 0) {
    console.log("Top groups:");
    for (const [index, group] of groups.slice(0, 5).entries()) {
      const price = formatGroupPrice(group);
      const sellers = group.sellerCount ? ` | ${group.sellerCount} seller${group.sellerCount === 1 ? "" : "s"}` : "";
      console.log(`${index + 1}. ${group.label} | ${group.offerCount} offers${sellers}${price ? ` | ${price}` : ""}`);
    }
  }
}

function printNotificationResults(results: NotificationResult[], notifyRequested: boolean, alertCount: number): void {
  if (results.length === 0) {
    if (notifyRequested && alertCount > 0) {
      console.log("Notifications: no configured providers");
    }
    return;
  }

  console.log("Notifications:");

  for (const result of results) {
    const suffix = result.ok ? "ok" : `failed: ${result.error ?? "unknown error"}`;
    console.log(`- ${result.provider}: ${suffix}`);
  }
}

function printPriceHistory(records: PriceHistoryRecord[]): void {
  if (records.length === 0) {
    console.log("No price history.");
    return;
  }

  for (const record of records) {
    const cheapestGroup = record.groups
      .filter((group) => group.minPrice !== undefined)
      .sort((a, b) => (a.minPrice ?? Number.MAX_SAFE_INTEGER) - (b.minPrice ?? Number.MAX_SAFE_INTEGER))[0];
    const cheapest = cheapestGroup
      ? `${cheapestGroup.label}: ${cheapestGroup.minPrice} ${cheapestGroup.currency ?? ""}`.trim()
      : "price unknown";

    console.log(`${record.timestamp} | ${record.savedSearchName} | groups ${record.groups.length} | alerts ${record.alerts.length} | ${cheapest}`);
  }
}

async function writeExportFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function printHumanResult(products: ProductResult[], candidateCount: number, groups: ProductGroup[] = []): void {
  const groupSummary = groups.length ? ` in ${groups.length} groups` : "";
  console.log(`Found ${products.length} product-like pages${groupSummary} from ${candidateCount} candidates.\n`);

  if (products.length === 0) {
    console.log("No product-like pages extracted. Try adding API keys or increasing --max-results/--max-pages.");
    return;
  }

  if (groups.length > 0) {
    console.log("Groups:");

    for (const [index, group] of groups.entries()) {
      const price = formatGroupPrice(group);
      const sources = group.sources.length ? ` | ${group.sources.join(", ")}` : "";
      const sellers = group.sellerCount ? ` | ${group.sellerCount} seller${group.sellerCount === 1 ? "" : "s"}` : "";
      console.log(`${index + 1}. ${group.label}`);
      console.log(`   ${group.offerCount} offer${group.offerCount === 1 ? "" : "s"}${sellers}${price ? ` | ${price}` : ""}${sources}`);
    }

    console.log("");
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

function formatGroupPrice(group: ProductGroup): string | undefined {
  if (!group.minPrice && !group.maxPrice) {
    return undefined;
  }

  const currency = group.currency ?? "";

  if (group.minPrice === group.maxPrice) {
    return `${group.minPrice} ${currency}`.trim();
  }

  return `${group.minPrice ?? "?"}-${group.maxPrice ?? "?"} ${currency}`.trim();
}
