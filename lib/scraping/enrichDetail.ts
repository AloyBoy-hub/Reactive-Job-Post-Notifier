import { cleanHtmlToText } from "./cleanText.js";
import { extractJobPostingsFromHtml } from "../parsing/jobStructuredData.js";
import { extractRequirementsSection, extractTechStack, normalizeText } from "../parsing/parseHeuristics.js";
import type { ParsedJob } from "../types.js";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

/**
 * Fetches a single job detail page and extracts richer requirements/tech data.
 * Returns an enriched partial that should be merged into the original ParsedJob.
 * Returns null if the fetch fails or yields no useful detail.
 */
export const enrichJobFromDetailPage = async (
  jobUrl: string
): Promise<Partial<ParsedJob> | null> => {
  if (!jobUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(jobUrl, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const cleanedText = cleanHtmlToText(html);

    // Try JSON-LD first (most reliable for detail pages)
    const structuredJobs = extractJobPostingsFromHtml(html, jobUrl);
    if (structuredJobs.length > 0) {
      const detail = structuredJobs[0];
      return {
        requirements_summary: detail.requirements_summary,
        tech_stack: detail.tech_stack.length > 0 ? detail.tech_stack : undefined,
        salary: detail.salary ?? undefined,
      };
    }

    // Fallback: try to extract requirements section from cleaned text
    const reqSection = extractRequirementsSection(cleanedText);
    if (reqSection) {
      const techStack = extractTechStack(cleanedText);
      return {
        requirements_summary: reqSection,
        tech_stack: techStack.length > 0 ? techStack : undefined,
      };
    }

    // Last resort: if cleaned text is substantial, use it as summary
    if (cleanedText.length > 100) {
      const techStack = extractTechStack(cleanedText);
      return {
        requirements_summary: normalizeText(cleanedText).slice(0, 550),
        tech_stack: techStack.length > 0 ? techStack : undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
};
