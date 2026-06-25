// Re-export shared types under the backend's historical names so existing
// imports keep working, plus the backend-only parsing/scraping types.
export type { SourceType, ScrapeStatus, ScrapeFailure } from "../shared/types";
export type {
  Job as JobRecord,
  TrackedUrl as TrackedUrlRecord,
  ScrapeResult as ScrapeCycleResult
} from "../shared/types";

export interface ParsedJob {
  job_title: string;
  company_name: string;
  salary: string | null;
  tech_stack: string[];
  requirements_summary: string;
  job_url: string | null;
}

export interface ParsedJobBatch {
  jobs: ParsedJob[];
}

export interface ScrapedDocument {
  finalUrl: string;
  html: string;
  cleanedText: string;
}
