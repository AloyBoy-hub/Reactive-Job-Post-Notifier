import { load } from "cheerio";

import { MAX_JOBS_PER_PAGE } from "../config/constants.js";
import { extractTechStack, normalizeText } from "./parseHeuristics.js";
import type { ParsedJob } from "../types.js";

/**
 * Deterministic parser for JobStreet search result pages.
 * Uses `[data-job-id]` job cards and `[data-automation]` attributes.
 */
const parseJobStreetSearch = (html: string, sourceUrl: string): ParsedJob[] => {
  const $ = load(html);
  const cards = $("[data-job-id]");
  if (cards.length === 0) return [];

  const origin = new URL(sourceUrl).origin;
  const jobs: ParsedJob[] = [];

  cards.each((_i, el) => {
    if (jobs.length >= MAX_JOBS_PER_PAGE) return;

    const card = $(el);
    const title = normalizeText(card.find('[data-automation="jobTitle"]').text());
    const company = normalizeText(card.find('[data-automation="jobCompany"]').text());
    if (!title || !company) return;

    const salary = normalizeText(card.find('[data-automation="jobSalary"]').text()) || null;
    const snippet = normalizeText(card.find('[data-automation="jobShortDescription"]').text());
    const location = normalizeText(card.find('[data-automation="jobCardLocation"]').text());

    const linkEl = card.find('a[href*="/job/"]').first();
    const href = linkEl.attr("href") || "";
    const jobUrl = href.startsWith("http") ? href.split("?")[0] : `${origin}${href.split("?")[0]}`;

    const fullText = `${title} ${snippet} ${location}`;
    jobs.push({
      job_title: title,
      company_name: company,
      salary,
      tech_stack: extractTechStack(fullText),
      requirements_summary: snippet || `${title} at ${company}`,
      job_url: jobUrl,
    });
  });

  return jobs;
};

/**
 * Deterministic parser for LinkedIn search result pages.
 * Uses `.job-search-card` cards with `.base-search-card__*` sub-elements.
 */
const parseLinkedInSearch = (html: string, _sourceUrl: string): ParsedJob[] => {
  const $ = load(html);
  const cards = $(".job-search-card");
  if (cards.length === 0) return [];

  const jobs: ParsedJob[] = [];

  cards.each((_i, el) => {
    if (jobs.length >= MAX_JOBS_PER_PAGE) return;

    const card = $(el);
    const title = normalizeText(card.find(".base-search-card__title").text());
    const company = normalizeText(card.find(".base-search-card__subtitle").text());
    if (!title || !company) return;

    const location = normalizeText(card.find(".job-search-card__location").text());
    const benefits = normalizeText(card.find(".job-posting-benefits__text").text());
    const salary = normalizeText(card.find(".job-search-card__salary-info").text()) || null;

    const linkEl = card.find("a.base-card__full-link");
    const href = linkEl.attr("href") || "";
    const jobUrl = href.split("?")[0]; // Strip tracking params

    const fullText = `${title} ${benefits} ${location}`;
    jobs.push({
      job_title: title,
      company_name: company,
      salary,
      tech_stack: extractTechStack(fullText),
      requirements_summary: benefits || `${title} at ${company}`,
      job_url: jobUrl,
    });
  });

  return jobs;
};

/**
 * Detects whether the HTML is a search results page from a supported site
 * and extracts jobs deterministically. Returns empty array if not a known
 * search page or no jobs found.
 */
export const extractJobsFromSearchPage = (html: string, sourceUrl: string): ParsedJob[] => {
  if (!html) return [];

  const url = sourceUrl.toLowerCase();

  if (url.includes("jobstreet.com")) {
    return parseJobStreetSearch(html, sourceUrl);
  }

  if (url.includes("linkedin.com")) {
    return parseLinkedInSearch(html, sourceUrl);
  }

  return [];
};
