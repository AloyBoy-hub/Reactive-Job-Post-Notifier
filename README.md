# Reactive Job Post Notifier

Single-user full-stack job tracker for LinkedIn and company career pages.  
Built with React + Vite + TypeScript, Vercel Serverless API routes, Supabase Postgres, OpenAI parsing, Playwright/Cheerio scraping, and Resend digest email notifications.

## What It Does

- Tracks job listing URLs in Supabase.
- Runs an hourly cron scrape (`0 * * * *`) through `/api/scrape`.
- Scrapes with Playwright for LinkedIn and Cheerio + fetch for static pages.
- Cleans/truncates page text, parses structured job data via OpenAI, and stores both structured fields and raw text.
- Deduplicates jobs using `sha256(job_title + company_name + job_url)`.
- Sends one batched Resend digest email per scrape cycle when new jobs are found.
- Shows tracked URLs and historical jobs on a dashboard with filters and manual scrape trigger.

## Project Structure

- `src/` frontend (React + Tailwind)
- `api/` Vercel serverless routes
- `lib/` shared backend utilities (scraping, parsing, dedupe, email)
- `supabase/schema.sql` reproducible database schema
- `vercel.json` cron schedule and function settings

## Required Environment Variables

Copy `.env.example` to `.env` for local development.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default in code: `gpt-4.1-mini`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`
- `CRON_SECRET`
- `SCRAPE_DELAY_MS` (default: `2500`, clamped to 2s-7s)

## Supabase Setup

1. Create a Supabase project.
2. Run SQL from `supabase/schema.sql`.
3. Add connection keys to your Vercel env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Add public frontend keys:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local dev server:
   ```bash
   npm run dev
   ```
3. Use `vercel dev` when you want local `/api/*` behavior close to deployment.

## Deploy to Vercel

1. Push project to GitHub (or deploy directly from local).
2. Import the project in Vercel.
3. Set all required environment variables in Vercel.
4. Deploy:
   ```bash
   vercel deploy
   ```
5. Cron configuration is already in `vercel.json`:
   - Schedule: `0 * * * *`
   - Path: `/api/scrape`
6. Vercel will call `/api/scrape` with `Authorization: Bearer <CRON_SECRET>`.

## API Endpoints

- `GET /api/tracked-urls` list tracked URLs
- `POST /api/tracked-urls` add URL
- `DELETE /api/tracked-urls` remove URL by `id`
- `GET /api/jobs` list historical jobs (supports query filters)
- `POST /api/scrape-now` manual scrape trigger from dashboard
- `GET|POST /api/scrape` cron scrape endpoint (requires bearer token = `CRON_SECRET`)

## Notes

- No authentication is implemented by design (single-user tool).
- This project does not scrape private APIs or authenticated pages.
- Robots.txt is checked before scraping each tracked URL.  
  If robots rules disallow the path for user-agent `*`, the URL is skipped and marked as failed.
- If a scrape fails for one URL, the cycle continues for remaining URLs.
- Digest email is always batched per scrape cycle.
