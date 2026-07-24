import type { PriceHistoryRecord } from "../types.js";

const PRICE_HISTORY_COLUMNS = [
  "timestamp",
  "savedSearchId",
  "savedSearchName",
  "query",
  "groupKey",
  "groupLabel",
  "minPrice",
  "maxPrice",
  "currency",
  "offerCount",
  "sources",
  "sellerCount",
  "sellers",
  "alertCount",
  "alerts",
  "bestOfferUrl"
];

export function exportPriceHistoryJson(records: PriceHistoryRecord[]): string {
  return `${JSON.stringify(records, null, 2)}\n`;
}

export function exportPriceHistoryCsv(records: PriceHistoryRecord[]): string {
  const rows = records.flatMap((record) => {
    if (record.groups.length === 0) {
      return [recordToCsvRow(record)];
    }

    return record.groups.map((group) => recordToCsvRow(record, group));
  });

  return [
    PRICE_HISTORY_COLUMNS.join(","),
    ...rows.map((row) => PRICE_HISTORY_COLUMNS.map((column) => csvCell(row[column] ?? "")).join(","))
  ].join("\n") + "\n";
}

export function priceHistoryContentType(format: "csv" | "json"): string {
  return format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8";
}

function recordToCsvRow(
  record: PriceHistoryRecord,
  group: PriceHistoryRecord["groups"][number] | undefined = undefined
): Record<string, string | number | undefined> {
  return {
    timestamp: record.timestamp,
    savedSearchId: record.savedSearchId,
    savedSearchName: record.savedSearchName,
    query: record.query,
    groupKey: group?.key,
    groupLabel: group?.label,
    minPrice: group?.minPrice,
    maxPrice: group?.maxPrice,
    currency: group?.currency,
    offerCount: group?.offerCount,
    sources: group?.sources.join("; "),
    sellerCount: group?.sellerCount,
    sellers: group?.sellers?.join("; "),
    alertCount: record.alerts.length,
    alerts: record.alerts.map((alert) => `${alert.type}: ${alert.message}`).join(" | "),
    bestOfferUrl: group?.bestOfferUrl
  };
}

function csvCell(value: string | number): string {
  const text = String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}
