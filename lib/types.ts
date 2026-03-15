export type SourceType = "linkedin" | "company_page";
export type ScrapeStatus = "success" | "failed" | "pending";

export interface TrackedUrlRecord {
  id: string;
  url: string;
  label: string | null;
  source_type: SourceType;
  added_at: string;
  last_scraped_at: string | null;
  last_scrape_status: ScrapeStatus;
}

export interface JobRecord {
  id: string;
  tracked_url_id: string;
  job_title: string;
  company_name: string;
  salary: string | null;
  tech_stack: string[];
  requirements_summary: string;
  job_url: string;
  raw_text: string;
  content_hash: string;
  first_seen_at: string;
  tracked_urls?: {
    url: string;
    label: string | null;
    source_type: SourceType;
  } | null;
}

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

export interface ScrapeFailure {
  trackedUrlId: string;
  url: string;
  reason: string;
}

export interface ScrapeCycleResult {
  startedAt: string;
  finishedAt: string;
  scannedCount: number;
  newJobsCount: number;
  failedCount: number;
  digestSent: boolean;
  failures: ScrapeFailure[];
}
