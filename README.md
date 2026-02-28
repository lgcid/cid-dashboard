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
- WhatsApp link sharing + PNG screenshot mode (`dom-to-image`)

## Project Paths

- App entry: `/Users/dagmar/Code/personal/cid-dashboard/app/page.tsx`
- API route: `/Users/dagmar/Code/personal/cid-dashboard/app/api/dashboard/route.ts`
- CSV data: `/Users/dagmar/Code/personal/cid-dashboard/data/csv`
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
- `/Users/dagmar/Code/personal/cid-dashboard/data/csv/sections/*.csv`
- `/Users/dagmar/Code/personal/cid-dashboard/data/csv/incidents.csv`

## Data Flow

1. Dashboard data is maintained in CSV files:
- `data/csv/sections/urban_management.csv`
- `data/csv/sections/public_safety.csv`
- `data/csv/sections/cleaning.csv`
- `data/csv/sections/social_services.csv`
- `data/csv/sections/parks.csv`
- `data/csv/sections/communications.csv`
- `data/csv/sections/c3_logged.csv`
- `data/csv/sections/c3_resolved.csv`
- `data/csv/incidents.csv`
2. CSV section files mirror spreadsheet sheets:
- one sheet per section with category names in column A and week columns in row 1
3. Week list always starts at `2025-08-01` and is derived from section-sheet week headers.
4. Dashboard reads local CSV exports by default.
5. Optional: switch to Google Sheets later by setting:

```bash
DATA_SOURCE=google_sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
GOOGLE_SHEET_ID=...
```

## API

### `GET /api/dashboard?weekStart=YYYY-MM-DD&windowWeeks=number`

`windowWeeks` is optional. When omitted, hotspot intelligence is cumulative across all loaded incident data.

Returns:
- week metadata (`weeks`) + section datasets (`sections`)
- hardcoded summary/trend weekly metrics derived from sections
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
