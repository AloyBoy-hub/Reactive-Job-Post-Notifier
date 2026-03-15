import type { VercelRequest, VercelResponse } from "@vercel/node";

import { runScrapeCycle } from "../lib/scrapePipeline";

export const config = {
  maxDuration: 60
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await runScrapeCycle("manual");
    res.status(200).json(result);
  } catch (errorValue) {
    const message = errorValue instanceof Error ? errorValue.message : "Manual scrape failed";
    res.status(500).json({ error: message });
  }
}
