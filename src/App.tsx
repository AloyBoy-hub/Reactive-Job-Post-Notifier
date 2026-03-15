import { FormEvent, useEffect, useState } from "react";

import { addTrackedUrl, deleteTrackedUrl, fetchJobs, fetchTrackedUrls, triggerScrapeNow } from "./api";
import { isSupabaseClientConfigured } from "./supabaseClient";
import type { Job, SourceType, TrackedUrl } from "./types";

interface Filters {
  tech: string;
  companyOrSource: string;
  startDate: string;
  endDate: string;
}

const initialFilters: Filters = {
  tech: "",
  companyOrSource: "",
  startDate: "",
  endDate: ""
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const statusClassMap: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700"
};

function App() {
  const [trackedUrls, setTrackedUrls] = useState<TrackedUrl[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scraping, setScraping] = useState<boolean>(false);
  const [addingUrl, setAddingUrl] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const [newUrl, setNewUrl] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newSourceType, setNewSourceType] = useState<SourceType>("company_page");

  const loadTrackedUrls = async (): Promise<void> => {
    const items = await fetchTrackedUrls();
    setTrackedUrls(items);
  };

  const loadJobs = async (filterSet: Filters): Promise<void> => {
    const response = await fetchJobs({
      tech: filterSet.tech || undefined,
      companyOrSource: filterSet.companyOrSource || undefined,
      startDate: filterSet.startDate || undefined,
      endDate: filterSet.endDate || undefined
    });

    setJobs(response.jobs);
    setLastUpdatedAt(response.lastUpdatedAt);
  };

  const refreshAll = async (filterSet: Filters, isInitialLoad: boolean): Promise<void> => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");

    try {
      await Promise.all([loadTrackedUrls(), loadJobs(filterSet)]);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll(initialFilters, true);
  }, []);

  const handleApplyFilters = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await refreshAll(filters, false);
  };

  const handleResetFilters = async (): Promise<void> => {
    setFilters(initialFilters);
    await refreshAll(initialFilters, false);
  };

  const handleAddTrackedUrl = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setAddingUrl(true);
    setError("");
    setNotice("");

    try {
      await addTrackedUrl({
        url: newUrl,
        label: newLabel,
        sourceType: newSourceType
      });
      setNewUrl("");
      setNewLabel("");
      setNewSourceType("company_page");
      setNotice("Tracked URL added.");
      await loadTrackedUrls();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to add tracked URL");
    } finally {
      setAddingUrl(false);
    }
  };

  const handleDeleteTrackedUrl = async (id: string): Promise<void> => {
    setError("");
    setNotice("");

    try {
      await deleteTrackedUrl(id);
      setNotice("Tracked URL removed.");
      await loadTrackedUrls();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to delete tracked URL");
    }
  };

  const handleScrapeNow = async (): Promise<void> => {
    setScraping(true);
    setError("");
    setNotice("");

    try {
      const result = await triggerScrapeNow();
      const summary = `Scrape complete: ${result.newJobsCount} new, ${result.failedCount} failed, digest ${
        result.digestSent ? "sent" : "skipped"
      }.`;
      setNotice(summary);
      await refreshAll(filters, false);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to run scrape");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper px-4 py-6 text-ink md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-black/10 bg-gradient-to-r from-[#fce6c5] via-[#f7d9c6] to-[#e6dbc6] p-6 shadow-panel">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate">Reactive Job Post Notifier</p>
              <h1 className="font-heading text-3xl font-bold leading-tight md:text-4xl">
                Live Job Watchtower
              </h1>
              <p className="mt-2 max-w-2xl font-body text-sm text-slate">
                Track LinkedIn and career pages, scrape hourly, parse with an LLM, and get digest alerts when new
                roles appear.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm md:items-end">
              <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-xs">
                Last Updated: {formatDateTime(lastUpdatedAt)}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-xs">
                Supabase Client: {isSupabaseClientConfigured() ? "configured" : "missing VITE keys"}
              </span>
              <button
                type="button"
                onClick={handleScrapeNow}
                disabled={scraping}
                className="rounded-full bg-ember px-4 py-2 font-heading text-sm font-semibold text-white transition hover:bg-[#bd3f1f] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {scraping ? "Scraping..." : "Scrape Now"}
              </button>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {notice ? (
          <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_1.95fr]">
          <article className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-panel">
            <h2 className="font-heading text-xl font-semibold">Tracked URLs</h2>
            <p className="mt-1 text-sm text-slate">Add or remove listing sources watched by the hourly cron job.</p>

            <form onSubmit={handleAddTrackedUrl} className="mt-4 space-y-3">
              <input
                type="url"
                required
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                placeholder="https://www.linkedin.com/jobs/search/..."
                className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-ember"
              />
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Optional label (e.g. Product roles)"
                className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-ember"
              />
              <select
                value={newSourceType}
                onChange={(event) => setNewSourceType(event.target.value as SourceType)}
                className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-ember"
              >
                <option value="company_page">Company Career Page</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <button
                type="submit"
                disabled={addingUrl}
                className="w-full rounded-xl bg-moss px-4 py-2 font-heading text-sm font-semibold text-white transition hover:bg-[#2e5a4e] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {addingUrl ? "Adding..." : "Add URL"}
              </button>
            </form>

            <div className="mt-4 space-y-3">
              {trackedUrls.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/20 p-4 text-sm text-slate">
                  No tracked URLs yet.
                </p>
              ) : (
                trackedUrls.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="truncate text-sm font-semibold">{entry.label || entry.url}</p>
                    <p className="mt-1 truncate font-mono text-xs text-slate">{entry.url}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                          statusClassMap[entry.last_scrape_status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {entry.last_scrape_status}
                      </span>
                      <span className="font-mono text-[11px] text-slate">
                        {formatDateTime(entry.last_scraped_at)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteTrackedUrl(entry.id);
                      }}
                      className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-panel">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="font-heading text-xl font-semibold">Historical Jobs</h2>
                <p className="mt-1 text-sm text-slate">Most recently discovered roles, filtered by your criteria.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refreshAll(filters, false);
                }}
                disabled={refreshing}
                className="rounded-full border border-black/20 px-4 py-2 text-sm font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <form onSubmit={handleApplyFilters} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                type="text"
                value={filters.tech}
                onChange={(event) => setFilters((prev) => ({ ...prev, tech: event.target.value }))}
                placeholder="Tech stack keyword"
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-ember"
              />
              <input
                type="text"
                value={filters.companyOrSource}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    companyOrSource: event.target.value
                  }))
                }
                placeholder="Company or source URL"
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-ember"
              />
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-ember"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-ember"
              />
              <button
                type="submit"
                className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111827]"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleResetFilters();
                }}
                className="rounded-xl border border-black/20 px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
              >
                Reset
              </button>
            </form>

            {loading ? (
              <p className="mt-5 text-sm text-slate">Loading jobs...</p>
            ) : jobs.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-black/20 p-4 text-sm text-slate">
                No jobs matched your filters yet.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="font-heading text-lg font-semibold">{job.job_title}</h3>
                        <p className="text-sm text-slate">
                          {job.company_name} | {job.salary || "Salary not specified"}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-slate">{formatDateTime(job.first_seen_at)}</span>
                    </div>

                    <p className="mt-3 text-sm leading-6">{job.requirements_summary}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(job.tech_stack.length > 0 ? job.tech_stack : ["Not specified"]).map((tech) => (
                        <span key={`${job.id}-${tech}`} className="rounded-full bg-[#f1efe9] px-2 py-1 text-xs">
                          {tech}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-slate">
                      <p>Source: {job.tracked_urls?.label || job.tracked_urls?.url || "Unknown source"}</p>
                      <a
                        className="font-semibold text-ember underline underline-offset-2"
                        href={job.job_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open listing
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}

export default App;
