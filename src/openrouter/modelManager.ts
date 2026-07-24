import { readFile, writeFile } from "node:fs/promises";

export type OpenRouterModelSort =
  | "intelligence-high-to-low"
  | "agentic-high-to-low"
  | "top-weekly"
  | "most-popular"
  | "context-high-to-low"
  | "throughput-high-to-low"
  | "latency-low-to-high";

export interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
  };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

export interface RankedOpenRouterModel extends OpenRouterModel {
  localScore: number;
  selectionReason: string;
}

export async function fetchOpenRouterModels(sort: OpenRouterModelSort): Promise<OpenRouterModel[]> {
  const url = new URL("https://openrouter.ai/api/v1/models");
  url.searchParams.set("sort", sort);
  url.searchParams.set("output_modalities", "text");
  url.searchParams.set("limit", "1000");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as OpenRouterModelsResponse;
  return data.data ?? [];
}

export function rankFreeTextModels(models: OpenRouterModel[]): RankedOpenRouterModel[] {
  return models
    .filter(isFreeTextModel)
    .map((model, index) => {
      const context = model.context_length ?? model.top_provider?.context_length ?? 0;
      const completion = model.top_provider?.max_completion_tokens ?? 0;
      const id = model.id.toLowerCase();
      const name = model.name?.toLowerCase() ?? "";
      let localScore = 1000 - index;
      const reasons = ["free text model", `OpenRouter sorted rank #${index + 1}`];

      if (context >= 1_000_000) {
        localScore += 80;
        reasons.push("very large context");
      } else if (context >= 250_000) {
        localScore += 40;
        reasons.push("large context");
      }

      if (completion >= 32_000) {
        localScore += 20;
        reasons.push("large completion budget");
      }

      if (/nemotron|gemma|cohere|qwen|deepseek|gpt-oss|llama/.test(id)) {
        localScore += 30;
        reasons.push("general reasoning family");
      }

      if (/code|coder/.test(id + " " + name)) {
        localScore += 8;
        reasons.push("coding-capable family");
      }

      if (/safety|guard|moderation/.test(id + " " + name)) {
        localScore -= 250;
        reasons.push("penalized safety/moderation model");
      }

      if (id === "openrouter/free") {
        localScore -= 60;
        reasons.push("router fallback, not a fixed model");
      }

      return {
        ...model,
        localScore,
        selectionReason: reasons.join("; ")
      };
    })
    .sort((a, b) => b.localScore - a.localScore);
}

export async function selectBestFreeModel(sort: OpenRouterModelSort): Promise<RankedOpenRouterModel> {
  const models = await fetchOpenRouterModels(sort);
  const ranked = rankFreeTextModels(models);
  const best = ranked[0];

  if (!best) {
    throw new Error("No free text models found from OpenRouter models API");
  }

  return best;
}

export async function updateEnvFile(path: string, values: Record<string, string>): Promise<void> {
  let content = "";

  try {
    content = await readFile(path, "utf8");
  } catch {
    content = "";
  }

  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");

    if (pattern.test(content)) {
      content = content.replace(pattern, line);
    } else {
      content = content.trimEnd();
      content += `${content ? "\n" : ""}${line}\n`;
    }
  }

  await writeFile(path, content);
}

export function formatModelLine(model: RankedOpenRouterModel, rank: number): string {
  const context = model.context_length ?? model.top_provider?.context_length ?? 0;
  const completion = model.top_provider?.max_completion_tokens ?? 0;
  return `${rank}. ${model.id} | ${model.name ?? "unnamed"} | ctx ${context} | max out ${completion} | score ${model.localScore}`;
}

function isFreeTextModel(model: OpenRouterModel): boolean {
  const output = model.architecture?.output_modalities ?? [];
  const modality = model.architecture?.modality ?? "";
  const promptFree = model.pricing?.prompt === "0";
  const completionFree = model.pricing?.completion === "0";
  const requestFree = !model.pricing?.request || model.pricing.request === "0";
  const isFreeById = model.id.endsWith(":free") || model.id === "openrouter/free";
  const textOutput = output.includes("text") || modality.endsWith("->text") || modality.includes("->text");
  const audioOutput = output.includes("audio") || modality.includes("->text+audio");

  return (isFreeById || (promptFree && completionFree && requestFree)) && textOutput && !audioOutput;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
