import type { Job, ScrapeResponse, SourceType, TrackedUrl } from "./types";

interface ApiErrorPayload {
  error?: string;
}

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

export const fetchTrackedUrls = async (): Promise<TrackedUrl[]> => {
  const payload = await requestJson<{ trackedUrls: TrackedUrl[] }>("/api/tracked-urls");
  return payload.trackedUrls;
};

export const addTrackedUrl = async (input: {
  url: string;
  label?: string;
  sourceType: SourceType;
}): Promise<TrackedUrl> => {
  const payload = await requestJson<{ trackedUrl: TrackedUrl }>("/api/tracked-urls", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: input.url,
      label: input.label,
      source_type: input.sourceType
    })
  });

  return payload.trackedUrl;
};

export const deleteTrackedUrl = async (id: string): Promise<void> => {
  await requestJson<{ success: boolean }>("/api/tracked-urls", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id })
  });
};

export const fetchJobs = async (filters: {
  tech?: string;
  companyOrSource?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ jobs: Job[]; lastUpdatedAt: string }> => {
  const params = new URLSearchParams();
  if (filters.tech) params.set("tech", filters.tech);
  if (filters.companyOrSource) params.set("companyOrSource", filters.companyOrSource);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  params.set("limit", "1000");

  return requestJson<{ jobs: Job[]; lastUpdatedAt: string }>(`/api/jobs?${params.toString()}`);
};

export const triggerScrapeNow = async (): Promise<ScrapeResponse> => {
  return requestJson<ScrapeResponse>("/api/scrape-now", {
    method: "POST"
  });
};
