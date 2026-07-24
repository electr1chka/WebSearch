import type { FetchedPage } from "../types.js";

export function isBlockedPage(page: FetchedPage): boolean {
  const statusBlocked = page.status === 403 || page.status === 429;
  const title = page.title?.toLowerCase() ?? "";
  const content = `${page.html ?? ""}\n${page.text ?? ""}`.toLowerCase();

  return (
    (statusBlocked && /just a moment|access denied|captcha|forbidden/.test(title + content)) ||
    content.includes("challenges.cloudflare.com") ||
    content.includes("cf-chl") ||
    content.includes("checking your browser") ||
    content.includes("verify you are human") ||
    content.includes("captcha")
  );
}
