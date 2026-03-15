export type SourceType = "linkedin" | "company_page";
export type ScrapeStatus = "success" | "failed" | "pending";

export interface TrackedUrl {
  id: string;
  url: string;
  label: string | null;
  source_type: SourceType;
  added_at: string;
  last_scraped_at: string | null;
  last_scrape_status: ScrapeStatus;
}

export interface Job {
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
  tracked_urls: {
    url: string;
    label: string | null;
    source_type: SourceType;
  } | null;
}

export interface ScrapeResponse {
  startedAt: string;
  finishedAt: string;
  scannedCount: number;
  newJobsCount: number;
  failedCount: number;
  digestSent: boolean;
  failures: Array<{
    trackedUrlId: string;
    url: string;
    reason: string;
  }>;
}
