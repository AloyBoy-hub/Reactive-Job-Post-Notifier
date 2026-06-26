import { FormEvent, useEffect, useMemo, useState } from "react";

import { addTrackedUrl, deleteTrackedUrl, fetchJobs, fetchStatus, fetchTrackedUrls, triggerScrapeNow } from "./api";
import type { Job, ScrapeResponse, SourceType, SystemStatus, TrackedUrl } from "./types";

type Page = "dashboard" | "scrape";
type JobView = "jobs" | "companies";

interface Filters {
  tech: string;
  companyOrSource: string;
  keyword: string;
}

const initialFilters: Filters = { tech: "", companyOrSource: "", keyword: "" };

const formatDateTime = (value: string | null): string => {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short" }).format(date);
};

const jobDescription = (job: Job): string => (job.description?.trim() || job.requirements_summary || "").trim();
const jobRequirements = (job: Job): string[] => job.requirements?.filter((r) => r.trim()) ?? [];

const titleCase = (value: string): string =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const guessCompanyFromUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");
    const segs = url.pathname.split("/").filter(Boolean);
    const pathAts = ["greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com"];
    if (pathAts.some((d) => host.endsWith(d)) && segs[0]) return titleCase(segs[0]);

    const labels = host.split(".");
    const subAts = ["workable.com", "bamboohr.com", "myworkdayjobs.com", "teamtailor.com", "recruitee.com"];
    if (subAts.some((d) => host.endsWith(d)) && labels.length > 2) return titleCase(labels[0]);

    const common = new Set(["careers", "career", "jobs", "job", "apply", "work", "boards", "talent", "hire"]);
    const filtered = labels.filter((l) => !common.has(l));
    const idx = filtered.length >= 2 ? filtered.length - 2 : 0;
    return titleCase(filtered[idx] || host);
  } catch {
    return "Unknown";
  }
};

const mostCommon = (values: string[]): string | null => {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
};

interface CompanyAgg {
  name: string;
  roles: Job[];
  sources: string[];
  lastSeen: string;
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [view, setView] = useState<JobView>("jobs");

  const [trackedUrls, setTrackedUrls] = useState<TrackedUrl[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLatency, setStatusLatency] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<ScrapeResponse | null>(null);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedKeyword, setAppliedKeyword] = useState<string>("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [scraping, setScraping] = useState<boolean>(false);
  const [addingUrl, setAddingUrl] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const [newUrl, setNewUrl] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newSourceType, setNewSourceType] = useState<SourceType>("company_page");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadAll = async (filterSet: Filters): Promise<void> => {
    setError("");
    try {
      const startedAt = performance.now();
      const [urls, jobsResponse, statusResponse] = await Promise.all([
        fetchTrackedUrls(),
        fetchJobs({ tech: filterSet.tech || undefined, companyOrSource: filterSet.companyOrSource || undefined }),
        fetchStatus().catch(() => null)
      ]);
      setTrackedUrls(urls);
      setJobs(jobsResponse.jobs);
      setLastUpdatedAt(jobsResponse.lastUpdatedAt);
      setStatus(statusResponse);
      setStatusLatency(statusResponse ? Math.round(performance.now() - startedAt) : null);
      setAppliedKeyword(filterSet.keyword.trim().toLowerCase());
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Failed to load dashboard data");
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadAll(initialFilters).finally(() => setLoading(false));
  }, []);

  const handleApplyFilters = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await loadAll(filters);
  };

  const handleAddTrackedUrl = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setAddingUrl(true);
    setError("");
    setNotice("");
    try {
      await addTrackedUrl({ url: newUrl, label: newLabel, sourceType: newSourceType });
      setNewUrl("");
      setNewLabel("");
      setNewSourceType("company_page");
      setNotice("Source added.");
      setTrackedUrls(await fetchTrackedUrls());
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to add source");
    } finally {
      setAddingUrl(false);
    }
  };

  const handleDeleteTrackedUrl = async (id: string): Promise<void> => {
    setError("");
    setNotice("");
    try {
      await deleteTrackedUrl(id);
      setNotice("Source removed.");
      setTrackedUrls(await fetchTrackedUrls());
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to remove source");
    }
  };

  const handleScrapeNow = async (): Promise<void> => {
    setScraping(true);
    setError("");
    setNotice("");
    try {
      const result = await triggerScrapeNow();
      setLastRun(result);
      setNotice(`Scrape complete: ${result.newJobsCount} new, ${result.failedCount} failed.`);
      await loadAll(filters);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Unable to run scrape");
    } finally {
      setScraping(false);
    }
  };

  const filteredJobs = useMemo(() => {
    if (!appliedKeyword) return jobs;
    return jobs.filter((job) => {
      const haystack = [jobDescription(job), jobRequirements(job).join(" "), job.job_title].join(" ").toLowerCase();
      return haystack.includes(appliedKeyword);
    });
  }, [jobs, appliedKeyword]);

  const companies = useMemo<CompanyAgg[]>(() => {
    const map = new Map<string, CompanyAgg>();
    for (const job of filteredJobs) {
      const key = job.company_name || "Unknown";
      let agg = map.get(key);
      if (!agg) {
        agg = { name: key, roles: [], sources: [], lastSeen: job.first_seen_at };
        map.set(key, agg);
      }
      agg.roles.push(job);
      const src = job.tracked_urls?.label || job.tracked_urls?.url;
      if (src) {
        const labelled = job.tracked_urls?.source_type === "linkedin" ? `via ${src}` : src;
        if (!agg.sources.includes(labelled)) agg.sources.push(labelled);
      }
      if (job.first_seen_at > agg.lastSeen) agg.lastSeen = job.first_seen_at;
    }
    for (const agg of map.values()) agg.roles.sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at));
    return [...map.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }, [filteredJobs]);

  const companyCount = companies.length;
  const totalJobs = status?.jobCount ?? jobs.length;
  const newThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return jobs.filter((j) => new Date(j.first_seen_at).getTime() >= weekAgo).length;
  }, [jobs]);

  const toggleExpanded = (id: string): void => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const sourceCompany = (url: TrackedUrl) => {
    const urlJobs = jobs.filter((j) => j.tracked_url_id === url.id);
    if (url.source_type === "linkedin") {
      const counts = new Map<string, number>();
      for (const j of urlJobs) counts.set(j.company_name, (counts.get(j.company_name) ?? 0) + 1);
      const list = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      return { multi: true as const, companies: list, totalRoles: urlJobs.length };
    }
    const name = mostCommon(urlJobs.map((j) => j.company_name));
    return name
      ? { multi: false as const, name, roles: urlJobs.length, guessed: false }
      : { multi: false as const, name: guessCompanyFromUrl(url.url), roles: 0, guessed: true };
  };

  const renderJob = (job: Job) => {
    const description = jobDescription(job);
    const requirements = jobRequirements(job);
    const isOpen = expanded[job.id];
    const source = job.tracked_urls?.label || job.tracked_urls?.url || "Unknown source";
    return (
      <div className="job" key={job.id}>
        <div className="jtop">
          <div>
            <h3>{job.job_title}</h3>
            <div className="co">{job.company_name}</div>
          </div>
          <span className="when">{formatDateTime(job.first_seen_at)}</span>
        </div>
        {requirements.length === 0 && description ? (
          <div className="jd">
            <div className="jd-label">Requirements</div>
            <p className={`jd-text${isOpen ? "" : " clamp"}`}>{description}</p>
            {description.length > 180 ? (
              <button type="button" className="show-more" onClick={() => toggleExpanded(job.id)}>
                {isOpen ? "Show less" : "Show more"}
              </button>
            ) : null}
          </div>
        ) : null}
        {requirements.length > 0 ? (
          <div className="jd">
            <div className="jd-label">Requirements</div>
            <ul className="req">
              {requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {job.tech_stack.length > 0 ? (
          <div className="chips">
            {job.tech_stack.map((t) => (
              <span className="chip" key={`${job.id}-${t}`}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="jfoot">
          <span className="src">Source: {source}</span>
          <a className="link" href={job.job_url} target="_blank" rel="noreferrer">
            Open listing →
          </a>
        </div>
      </div>
    );
  };

  const healthy = Boolean(status?.database);

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <div className="brand">
            <span className="logo" /> JobWatch
          </div>
          <nav className="nav-links">
            <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>
              Dashboard
            </button>
            <button className={page === "scrape" ? "active" : ""} onClick={() => setPage("scrape")}>
              Scrape
            </button>
          </nav>
          <span className={`tag ${healthy ? "ok" : ""}`}>
            <span className={`dot ${healthy ? "" : "red"}`} />
            {healthy ? "All systems go" : "Backend issue"}
          </span>
        </div>
      </header>

      <main>
        {page === "dashboard" ? (
          <section className="page">
            <div className="wrap">
              <div className="toprow">
                <div className="page-head">
                  <h1>Dashboard</h1>
                  <p>Roles and companies discovered across your tracked sources.</p>
                </div>
                <span className="tag">Last updated {formatDateTime(lastUpdatedAt || null)}</span>
              </div>

              {error ? <div className="notice err">{error}</div> : null}
              {notice ? <div className="notice ok">{notice}</div> : null}

              <div className="stats">
                <div className="stat">
                  <div className="n">{trackedUrls.length}</div>
                  <div className="l">Tracked sources</div>
                </div>
                <div className="stat">
                  <div className="n">{companyCount}</div>
                  <div className="l">Companies</div>
                </div>
                <div className="stat">
                  <div className="n">{totalJobs}</div>
                  <div className="l">Total jobs</div>
                </div>
                <div className="stat">
                  <div className="n">{newThisWeek}</div>
                  <div className="l">New this week</div>
                </div>
              </div>

              <div className="card">
                <div className="toprow" style={{ marginBottom: 16 }}>
                  <div className="segmented">
                    <button className={view === "jobs" ? "active" : ""} onClick={() => setView("jobs")}>
                      Jobs
                    </button>
                    <button className={view === "companies" ? "active" : ""} onClick={() => setView("companies")}>
                      Companies
                    </button>
                  </div>
                </div>

                {view === "jobs" ? (
                  <>
                    <form className="filters" onSubmit={handleApplyFilters}>
                      <input
                        placeholder="Tech keyword"
                        value={filters.tech}
                        onChange={(e) => setFilters((p) => ({ ...p, tech: e.target.value }))}
                      />
                      <input
                        placeholder="Company or source"
                        value={filters.companyOrSource}
                        onChange={(e) => setFilters((p) => ({ ...p, companyOrSource: e.target.value }))}
                      />
                      <input
                        placeholder="Keyword in JD / requirements"
                        value={filters.keyword}
                        onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))}
                      />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Apply
                      </button>
                    </form>

                    {loading ? (
                      <div className="empty">Loading jobs…</div>
                    ) : filteredJobs.length === 0 ? (
                      <div className="empty">No jobs matched your filters yet.</div>
                    ) : (
                      filteredJobs.map(renderJob)
                    )}
                  </>
                ) : (
                  <>
                    <p className="sub" style={{ marginTop: -4 }}>
                      Grouped from parsed postings · sorted by most recent. Click a company to see its roles.
                    </p>
                    {companies.length === 0 ? (
                      <div className="empty">No companies discovered yet.</div>
                    ) : (
                      companies.map((c, i) => (
                        <details className="exp" key={c.name} open={i === 0}>
                          <summary>
                            <span className="caret">▶</span>
                            <span className="co-name">{c.name}</span>
                            <span className="co-meta">
                              {c.roles.length} role{c.roles.length === 1 ? "" : "s"} · {c.sources.join(", ") || "—"}
                              <br />
                              last seen {formatDateTime(c.lastSeen)}
                            </span>
                          </summary>
                          <div className="exp-body">
                            {c.roles.map((job) => (
                              <div className="mini" key={job.id}>
                                <div className="jtop">
                                  <h4>{job.job_title}</h4>
                                  <span className="when">{formatDate(job.first_seen_at)}</span>
                                </div>
                                <p className="snip">
                                  {jobDescription(job).slice(0, 160) || "No description"}
                                  {job.tech_stack.length > 0 ? ` · ${job.tech_stack.slice(0, 4).join(", ")}` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="page">
            <div className="wrap">
              <div className="page-head" style={{ marginBottom: 22 }}>
                <h1>Scrape</h1>
                <p>System status, tracked sources, and manual runs.</p>
              </div>

              {error ? <div className="notice err">{error}</div> : null}
              {notice ? <div className="notice ok">{notice}</div> : null}

              <div className="card" style={{ marginBottom: 18 }}>
                <div className="toprow" style={{ marginBottom: 14 }}>
                  <h2>System status</h2>
                  <span className="hint">checked {formatDateTime(lastUpdatedAt || null)}</span>
                </div>
                <div className="status-grid">
                  <div className="status-tile">
                    <div className="name">
                      <span className={`dot ${status ? "" : "red"}`} />
                      API
                    </div>
                    <div className="detail">{status ? `operational · ${statusLatency ?? "—"} ms` : "unreachable"}</div>
                  </div>
                  <div className="status-tile">
                    <div className="name">
                      <span className={`dot ${status?.database ? "" : "red"}`} />
                      Database
                    </div>
                    <div className="detail">{status?.database ? "Supabase · connected" : "disconnected"}</div>
                  </div>
                  <div className="status-tile">
                    <div className="name">
                      <span className="dot" />
                      Hourly cron
                    </div>
                    <div className="detail">GitHub Actions · hourly</div>
                  </div>
                  <div className="status-tile">
                    <div className="name">
                      <span className="dot" />
                      Last scrape
                    </div>
                    <div className="detail">{formatDateTime(status?.lastScrapeAt ?? null)}</div>
                  </div>
                  <div className="status-tile">
                    <div className="name">
                      <span className="dot" />
                      Parser
                    </div>
                    <div className="detail">
                      {status?.openAiConfigured ? "OpenAI + JSON-LD" : "JSON-LD + heuristics"}
                    </div>
                  </div>
                  <div className="status-tile">
                    <div className="name">
                      <span className={`dot ${status?.resendConfigured ? "" : "amber"}`} />
                      Email digest
                    </div>
                    <div className="detail">{status?.resendConfigured ? "Resend · ready" : "not configured"}</div>
                  </div>
                </div>
              </div>

              <div className="grid2">
                <div className="card">
                  <h2>Tracked sources</h2>
                  <p className="sub">Add a LinkedIn search or a company career page.</p>
                  <form onSubmit={handleAddTrackedUrl}>
                    <label className="field">
                      <input
                        type="url"
                        required
                        placeholder="https://boards.greenhouse.io/acme"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <input
                        type="text"
                        placeholder="Optional label (e.g. Product roles)"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                      />
                    </label>
                    <div className="row">
                      <select value={newSourceType} onChange={(e) => setNewSourceType(e.target.value as SourceType)}>
                        <option value="company_page">Company Career Page</option>
                        <option value="linkedin">LinkedIn</option>
                      </select>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={addingUrl}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {addingUrl ? "Adding…" : "Add source"}
                      </button>
                    </div>
                  </form>

                  {trackedUrls.length === 0 ? (
                    <div className="empty" style={{ marginTop: 12 }}>
                      No sources yet.
                    </div>
                  ) : (
                    trackedUrls.map((url) => {
                      const info = sourceCompany(url);
                      return (
                        <div className="url-item" key={url.id}>
                          <div className="top">
                            <div>
                              <div className="label">{url.label || url.url}</div>
                              <div className="u">{url.url}</div>
                            </div>
                            <span className={`badge ${url.last_scrape_status}`}>{url.last_scrape_status}</span>
                          </div>

                          {info.multi ? (
                            <details className="exp">
                              <summary>
                                <span className="caret">▶</span>
                                <span className="co-name" style={{ fontSize: 14 }}>
                                  {info.companies.length} compan{info.companies.length === 1 ? "y" : "ies"} discovered
                                </span>
                                <span className="co-meta">{info.totalRoles} roles</span>
                              </summary>
                              <div className="exp-body">
                                {info.companies.length === 0 ? (
                                  <div className="co-row">No companies parsed yet.</div>
                                ) : (
                                  info.companies.map((c) => (
                                    <div className="co-row" key={c.name}>
                                      <span>{c.name}</span>
                                      <span className="hint">
                                        {c.count} role{c.count === 1 ? "" : "s"}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </details>
                          ) : (
                            <div className="company-line">
                              Company: <strong>{info.name}</strong>{" "}
                              {info.guessed ? (
                                <span className="hint guess">guessed from URL · confirms after first scrape</span>
                              ) : (
                                <span className="hint">
                                  · {info.roles} role{info.roles === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="acts">
                            <span className="seen">{formatDateTime(url.last_scraped_at)}</span>
                            <button
                              type="button"
                              className="remove"
                              onClick={() => void handleDeleteTrackedUrl(url.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="card">
                  <h2>Run a scrape</h2>
                  <p className="sub">Scrapes every source now, in addition to the hourly schedule.</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    disabled={scraping}
                    onClick={() => void handleScrapeNow()}
                  >
                    {scraping ? "Scraping…" : "Scrape now"}
                  </button>

                  <div className="url-item" style={{ marginTop: 16 }}>
                    <div className="mono" style={{ fontSize: 12, color: "var(--faint)", marginBottom: 8 }}>
                      {lastRun ? "LAST MANUAL RUN" : "NO MANUAL RUN YET"}
                    </div>
                    {lastRun ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "9px 18px" }}>
                        <span className="hint">Scanned</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{lastRun.scannedCount} sources</span>
                        <span className="hint">New jobs</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--green)" }}>
                          {lastRun.newJobsCount}
                        </span>
                        <span className="hint">Failed</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--red)" }}>
                          {lastRun.failedCount}
                        </span>
                        <span className="hint">Digest email</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{lastRun.digestSent ? "sent" : "skipped"}</span>
                      </div>
                    ) : (
                      <div className="hint">Click “Scrape now” to run the pipeline immediately.</div>
                    )}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div className="mono" style={{ fontSize: 12, color: "var(--faint)", marginBottom: 4 }}>
                      SOURCE ACTIVITY
                    </div>
                    {trackedUrls.length === 0 ? (
                      <div className="hint">No sources yet.</div>
                    ) : (
                      [...trackedUrls]
                        .sort((a, b) => (b.last_scraped_at || "").localeCompare(a.last_scraped_at || ""))
                        .slice(0, 6)
                        .map((url) => (
                          <div className="activity-line" key={url.id}>
                            <span className="t">{formatDateTime(url.last_scraped_at)}</span> &nbsp;
                            <span
                              style={{ color: url.last_scrape_status === "failed" ? "var(--red)" : "var(--muted)" }}
                            >
                              {url.label || url.url} · {url.last_scrape_status}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="foot">
        <div className="wrap foot-inner">
          <span>JobWatch · personal project</span>
          <span className="mono">scrape · parse · dedupe · notify</span>
        </div>
      </footer>
    </>
  );
}

export default App;
