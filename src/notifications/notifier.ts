import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentConfig, NotificationResult, ProductGroup, SavedSearch, SavedSearchAlert } from "../types.js";

const execFileAsync = promisify(execFile);

export async function sendSavedSearchNotifications(
  config: AgentConfig,
  search: SavedSearch,
  alerts: SavedSearchAlert[],
  groups: ProductGroup[],
  options: {
    force?: boolean;
  } = {}
): Promise<NotificationResult[]> {
  if (alerts.length === 0 || (!options.force && !config.notificationsEnabled)) {
    return [];
  }

  const message = formatAlertMessage(search, alerts, groups);
  const results: NotificationResult[] = [];

  if (config.telegramBotToken && config.telegramChatId) {
    results.push(await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message));
  }

  if (config.desktopNotifications) {
    results.push(await sendDesktopNotification(`AI Search: ${search.name}`, message));
  }

  return results;
}

function formatAlertMessage(search: SavedSearch, alerts: SavedSearchAlert[], groups: ProductGroup[]): string {
  const lines = [
    `Saved search: ${search.name}`,
    `Query: ${search.query}`,
    `Alerts: ${alerts.length}`,
    ""
  ];

  for (const alert of alerts.slice(0, 8)) {
    const price = alert.currentPrice ? ` (${alert.currentPrice})` : "";
    lines.push(`- ${alert.type}: ${alert.message}${price}`);
  }

  if (alerts.length > 8) {
    lines.push(`- ...and ${alerts.length - 8} more`);
  }

  const bestGroup = groups
    .filter((group) => group.minPrice !== undefined)
    .sort((a, b) => (a.minPrice ?? Number.MAX_SAFE_INTEGER) - (b.minPrice ?? Number.MAX_SAFE_INTEGER))[0];

  if (bestGroup) {
    lines.push("");
    lines.push(`Best price: ${bestGroup.label} - ${bestGroup.minPrice} ${bestGroup.currency ?? ""}`.trim());
    lines.push(bestGroup.bestOffer.url);
  }

  return lines.join("\n");
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<NotificationResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      return {
        provider: "telegram",
        ok: false,
        error: `Telegram returned HTTP ${response.status}`
      };
    }

    return {
      provider: "telegram",
      ok: true
    };
  } catch (error) {
    return {
      provider: "telegram",
      ok: false,
      error: error instanceof Error ? error.message : "telegram notification failed"
    };
  }
}

async function sendDesktopNotification(title: string, message: string): Promise<NotificationResult> {
  if (process.platform !== "darwin") {
    return {
      provider: "desktop",
      ok: false,
      error: "desktop notifications are currently supported only on macOS"
    };
  }

  try {
    await execFileAsync("osascript", [
      "-e",
      `display notification ${appleScriptString(shorten(message, 220))} with title ${appleScriptString(title)}`
    ]);

    return {
      provider: "desktop",
      ok: true
    };
  } catch (error) {
    return {
      provider: "desktop",
      ok: false,
      error: error instanceof Error ? error.message : "desktop notification failed"
    };
  }
}

function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function shorten(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
