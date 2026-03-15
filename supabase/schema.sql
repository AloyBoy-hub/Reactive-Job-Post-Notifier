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
