@AGENTS.md

# Net Values

NBA site that prices each player's season: production in dollars minus salary, reported in NVP (Net Value). Next.js 16 app on Vercel, Neon Postgres via Drizzle, and a Python scraper that fills the database.

## Layout

- `app/` — App Router pages: `players`, `teams`, `seasons`, `salaries`, `stats`, `net-value` (the explainer, sections in `_sections/`), `price-check`, award pages (`mvp`, `dpoy`, `roy`, `mip`, `6moy`), and `equation` (password-protected, hidden from search). `api/revalidate` clears the data cache; `api/search` backs site search.
- `components/` — shared UI, one component per file (tables, filters, headers, modals).
- `lib/db/` — `schema.ts` (every table), `queries.ts` (all reads), `cached.ts` (`unstable_cache` wrapper, one-day TTL, tag `nba-data`, skipped under `next dev`), `index.ts` (client).
- `lib/` — formatting, seasons, positions, awards, glossary, and the price-check math.
- `scraper/` — Python. Backfills are `backfill_*.py`, seeds are `seed_*.py`, and the model is `compute_production.py` → `compute_net_values.py`. `db.py` reads `DATABASE_URL` from the environment or `.env.local`.
- `OLD_PROJECT/` — the legacy SQLite and HoopsHype version. Reference only; don't edit it or read from it unless asked.

## Data flow

- Daily job: `scraper/update_season.py`, run by launchd through `scraper/schedule/run_daily.sh` (install with `install.sh`). Logs go to `scraper/logs/YYYY-MM-DD.log`. Use nba_api first and basketball-reference only for what nba_api lacks.
- Every job ends with `revalidate.py`, which stamps `site_meta` and posts to `/api/revalidate`. Run it by hand after a backfill.
- Scraper scripts upsert on (player_id, season), so they're safe to re-run. Most take a season argument.

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit`
- `npm run db:push` applies `lib/db/schema.ts` to Neon. That's the production database, so confirm before running it.
- Scraper: `cd scraper && .venv/bin/python <script>.py`

## Verifying a change

- UI: `npx tsc --noEmit`, `npm run lint`, then check the page in the browser on desktop and at 390px wide.
- Model: dry-run against history and report the max delta before writing.

## Copy conventions

- The unit is NVP. "Points" means points scored.
- American spelling (offense, defense) and the Oxford comma.
- In the explainer, define every formula variable bottom-up before showing the full formula.
