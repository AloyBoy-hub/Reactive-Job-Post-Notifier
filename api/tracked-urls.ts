import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getServiceSupabaseClient } from "../lib/db";
import { getJsonBody } from "../lib/http";
import type { SourceType } from "../lib/types";

interface CreateTrackedUrlBody {
  url?: string;
  label?: string;
  source_type?: SourceType;
}

interface DeleteTrackedUrlBody {
  id?: string;
}

const inferSourceType = (url: string): SourceType => {
  return /linkedin\.com/i.test(url) ? "linkedin" : "company_page";
};

const normalizeUrl = (value: string): string => {
  const parsed = new URL(value.trim());
  return parsed.toString();
};

const handleGet = async (_req: VercelRequest, res: VercelResponse): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from("tracked_urls").select("*").order("added_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ trackedUrls: data ?? [] });
};

const handlePost = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const body = getJsonBody<CreateTrackedUrlBody>(req);

  if (!body.url?.trim()) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(body.url);
  } catch {
    res.status(400).json({ error: "url must be a valid absolute URL" });
    return;
  }

  const sourceType = body.source_type ?? inferSourceType(normalizedUrl);
  const payload = {
    url: normalizedUrl,
    label: body.label?.trim() || null,
    source_type: sourceType,
    last_scrape_status: "pending" as const
  };

  const { data, error } = await supabase.from("tracked_urls").insert(payload).select("*").single();

  if (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "URL already exists" });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ trackedUrl: data });
};

const handleDelete = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const body = getJsonBody<DeleteTrackedUrlBody>(req);
  const id = String(req.query.id ?? body.id ?? "").trim();

  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const { error } = await supabase.from("tracked_urls").delete().eq("id", id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ success: true });
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "GET") {
    await handleGet(req, res);
    return;
  }
  if (req.method === "POST") {
    await handlePost(req, res);
    return;
  }
  if (req.method === "DELETE") {
    await handleDelete(req, res);
    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).json({ error: "Method not allowed" });
}
