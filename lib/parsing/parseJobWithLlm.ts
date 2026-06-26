import OpenAI from "openai";

import { MAX_JOBS_PER_PAGE, MAX_TECH_STACK } from "../config/constants.js";
import { extractJobPostingsFromHtml } from "./jobStructuredData.js";
import { buildHeuristicBatch, extractTechStack, fallbackSummary, normalizeText } from "./parseHeuristics.js";
import { serverEnv } from "../config/serverEnv.js";
import type { ParsedJob, ParsedJobBatch } from "../types.js";

let openAiClient: OpenAI | null = null;

const getOpenAiClient = (): OpenAI | null => {
  if (!serverEnv.openAiApiKey) {
    return null;
  }

  if (openAiClient) {
    return openAiClient;
  }

  openAiClient = new OpenAI({
    apiKey: serverEnv.openAiApiKey
  });

  return openAiClient;
};

const normalizeJob = (value: unknown, sourceUrl: string, fullText: string): ParsedJob | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const title = normalizeText(candidate.job_title);
  const company = normalizeText(candidate.company_name);
  const salaryText = normalizeText(candidate.salary);
  const requirements = normalizeText(candidate.requirements_summary);
  const parsedJobUrl = normalizeText(candidate.job_url) || sourceUrl;
  const rawTechStack = Array.isArray(candidate.tech_stack) ? candidate.tech_stack : [];

  if (!title || !company) {
    return null;
  }

  const techStack = rawTechStack
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, MAX_TECH_STACK);

  return {
    job_title: title,
    company_name: company,
    salary: salaryText || null,
    tech_stack: techStack.length > 0 ? techStack : extractTechStack(fullText),
    requirements_summary: requirements || fallbackSummary(fullText),
    job_url: parsedJobUrl
  };
};

const normalizeJobs = (value: unknown, sourceUrl: string, fullText: string): ParsedJob[] => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  const rawJobs = Array.isArray(candidate.jobs) ? candidate.jobs : [candidate];
  return rawJobs
    .map((entry) => normalizeJob(entry, sourceUrl, fullText))
    .filter((entry): entry is ParsedJob => entry !== null)
    .slice(0, MAX_JOBS_PER_PAGE);
};

// Parsing tiers (cheapest/most reliable first):
//   1. schema.org JSON-LD JobPosting embedded in the page (no API key needed).
//   2. OpenAI extraction, when OPENAI_API_KEY is configured.
//   3. Heuristic extraction from page text + HTML (always available).
export const parseJobsFromText = async (cleanedText: string, sourceUrl: string, html = ""): Promise<ParsedJobBatch> => {
  const structuredJobs = extractJobPostingsFromHtml(html, sourceUrl);
  if (structuredJobs.length > 0) {
    return { jobs: structuredJobs };
  }

  const model = getOpenAiClient();
  if (!model) {
    return buildHeuristicBatch(cleanedText, html, sourceUrl);
  }

  const prompt = [
    "Extract job postings from the provided page text.",
    "Return STRICT JSON only. No markdown or commentary.",
    "JSON shape:",
    "{",
    '  "jobs": [',
    "    {",
    '      "job_title": "string",',
    '      "company_name": "string",',
    '      "salary": "string or null",',
    '      "tech_stack": ["string"],',
    '      "requirements_summary": "string",',
    '      "job_url": "string"',
    "    }",
    "  ]",
    "}",
    "If salary is unknown, return null. If there are multiple jobs, include all of them."
  ].join("\n");

  try {
    const completion = await model.chat.completions.create({
      model: serverEnv.openAiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Source URL: ${sourceUrl}\n\nPage text:\n${cleanedText}`
        }
      ]
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      return buildHeuristicBatch(cleanedText, html, sourceUrl);
    }

    const parsed = JSON.parse(rawContent) as unknown;
    const jobs = normalizeJobs(parsed, sourceUrl, cleanedText);
    return jobs.length > 0 ? { jobs } : buildHeuristicBatch(cleanedText, html, sourceUrl);
  } catch {
    return buildHeuristicBatch(cleanedText, html, sourceUrl);
  }
};
