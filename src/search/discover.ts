import type { SearchCandidate } from "../types.js";
import type { SearchProvider } from "../providers/search/types.js";

export async function discoverCandidates(
  providers: SearchProvider[],
  queryVariants: string[],
  maxResults: number
): Promise<SearchCandidate[]> {
  const perQueryLimit = Math.max(5, Math.ceil(maxResults / Math.max(1, providers.length)));
  const settled = await Promise.allSettled(
    queryVariants.flatMap((query) =>
      providers.map(async (provider) => provider.search(query, perQueryLimit))
    )
  );

  const candidates = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return dedupeAndRank(candidates, queryVariants[0] ?? "").slice(0, maxResults);
}

function dedupeAndRank(candidates: SearchCandidate[], query: string): SearchCandidate[] {
  const byUrl = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    const normalizedUrl = normalizeUrl(candidate.url);
    const existing = byUrl.get(normalizedUrl);

    if (!existing || scoreCandidate(candidate, query) > scoreCandidate(existing, query)) {
      byUrl.set(normalizedUrl, {
        ...candidate,
        url: normalizedUrl
      });
    }
  }

  return diversifyDirectSources([...byUrl.values()].sort((a, b) => scoreCandidate(b, query) - scoreCandidate(a, query)), query);
}

function scoreCandidate(candidate: SearchCandidate, query: string): number {
  const title = candidate.title.toLowerCase();
  const snippet = candidate.snippet?.toLowerCase() ?? "";
  const url = candidate.url.toLowerCase();
  const productSignals = [
    "price",
    "buy",
    "used",
    "купити",
    "ціна",
    "наявності",
    "б/в",
    "olx",
    "rozetka",
    "prom",
    "hotline",
    "flagman",
    "shimano",
    "daiwa"
  ];
  const signalScore = productSignals.reduce(
    (score, signal) => score + (title.includes(signal) || snippet.includes(signal) || url.includes(signal) ? 1 : 0),
    0
  );
  const queryScore = queryTokenScore(query, `${title} ${snippet} ${url}`);
  const directSearchScore = directSourceDiscoveryBoost(candidate.sourceProvider);

  return 100 - candidate.rank + signalScore * 8 + queryScore + directSearchScore;
}

function diversifyDirectSources(candidates: SearchCandidate[], query: string): SearchCandidate[] {
  const directBySource = new Map<string, SearchCandidate>();
  const rest: SearchCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.sourceProvider.startsWith("ukrainian-market-search:")) {
      rest.push(candidate);
      continue;
    }

    const existing = directBySource.get(candidate.sourceProvider);
    if (!existing || directQueryScore(candidate, query) > directQueryScore(existing, query)) {
      directBySource.set(candidate.sourceProvider, candidate);
    }
  }

  return [...directBySource.values(), ...rest].sort((a, b) => scoreCandidate(b, query) - scoreCandidate(a, query));
}

function directQueryScore(candidate: SearchCandidate, query: string): number {
  const title = candidate.title.toLowerCase();
  let score = scoreCandidate(candidate, query);

  if (title.includes("купити україна") || title.includes("ціна україна")) {
    score += 4;
  }

  if (title.includes("japan used") || title.includes("jdm fishing")) {
    score -= 5;
  }

  if (!candidate.sourceProvider.endsWith(":olx") && title.includes("б/в olx")) {
    score -= 18;
  }

  return score;
}

function queryTokenScore(query: string, value: string): number {
  const normalizedValue = value.toLowerCase().replace(/\s+/g, " ");
  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
  const uniqueTokens = [...new Set(tokens)];

  return uniqueTokens.reduce((score, token) => score + (normalizedValue.includes(token) ? 12 : 0), 0);
}

function directSourceDiscoveryBoost(sourceProvider: string): number {
  if (!sourceProvider.startsWith("ukrainian-market-search:")) {
    return 0;
  }

  if (/(olx|rozetka|prom|zenmarket|digitaka|japantackle|jdmtackleheaven|ebay)$/.test(sourceProvider)) {
    return 78;
  }

  if (/(flagman|ibis|fish-fish|shimano-kiev|jdm-com-ua)$/.test(sourceProvider)) {
    return 48;
  }

  return 24;
}

function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";

    for (const param of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|yclid)/i.test(param)) {
        url.searchParams.delete(param);
      }
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}
