import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getServiceSupabaseClient } from "../lib/db";
import type { JobRecord } from "../lib/types";

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const supabase = getServiceSupabaseClient();
    const techFilter = firstValue(req.query.tech).trim().toLowerCase();
    const companyOrSourceFilter = firstValue(req.query.companyOrSource).trim().toLowerCase();
    const startDate = toIsoDateStart(firstValue(req.query.startDate));
    const endDate = toIsoDateEnd(firstValue(req.query.endDate));
    const rawLimit = Number.parseInt(firstValue(req.query.limit), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 2000) : 500;

    let query = supabase
      .from("jobs")
      .select(
        "id, tracked_url_id, job_title, company_name, salary, tech_stack, requirements_summary, job_url, raw_text, content_hash, first_seen_at, tracked_urls(url, label, source_type)"
      )
      .order("first_seen_at", { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte("first_seen_at", startDate);
    }
    if (endDate) {
      query = query.lte("first_seen_at", endDate);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const normalizedJobs = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const trackedUrlRaw = row.tracked_urls;
      const trackedUrl = Array.isArray(trackedUrlRaw)
        ? (trackedUrlRaw[0] as JobRecord["tracked_urls"] | undefined) ?? null
        : (trackedUrlRaw as JobRecord["tracked_urls"] | null);

      return {
        id: String(row.id ?? ""),
        tracked_url_id: String(row.tracked_url_id ?? ""),
        job_title: String(row.job_title ?? ""),
        company_name: String(row.company_name ?? ""),
        salary: row.salary ? String(row.salary) : null,
        tech_stack: Array.isArray(row.tech_stack)
          ? row.tech_stack.map((entry) => String(entry)).filter(Boolean)
          : [],
        requirements_summary: String(row.requirements_summary ?? ""),
        job_url: String(row.job_url ?? ""),
        raw_text: String(row.raw_text ?? ""),
        content_hash: String(row.content_hash ?? ""),
        first_seen_at: String(row.first_seen_at ?? ""),
        tracked_urls: trackedUrl
      } satisfies JobRecord;
    });

    const filtered = normalizedJobs.filter((job) => {
      if (techFilter) {
        const matchesTech = job.tech_stack.some((entry) => entry.toLowerCase().includes(techFilter));
        if (!matchesTech) {
          return false;
        }
      }

      if (companyOrSourceFilter) {
        const haystack = [
          job.company_name,
          job.job_title,
          job.tracked_urls?.url ?? "",
          job.tracked_urls?.label ?? ""
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(companyOrSourceFilter)) {
          return false;
        }
      }

      return true;
    });

    res.status(200).json({
      lastUpdatedAt: new Date().toISOString(),
      jobs: filtered
    });
  } catch (errorValue) {
    const message = errorValue instanceof Error ? errorValue.message : "Jobs API failed";
    res.status(500).json({ error: message });
  }
}
