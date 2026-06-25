import { load } from "cheerio";

import type { ParsedJobBatch } from "./types";

const TECH_KEYWORDS = [
  "python",
  "javascript",
  "typescript",
  "react",
  "node.js",
  "next.js",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "terraform",
  "graphql",
  "rest api",
  "java",
  "go",
  "rust",
  "c++",
  "c#",
  ".net"
];

// Matches common salary shapes: "$120,000", "$120k", "120k - 150k", "USD 90,000",
// optionally followed by a period like "per year". Returns the first occurrence.
const SALARY_REGEX =
  /([$€£]\s?\d[\d.,]*\s?[kK]?(?:\s?(?:-|–|to)\s?[$€£]?\s?\d[\d.,]*\s?[kK]?)?(?:\s?(?:per|\/)\s?(?:year|annum|yr|hour|hr|month|mo))?|\b(?:USD|EUR|GBP|SGD|AUD|CAD)\s?\d[\d.,]*\s?[kK]?(?:\s?(?:-|–|to)\s?\d[\d.,]*\s?[kK]?)?)/;

export const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
};

export const stripHtml = (html: string): string => {
  if (!html) {
    return "";
  }
  const $ = load(`<div>${html}</div>`);
  return normalizeText($.root().text());
};

export const extractTechStack = (text: string): string[] => {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((keyword) => lower.includes(keyword.toLowerCase()))
    .slice(0, 12)
    .map((keyword) => keyword.replace(/\b\w/g, (c) => c.toUpperCase()));
};

export const fallbackSummary = (text: string): string => {
  const compressed = normalizeText(text);
  if (!compressed) {
    return "No requirement summary available.";
  }
  return compressed.slice(0, 550);
};

export const extractSalary = (text: string): string | null => {
  const match = SALARY_REGEX.exec(text);
  return match ? normalizeText(match[0]) : null;
};

// Trims a site-title suffix such as " | Acme Careers" or " - Acme".
const stripTitleSuffix = (raw: string): string => raw.split(/\s[|\-–·•]\s/)[0].trim();

const pickTitle = (html: string, text: string): string => {
  if (html) {
    const $ = load(html);
    const h1 = normalizeText($("h1").first().text());
    if (h1.length >= 3 && h1.length <= 160) {
      return h1;
    }
    const title = stripTitleSuffix(normalizeText($("title").first().text()));
    if (title.length >= 3 && title.length <= 160) {
      return title;
    }
  }

  const lines = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => line.length > 4 && line.length < 120) ?? "Unknown Role";
};

const pickCompany = (html: string, sourceUrl: string): string => {
  if (html) {
    const $ = load(html);
    const siteName = normalizeText($('meta[property="og:site_name"]').attr("content"));
    if (siteName) {
      return siteName;
    }
  }

  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return host.split(".")[0]?.replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown Company";
  } catch {
    return "Unknown Company";
  }
};

// Best-effort single job built from page text + HTML when no structured data
// and no LLM are available. Used as the zero-cost, no-API-key path.
export const buildHeuristicBatch = (text: string, html: string, sourceUrl: string): ParsedJobBatch => {
  return {
    jobs: [
      {
        job_title: pickTitle(html, text),
        company_name: pickCompany(html, sourceUrl),
        salary: extractSalary(text),
        tech_stack: extractTechStack(text),
        requirements_summary: fallbackSummary(text),
        job_url: sourceUrl
      }
    ]
  };
};
