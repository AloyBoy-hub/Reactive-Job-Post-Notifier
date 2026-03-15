import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getAuthToken } from "../lib/http";
import { runScrapeCycle } from "../lib/scrapePipeline";
import { serverEnv } from "../lib/serverEnv";

export const config = {
  maxDuration: 60
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = getAuthToken(req);
  if (!token || token !== serverEnv.cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await runScrapeCycle("cron");
    res.status(200).json(result);
  } catch (errorValue) {
    const message = errorValue instanceof Error ? errorValue.message : "Scrape failed";
    res.status(500).json({ error: message });
  }
}
