// Centralized tuning constants for the scrape/parse/store pipeline.

// Character limits for stored or parsed text.
export const PAGE_TEXT_CHAR_LIMIT = 14000; // cleaned page text and stored raw_text
export const STORED_SUMMARY_CHAR_LIMIT = 1200; // jobs.requirements_summary in the DB
export const HEURISTIC_SUMMARY_CHAR_LIMIT = 550; // fallback/JSON-LD description summary
export const EMAIL_SUMMARY_CHAR_LIMIT = 260; // requirements cell in the digest email

// Parsing limits.
export const MAX_JOBS_PER_PAGE = 20; // cap on jobs extracted from a single page
export const MAX_TECH_STACK = 20; // cap on tech_stack entries per job
export const HEURISTIC_TECH_LIMIT = 12; // cap when keyword-scanning for tech

// Scrape pacing between tracked URLs (milliseconds).
export const DEFAULT_SCRAPE_DELAY_MS = 2500;
export const MIN_SCRAPE_DELAY_MS = 2000;
export const MAX_SCRAPE_DELAY_MS = 7000;

// Jobs query limits for /api/jobs.
export const DEFAULT_JOBS_LIMIT = 500;
export const MAX_JOBS_LIMIT = 2000;

// OpenAI default model when OPENAI_MODEL is not set.
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

// Known tech keywords used by the heuristic tech-stack extractor.
export const TECH_KEYWORDS = [
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
