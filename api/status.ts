import type { VercelRequest, VercelResponse } from "@vercel/node";

import { serverEnv } from "../lib/config/serverEnv.js";
import { getServiceSupabaseClient } from "../lib/db/db.js";
import type { SystemStatus } from "../lib/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const openAiConfigured = Boolean(serverEnv.openAiApiKey);
  const resendConfigured = Boolean(serverEnv.resendApiKey && serverEnv.resendFromEmail && serverEnv.resendToEmail);

  let database = false;
  let trackedCount = 0;
  let jobCount = 0;
  let lastScrapeAt: string | null = null;

  try {
    const supabase = getServiceSupabaseClient();

    const tracked = await supabase.from("tracked_urls").select("*", { count: "exact", head: true });
    if (!tracked.error) {
      database = true;
      trackedCount = tracked.count ?? 0;
    }

    const jobs = await supabase.from("jobs").select("*", { count: "exact", head: true });
    if (!jobs.error) {
      jobCount = jobs.count ?? 0;
    }

    const lastScrape = await supabase
      .from("tracked_urls")
      .select("last_scraped_at")
      .not("last_scraped_at", "is", null)
      .order("last_scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastScrape.error && lastScrape.data) {
      lastScrapeAt = (lastScrape.data as { last_scraped_at: string | null }).last_scraped_at;
    }
  } catch {
    database = false;
  }

  const payload: SystemStatus = {
    database,
    openAiConfigured,
    resendConfigured,
    lastScrapeAt,
    trackedCount,
    jobCount
  };

  res.status(200).json(payload);
}
