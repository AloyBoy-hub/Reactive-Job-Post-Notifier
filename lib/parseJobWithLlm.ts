import OpenAI from "openai";

import { serverEnv } from "./serverEnv";
import type { ParsedJob, ParsedJobBatch } from "./types";

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

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
};

const extractTechStack = (text: string): string[] => {
  const lower = text.toLowerCase();
  return TECH_KEYWORDS.filter((keyword) => lower.includes(keyword.toLowerCase()))
    .slice(0, 12)
    .map((keyword) => keyword.replace(/\b\w/g, (c) => c.toUpperCase()));
};

const fallbackSummary = (text: string): string => {
  const compressed = normalizeText(text);
  if (!compressed) {
    return "No requirement summary available.";
  }
  return compressed.slice(0, 550);
};

const fallbackParse = (text: string, sourceUrl: string): ParsedJobBatch => {
  const lines = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const probableTitle = lines.find((line) => line.length > 4 && line.length < 120) ?? "Unknown Role";
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const companyGuess = host.split(".")[0]?.replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown Company";

  return {
    jobs: [
      {
        job_title: probableTitle,
        company_name: companyGuess,
        salary: null,
        tech_stack: extractTechStack(text),
        requirements_summary: fallbackSummary(text),
        job_url: sourceUrl
      }
    ]
  };
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
    .slice(0, 20);

  return {
    job_title: title,
    company_name: company,
    salary: salaryText || null,
    tech_stack: techStack.length > 0 ? techStack : extractTechStack(fullText),
    requirements_summary: requirements || fallbackSummary(fullText),
    job_url: parsedJobUrl
  };
};

const normalizeBatch = (value: unknown, sourceUrl: string, fullText: string): ParsedJobBatch => {
  if (!value || typeof value !== "object") {
    return fallbackParse(fullText, sourceUrl);
  }

  const candidate = value as Record<string, unknown>;
  const rawJobs = Array.isArray(candidate.jobs) ? candidate.jobs : [candidate];
  const jobs = rawJobs
    .map((entry) => normalizeJob(entry, sourceUrl, fullText))
    .filter((entry): entry is ParsedJob => entry !== null)
    .slice(0, 20);

  if (jobs.length === 0) {
    return fallbackParse(fullText, sourceUrl);
  }

  return { jobs };
};

export const parseJobsFromText = async (cleanedText: string, sourceUrl: string): Promise<ParsedJobBatch> => {
  const model = getOpenAiClient();
  if (!model) {
    return fallbackParse(cleanedText, sourceUrl);
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
      return fallbackParse(cleanedText, sourceUrl);
    }

    const parsed = JSON.parse(rawContent) as unknown;
    return normalizeBatch(parsed, sourceUrl, cleanedText);
  } catch {
    return fallbackParse(cleanedText, sourceUrl);
  }
};
