import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getServiceSupabaseClient } from "../lib/db";
import type { JobRecord, SourceType } from "../lib/types";

const firstValue = (input: string | string[] | undefined): string => {
  if (Array.isArray(input)) {
    return input[0] ?? "";
  }
  return input ?? "";
};

const toIsoDateStart = (dateInput: string): string | null => {
  if (!dateInput) {
    return null;
  }
  const date = new Date(`${dateInput}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const toIsoDateEnd = (dateInput: string): string | null => {
  if (!dateInput) {
    return null;
  }
  const date = new Date(`${dateInput}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

// Escapes ilike wildcards so user input is treated as a literal substring
// (backslash is the default ilike escape character in Postgres).
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const toFilterParam = (input: string | string[] | undefined): string | null => {
  const trimmed = firstValue(input).trim();
  return trimmed ? escapeLikePattern(trimmed) : null;
};

interface SearchJobRow {
  id: string | null;
  tracked_url_id: string | null;
  job_title: string | null;
  company_name: string | null;
  salary: string | null;
  tech_stack: unknown;
  requirements_summary: string | null;
  job_url: string | null;
  raw_text: string | null;
  content_hash: string | null;
  first_seen_at: string | null;
  tracked_url_url: string | null;
  tracked_url_label: string | null;
  tracked_url_source_type: SourceType | null;
}

const mapRow = (row: SearchJobRow): JobRecord => ({
  id: String(row.id ?? ""),
  tracked_url_id: String(row.tracked_url_id ?? ""),
  job_title: String(row.job_title ?? ""),
  company_name: String(row.company_name ?? ""),
  salary: row.salary ? String(row.salary) : null,
  tech_stack: Array.isArray(row.tech_stack) ? row.tech_stack.map((entry) => String(entry)).filter(Boolean) : [],
  requirements_summary: String(row.requirements_summary ?? ""),
  job_url: String(row.job_url ?? ""),
  raw_text: String(row.raw_text ?? ""),
  content_hash: String(row.content_hash ?? ""),
  first_seen_at: String(row.first_seen_at ?? ""),
  tracked_urls: row.tracked_url_url
    ? {
        url: String(row.tracked_url_url),
        label: row.tracked_url_label ? String(row.tracked_url_label) : null,
        source_type: row.tracked_url_source_type ?? "company_page"
      }
    : null
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const supabase = getServiceSupabaseClient();
    const rawLimit = Number.parseInt(firstValue(req.query.limit), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 2000) : 500;

    const { data, error } = await supabase.rpc("search_jobs", {
      p_tech: toFilterParam(req.query.tech),
      p_company_or_source: toFilterParam(req.query.companyOrSource),
      p_start: toIsoDateStart(firstValue(req.query.startDate)),
      p_end: toIsoDateEnd(firstValue(req.query.endDate)),
      p_limit: limit
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const jobs = ((data ?? []) as SearchJobRow[]).map(mapRow);

    res.status(200).json({
      lastUpdatedAt: new Date().toISOString(),
      jobs
    });
  } catch (errorValue) {
    const message = errorValue instanceof Error ? errorValue.message : "Jobs API failed";
    res.status(500).json({ error: message });
  }
}
