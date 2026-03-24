# LGCID Operations Dashboard

Mobile-first, brand-compliant Next.js dashboard for Lower Gardens CID weekly operations reporting.

## Documentation

User documentation is currently maintained in Google Docs:

- [User documentation](https://docs.google.com/document/d/17u0St-kbnLR7vrfqwDU9ECiKeU0BfElC-7XDF9piBm8)
- [Definitions](https://docs.google.com/document/d/13nKN0lO5W-CP1Ab7iB0tsDX5xaWo_zZOQ3sVTO0TqAU)
- [Sheet / CSV template specification](data/sheet-template.md)

## Features

- React/Next.js App Router + Tailwind CSS dashboard
- Secure server-side Google Sheets proxy (`/api/dashboard`)
- CSV-backed dashboard data (local files or Google Sheets)
- Weekly trend charts with 4-week moving averages
- C3 tracker based on logged requests, CID-managed resolved flags, and backlog by category
- Social value KPI module (shelter referrals + work readiness)
- Public safety wins + hotspot street ranking
- WhatsApp link sharing + PNG screenshot mode (`html-to-image`)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Keep `.env.local` in CSV mode (default):

```bash
DATA_SOURCE=local_csv
```

4. Start app:

```bash
npm run dev
```

## Testing

Use the local CSV dataset for repeatable upgrade validation:

```bash
DATA_SOURCE=local_csv npm test
```

`npm test` runs:
- a production build
- low-mock Vitest integration tests for the dashboard data pipeline
- Playwright end-to-end checks against the real local app

Useful test commands:

```bash
npm run test:integration
npm run test:e2e
npm run test:e2e:headed
```

If Playwright browsers are not installed yet, run:

```bash
npx playwright install chromium
```

The automated tests force `local_csv` mode where needed so they stay stable even if your `.env.local` is configured for Google Sheets.

## Localhost Google Sheets

Use this when you want `localhost` to read from the live Google Sheet through the same Vercel OIDC flow as the deployed app.

1. Link the repo to the Vercel project:

```bash
npx vercel link
```

2. Pull env vars into `.env.local`:

```bash
npx vercel env pull .env.local
```

3. Edit `.env.local` so it contains:

```bash
DATA_SOURCE=google_sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SHEET_ID=...
GOOGLE_WORKLOAD_IDENTITY_AUDIENCE=//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
VERCEL_OIDC_TOKEN=<DO NOT EDIT THIS LINE>
```

4. Start the app:

```bash
npm run dev
```

Notes:
- `VERCEL_OIDC_TOKEN` is pulled from Vercel for local development; you do not create it manually.
- If the token expires, rerun `npx vercel env pull .env.local`.
- If `vercel env pull` writes `DATA_SOURCE=local_csv`, change it back to `DATA_SOURCE=google_sheets` in `.env.local`.

### Troubleshooting

If you see this runtime error on localhost:

```text
Error code invalid_grant: ID Token issued at ... is stale to sign-in.
```

your local `VERCEL_OIDC_TOKEN` in `.env.local` is stale. The fix is to refresh the Vercel-managed local env file and restart the app:

```bash
npx vercel link
npx vercel env pull .env.local
```

## Data Flow

1. Dashboard data is maintained in CSV files:
- `data/csv/sections/general_incidents.csv`
- `data/csv/sections/public_safety.csv`
- `data/csv/sections/law_enforcement.csv`
- `data/csv/sections/cleaning.csv`
- `data/csv/sections/social_services.csv`
- `data/csv/sections/parks.csv`
- `data/csv/sections/control_room_engagement.csv`
- `data/csv/sections/c3_requests.csv`
- `data/csv/incidents.csv`
- `data/csv/published_weeks.csv`
2. CSV section files mirror spreadsheet sheets:
- category sheets use the documented matrix in [data/sheet-template.md](data/sheet-template.md): row `1` from column `B` onward contains `week_start` dates, and column `A` from row `2` onward contains category/stat labels
- `c3_requests` and `incidents` remain row-based as documented in [data/sheet-template.md](data/sheet-template.md)
- the dashboard derives weekly logged counts plus tracker status totals from the row-level `c3_requests` data
- `c3_requests.request_status` tracks the City of Cape Town workflow, while `c3_requests.resolved` is the CID-managed field used for resolved/backlog reporting
3. Week list always starts at `2025-08-01` and is derived from the weekly matrix sheet date headers in row `1` (`c3_requests` does not create reporting weeks).
4. Weekly dashboard views are controlled by `published_weeks`: only listed weeks appear in selectors, summary/current-week data, and trends.
5. Row-based datasets use the published window: `incidents` and `c3_requests` are included from the first published date through the end of the week containing the last published date.
6. Dashboard reads local CSV exports by default.
7. Optional: switch to Google Sheets later by setting:

```bash
DATA_SOURCE=google_sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SHEET_ID=...
GOOGLE_WORKLOAD_IDENTITY_AUDIENCE=//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
```

On Vercel, the recommended setup is keyless Workload Identity Federation:
- share the spreadsheet with the Google service account email
- configure a workload identity provider that trusts Vercel OIDC
- set `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE` to the provider audience above

## Google Cloud Setup

At a high level, the Google Cloud side is:

1. Create a service account for the dashboard.
2. Share the spreadsheet with that service account email as a reader.
3. Create a Workload Identity Pool and OIDC provider for Vercel.
4. Grant the Vercel workload identities permission to impersonate the service account.
5. Use the provider resource name as `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`.

## API

### `GET /api/dashboard?weekStart=YYYY-MM-DD&windowWeeks=number&preview=YYYY-MM-DD`

`windowWeeks` is optional. When omitted, hotspot intelligence is cumulative across all loaded incident data.
`preview` is optional. When provided, the dashboard includes the week containing that date even if it is not yet listed in `published_weeks`.

Returns:
- week metadata (`weeks`) + section datasets (`sections`)
- hardcoded summary/trend weekly metrics derived from sections
- selected/current week
- trend series with MA(4)
- hotspot ranking
- incident list

## Deployment (Vercel)

1. Push repo to private GitHub.
2. Create/import Vercel project from repo.
3. For CSV mode, set:
- `DATA_SOURCE=local_csv`
4. Optional (Google Sheets mode on Vercel, recommended), set:
- `DATA_SOURCE=google_sheets`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SHEET_ID`
- `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`
5. Deploy from `main` branch.

## Testing Google Sheets Mode

1. Set `DATA_SOURCE=google_sheets` in Vercel.
2. Deploy.
3. Open `/api/dashboard` on the deployment.
4. Confirm `meta.data_source` is `"google_sheets"`.
5. Change a visible spreadsheet value, wait for the cache window to pass, and confirm the API response updates.

## Validation Checklist

- Missing weeks render `NO_DATA_REPORTED`.
- Sheet URL/credentials are not exposed to client.
- Screenshot Mode exports current-week board PNG.
- `npm test` passes locally before upgrades are merged.
