import chromium from "@sparticuz/chromium";
import playwright from "playwright-core";

import { cleanHtmlToText } from "./cleanText.js";
import type { ScrapedDocument, SourceType } from "../types.js";

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

const shouldUseBrowser = (url: string, _sourceType: SourceType): boolean => {
  if (!/linkedin\.com/i.test(url)) {
    return false;
  }
  // Public LinkedIn search pages work via static fetch.
  if (/linkedin\.com\/jobs\/search\b/i.test(url)) {
    return false;
  }
  return true;
};

export const scrapeTrackedUrl = async (url: string, sourceType: SourceType): Promise<ScrapedDocument> => {
  if (shouldUseBrowser(url, sourceType)) {
    return scrapeLinkedInPage(url);
  }

  return scrapeStaticPage(url);
};
