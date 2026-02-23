# LGCID Operations Dashboard

Mobile-first, brand-compliant Next.js dashboard for Lower Gardens CID weekly operations reporting.

## Features

- React/Next.js App Router + Tailwind CSS dashboard
- Secure server-side Google Sheets proxy (`/api/dashboard`)
- CSV-backed dashboard data (local files or Google Sheets)
- Weekly trend charts with 4-week moving averages
- C3 efficiency tracker (totals-first + optional departmental breakdown)
- Social value KPI module (shelter referrals + work readiness)
- Public safety wins + hotspot street ranking
- WhatsApp link sharing + PNG screenshot mode (`html2canvas`)

## Project Paths

- App entry: `/Users/dagmar/Code/personal/cid-dashboard/app/page.tsx`
- API route: `/Users/dagmar/Code/personal/cid-dashboard/app/api/dashboard/route.ts`
- Exported CSV: `/Users/dagmar/Code/personal/cid-dashboard/data/exports`
- Sheet template spec: `/Users/dagmar/Code/personal/cid-dashboard/data/sheet-template.md`

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

The app will now read directly from:
- `/Users/dagmar/Code/personal/cid-dashboard/data/exports/weekly_metrics.csv`
- `/Users/dagmar/Code/personal/cid-dashboard/data/exports/incidents.csv`

## Data Flow

1. Dashboard data is maintained in CSV files:
- `weekly_metrics.csv`
- `incidents.csv`
2. CSVs can be manually imported into a Google Sheet with tabs:
- `weekly_metrics`
- `incidents`
3. Dashboard reads local CSV exports by default.
4. Optional: switch to Google Sheets later by setting:

```bash
DATA_SOURCE=google_sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
GOOGLE_SHEET_ID=...
```

## API

### `GET /api/dashboard?weekStart=YYYY-MM-DD&windowWeeks=number`

Returns:
- normalized weekly rows
- selected/current week
- trend series with MA(4)
- C3 totals and breakdown
- hotspot ranking
- incident list

## Deployment (Vercel)

1. Push repo to private GitHub.
2. Create/import Vercel project from repo.
3. For CSV mode, set:
- `DATA_SOURCE=local_csv`
4. Optional (Google Sheets mode), set:
- `DATA_SOURCE=google_sheets`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
5. Deploy from `main` branch.

## Validation Checklist

- Missing weeks render `NO_DATA_REPORTED`.
- Sheet URL/credentials are not exposed to client.
- Screenshot Mode exports current-week board PNG.
