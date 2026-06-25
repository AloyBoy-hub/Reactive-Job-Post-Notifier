import { load } from "cheerio";

import { extractTechStack, fallbackSummary, normalizeText, stripHtml } from "./parseHeuristics";
import type { ParsedJob } from "./types";

// Walks a parsed JSON-LD value, returning every object node it contains,
// descending into top-level arrays and `@graph` collections.
const flattenNodes = (parsed: unknown): Record<string, unknown>[] => {
  const nodes: Record<string, unknown>[] = [];

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") {
      return;
    }
    const obj = node as Record<string, unknown>;
    nodes.push(obj);
    if (Array.isArray(obj["@graph"])) {
      obj["@graph"].forEach(visit);
    }
  };

  visit(parsed);
  return nodes;
};

const isJobPosting = (obj: Record<string, unknown>): boolean => {
  const type = obj["@type"];
  if (Array.isArray(type)) {
    return type.some((entry) => String(entry).toLowerCase() === "jobposting");
  }
  return String(type ?? "").toLowerCase() === "jobposting";
};

const readOrgName = (org: unknown): string => {
  if (typeof org === "string") {
    return normalizeText(org);
  }
  if (org && typeof org === "object") {
    return normalizeText((org as Record<string, unknown>).name);
  }
  return "";
};

const formatAmount = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return normalizeText(String(value));
};

// Renders schema.org MonetaryAmount / number / string salary into a readable string.
const readSalary = (baseSalary: unknown): string | null => {
  if (typeof baseSalary === "string") {
    return normalizeText(baseSalary) || null;
  }
  if (typeof baseSalary === "number") {
    return String(baseSalary);
  }
  if (!baseSalary || typeof baseSalary !== "object") {
    return null;
  }

  const obj = baseSalary as Record<string, unknown>;
  const currency = normalizeText(obj.currency) || normalizeText(obj.currencyCode);
  const value = obj.value;

  let amount: string;
  let unit = "";

  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    unit = normalizeText(v.unitText);
    const min = formatAmount(v.minValue);
    const max = formatAmount(v.maxValue);
    const single = formatAmount(v.value);
    amount = min && max && min !== max ? `${min}–${max}` : single || min || max;
  } else {
    amount = formatAmount(value);
  }

  const head = [currency, amount].filter(Boolean).join(" ");
  if (!head) {
    return null;
  }
  return unit ? `${head} / ${unit}` : head;
};

const readSkills = (obj: Record<string, unknown>, descriptionText: string): string[] => {
  const raw = obj.skills;
  if (Array.isArray(raw)) {
    const items = raw.map((entry) => normalizeText(entry)).filter(Boolean);
    if (items.length > 0) {
      return items.slice(0, 20);
    }
  }
  if (typeof raw === "string" && raw.includes(",")) {
    const items = raw
      .split(",")
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
    if (items.length > 1) {
      return items.slice(0, 20);
    }
  }
  return extractTechStack(descriptionText);
};

const resolveUrl = (value: unknown, sourceUrl: string): string => {
  const raw = normalizeText(value);
  if (!raw) {
    return sourceUrl;
  }
  try {
    return new URL(raw, sourceUrl).toString();
  } catch {
    return sourceUrl;
  }
};

const jobFromNode = (obj: Record<string, unknown>, sourceUrl: string): ParsedJob | null => {
  const title = normalizeText(obj.title);
  const company = readOrgName(obj.hiringOrganization);
  if (!title || !company) {
    return null;
  }

  const descriptionText = stripHtml(typeof obj.description === "string" ? obj.description : "");

  return {
    job_title: title,
    company_name: company,
    salary: readSalary(obj.baseSalary),
    tech_stack: readSkills(obj, `${descriptionText} ${title}`),
    requirements_summary: descriptionText ? descriptionText.slice(0, 550) : fallbackSummary(title),
    job_url: resolveUrl(obj.url, sourceUrl)
  };
};

// Extracts schema.org JobPosting entries embedded as JSON-LD. This is the
// zero-cost, high-accuracy path that works without any LLM/API key.
export const extractJobPostingsFromHtml = (html: string, sourceUrl: string): ParsedJob[] => {
  if (!html) {
    return [];
  }

  const $ = load(html);
  const jobs: ParsedJob[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw.trim()) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    for (const node of flattenNodes(parsed)) {
      if (!isJobPosting(node)) {
        continue;
      }
      const job = jobFromNode(node, sourceUrl);
      if (job) {
        jobs.push(job);
      }
    }
  });

  return jobs.slice(0, 20);
};
