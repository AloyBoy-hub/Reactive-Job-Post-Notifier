import chromium from "@sparticuz/chromium";
import playwright from "playwright-core";

import { cleanHtmlToText } from "./cleanText";
import type { ScrapedDocument, SourceType } from "./types";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const bestPrefixLength = (rules: string[], path: string): number => {
  let best = -1;
  for (const rule of rules) {
    if (!rule) {
      continue;
    }
    if (path.startsWith(rule)) {
      best = Math.max(best, rule.length);
    }
  }
  return best;
};

const allowsByRobots = async (targetUrl: string): Promise<boolean> => {
  const parsed = new URL(targetUrl);
  const robotsUrl = `${parsed.origin}/robots.txt`;

  try {
    const response = await fetchWithTimeout(robotsUrl, 8000);
    if (!response.ok) {
      return true;
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/);
    let wildcardSectionActive = false;
    const disallowRules: string[] = [];
    const allowRules: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.split("#")[0].trim();
      if (!line) {
        continue;
      }

      const [rawKey, ...rest] = line.split(":");
      if (!rawKey || rest.length === 0) {
        continue;
      }

      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (key === "user-agent") {
        wildcardSectionActive = value === "*";
        continue;
      }

      if (!wildcardSectionActive) {
        continue;
      }

      if (key === "disallow") {
        disallowRules.push(value);
      } else if (key === "allow") {
        allowRules.push(value);
      }
    }

    const path = parsed.pathname || "/";
    const allowLength = bestPrefixLength(allowRules, path);
    const disallowLength = bestPrefixLength(disallowRules, path);

    if (disallowLength === -1) {
      return true;
    }

    return allowLength >= disallowLength;
  } catch {
    return true;
  }
};

const scrapeStaticPage = async (url: string): Promise<ScrapedDocument> => {
  const response = await fetchWithTimeout(url, 25000);
  if (!response.ok) {
    throw new Error(`Static scrape failed with status ${response.status}`);
  }

  const html = await response.text();

  return {
    finalUrl: response.url || url,
    html,
    cleanedText: cleanHtmlToText(html)
  };
};

const scrapeLinkedInPage = async (url: string): Promise<ScrapedDocument> => {
  const executablePath = await chromium.executablePath();
  const headlessMode = chromium.headless === "shell" ? true : chromium.headless;
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath,
    headless: headlessMode
  });

  try {
    const page = await browser.newPage({
      extraHTTPHeaders: DEFAULT_HEADERS
    });
    if (chromium.defaultViewport) {
      await page.setViewportSize(chromium.defaultViewport);
    }

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });

    await page.waitForTimeout(1500);

    const html = await page.content();
    const finalUrl = page.url();

    return {
      finalUrl,
      html,
      cleanedText: cleanHtmlToText(html)
    };
  } finally {
    await browser.close();
  }
};

const shouldUseBrowser = (url: string, sourceType: SourceType): boolean => {
  return sourceType === "linkedin" || /linkedin\.com/i.test(url);
};

// WARNING: do not bypass robots.txt restrictions or private/authenticated pages.
export const scrapeTrackedUrl = async (url: string, sourceType: SourceType): Promise<ScrapedDocument> => {
  const allowed = await allowsByRobots(url);
  if (!allowed) {
    throw new Error("Scrape skipped because robots.txt disallows this path for user-agent '*'");
  }

  if (shouldUseBrowser(url, sourceType)) {
    return scrapeLinkedInPage(url);
  }

  return scrapeStaticPage(url);
};
