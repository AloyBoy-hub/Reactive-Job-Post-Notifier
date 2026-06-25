create extension if not exists pgcrypto;

do $$
begin
  create type source_type as enum ('linkedin', 'company_page');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type scrape_status as enum ('success', 'failed', 'pending');
exception
  when duplicate_object then null;
end $$;

create table if not exists tracked_urls (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  label text,
  source_type source_type not null,
  added_at timestamptz not null default now(),
  last_scraped_at timestamptz,
  last_scrape_status scrape_status not null default 'pending'
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  tracked_url_id uuid not null references tracked_urls(id) on delete cascade,
  job_title text not null,
  company_name text not null,
  salary text,
  tech_stack text[] not null default '{}',
  requirements_summary text not null,
  job_url text not null,
  raw_text text not null,
  content_hash text not null unique,
  first_seen_at timestamptz not null default now()
);

create index if not exists idx_tracked_urls_added_at on tracked_urls (added_at desc);
create index if not exists idx_jobs_first_seen on jobs (first_seen_at desc);
create index if not exists idx_jobs_company_name on jobs (company_name);
create index if not exists idx_jobs_tech_stack on jobs using gin (tech_stack);

-- Filters jobs entirely in the database so paging/limits never drop matches.
-- p_tech does a case-insensitive substring match against any tech_stack element;
-- p_company_or_source matches company, title, source url, or source label.
-- Wildcard characters in the inputs are expected to be pre-escaped by the caller
-- (ilike default escape char is backslash).
create or replace function search_jobs(
  p_tech text default null,
  p_company_or_source text default null,
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_limit int default 500
)
returns table (
  id uuid,
  tracked_url_id uuid,
  job_title text,
  company_name text,
  salary text,
  tech_stack text[],
  requirements_summary text,
  job_url text,
  raw_text text,
  content_hash text,
  first_seen_at timestamptz,
  tracked_url_url text,
  tracked_url_label text,
  tracked_url_source_type source_type
)
language sql
stable
as $$
  select
    j.id,
    j.tracked_url_id,
    j.job_title,
    j.company_name,
    j.salary,
    j.tech_stack,
    j.requirements_summary,
    j.job_url,
    j.raw_text,
    j.content_hash,
    j.first_seen_at,
    t.url,
    t.label,
    t.source_type
  from jobs j
  left join tracked_urls t on t.id = j.tracked_url_id
  where (p_start is null or j.first_seen_at >= p_start)
    and (p_end is null or j.first_seen_at <= p_end)
    and (
      p_tech is null
      or exists (
        select 1 from unnest(j.tech_stack) as ts
        where ts ilike '%' || p_tech || '%'
      )
    )
    and (
      p_company_or_source is null
      or j.company_name ilike '%' || p_company_or_source || '%'
      or j.job_title ilike '%' || p_company_or_source || '%'
      or coalesce(t.url, '') ilike '%' || p_company_or_source || '%'
      or coalesce(t.label, '') ilike '%' || p_company_or_source || '%'
    )
  order by j.first_seen_at desc
  limit greatest(p_limit, 0);
$$;
