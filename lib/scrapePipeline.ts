import { getServiceSupabaseClient } from "./db";
import { delay, normalizeDelay } from "./delay";
import type { DigestJob } from "./email";
import { sendDigestEmail } from "./email";
import { createContentHash } from "./hash";
import { parseJobsFromText } from "./parseJobWithLlm";
import { scrapeTrackedUrl } from "./scrape";
import { serverEnv } from "./serverEnv";
import type { JobRecord, ScrapeCycleResult, ScrapeFailure, ScrapeStatus, TrackedUrlRecord } from "./types";

const updateTrackedUrlStatus = async (id: string, status: ScrapeStatus): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  await supabase
    .from("tracked_urls")
    .update({
      last_scrape_status: status,
      last_scraped_at: new Date().toISOString()
    })
    .eq("id", id);
};

const normalizeSummary = (summary: string): string => {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 1200);
};

const getExistingJobId = async (contentHash: string): Promise<string | null> => {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as { id: string } | null)?.id ?? null;
};

const insertJobIfNew = async (
  trackedUrl: TrackedUrlRecord,
  parsedJob: {
    job_title: string;
    company_name: string;
    salary: string | null;
    tech_stack: string[];
    requirements_summary: string;
    job_url: string | null;
  },
  rawText: string
): Promise<JobRecord | null> => {
  const supabase = getServiceSupabaseClient();
  const jobUrl = parsedJob.job_url?.trim() || trackedUrl.url;
  const dedupeInput = `${parsedJob.job_title.toLowerCase()}|${parsedJob.company_name.toLowerCase()}|${jobUrl.toLowerCase()}`;
  const contentHash = createContentHash(dedupeInput);

  const existingId = await getExistingJobId(contentHash);
  if (existingId) {
    return null;
  }

  const payload = {
    tracked_url_id: trackedUrl.id,
    job_title: parsedJob.job_title.trim(),
    company_name: parsedJob.company_name.trim(),
    salary: parsedJob.salary?.trim() || null,
    tech_stack: parsedJob.tech_stack.slice(0, 20),
    requirements_summary: normalizeSummary(parsedJob.requirements_summary),
    job_url: jobUrl,
    raw_text: rawText.slice(0, 14000),
    content_hash: contentHash
  };

  const { data, error } = await supabase.from("jobs").insert(payload).select("*").single();
  if (error) {
    if (error.code === "23505") {
      return null;
    }
    throw error;
  }

  return data as JobRecord;
};

export const runScrapeCycle = async (trigger: "cron" | "manual"): Promise<ScrapeCycleResult> => {
  const startedAt = new Date();
  const supabase = getServiceSupabaseClient();
  const delayMs = normalizeDelay(serverEnv.scrapeDelayMs);

  const { data, error } = await supabase.from("tracked_urls").select("*").order("added_at", { ascending: true });
  if (error) {
    throw error;
  }

  const trackedUrls = (data ?? []) as TrackedUrlRecord[];
  const failures: ScrapeFailure[] = [];
  const digestJobs: DigestJob[] = [];

  for (const trackedUrl of trackedUrls) {
    try {
      const scraped = await scrapeTrackedUrl(trackedUrl.url, trackedUrl.source_type);
      const parsed = await parseJobsFromText(scraped.cleanedText, scraped.finalUrl);

      for (const parsedJob of parsed.jobs) {
        const inserted = await insertJobIfNew(trackedUrl, parsedJob, scraped.cleanedText);
        if (!inserted) {
          continue;
        }

        digestJobs.push({
          jobTitle: inserted.job_title,
          companyName: inserted.company_name,
          salary: inserted.salary,
          techStack: inserted.tech_stack,
          requirementsSummary: inserted.requirements_summary,
          jobUrl: inserted.job_url,
          sourceUrl: trackedUrl.url,
          firstSeenAt: inserted.first_seen_at
        });
      }

      await updateTrackedUrlStatus(trackedUrl.id, "success");
    } catch (errorValue) {
      const reason = errorValue instanceof Error ? errorValue.message : "Unknown scrape error";
      failures.push({
        trackedUrlId: trackedUrl.id,
        url: trackedUrl.url,
        reason
      });
      await updateTrackedUrlStatus(trackedUrl.id, "failed");
    }

    await delay(delayMs);
  }

  let digestSent = false;
  if (digestJobs.length > 0) {
    digestSent = await sendDigestEmail(digestJobs, trigger);
  }

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    scannedCount: trackedUrls.length,
    newJobsCount: digestJobs.length,
    failedCount: failures.length,
    digestSent,
    failures
  };
};
