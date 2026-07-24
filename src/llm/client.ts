import OpenAI from "openai";
import type { AgentConfig } from "../types.js";

export interface JsonChatRequest {
  system: string;
  user: string;
  temperature?: number;
}

export function isLlmConfigured(config: AgentConfig): boolean {
  if (config.llmProvider === "openrouter") {
    return Boolean(config.openRouterApiKey);
  }

  if (config.llmProvider === "openai") {
    return Boolean(config.openaiApiKey);
  }

  return false;
}

export async function chatJson<T>(config: AgentConfig, request: JsonChatRequest): Promise<T | undefined> {
  if (!isLlmConfigured(config)) {
    return undefined;
  }

  const client = createClient(config);
  const completion = await client.chat.completions.create({
    model: getModel(config),
    temperature: request.temperature ?? 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: request.system
      },
      {
        role: "user",
        content: request.user
      }
    ]
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return undefined;
  }

  return JSON.parse(content) as T;
}

function createClient(config: AgentConfig): OpenAI {
  if (config.llmProvider === "openrouter") {
    return new OpenAI({
      apiKey: config.openRouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        ...(config.openRouterSiteUrl ? { "HTTP-Referer": config.openRouterSiteUrl } : {}),
        "X-OpenRouter-Title": config.openRouterAppTitle
      }
    });
  }

  return new OpenAI({
    apiKey: config.openaiApiKey
  });
}

function getModel(config: AgentConfig): string {
  if (config.llmProvider === "openrouter") {
    return config.openRouterModel;
  }

  return config.openaiModel;
}
