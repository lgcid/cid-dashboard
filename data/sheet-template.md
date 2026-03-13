# Google Sheet Template Specification

This dashboard now reads **one spreadsheet sheet per section**.

## Required sheets

1. `urban_management`
2. `public_safety`
3. `law_enforcement`
4. `cleaning`
5. `social_services`
6. `parks`
7. `control_room_engagement`
8. `c3_requests`
9. `incidents`

## Section sheet format (all sheets except `c3_requests` and `incidents`)

- Cell `A1`: `week_start`
- Row `1`, columns `B...`: category / stat names
- Column `A`, rows `2...`: week start dates (`YYYY-MM-DD`)
- Data cells: numbers or blank

Example (`urban_management`):

| A          | B                        | C                               | D                 | E                 |
|------------|--------------------------|---------------------------------|-------------------|-------------------|
| week_start | Motor Vehicle Accidents  | Emergency, Medical and Assistance | Pro-active Actions | By-law management |
| 2025-08-01 | 2                        | 0                               | 0                 | 1                 |
| 2025-08-08 | 1                        | 1                               | 2                 | 0                 |

## Required column names for hardcoded Summary/Trends

### `public_safety`

- `Criminal Incidents`
- `Arrests Made`
- `Stop and Search`
- `Public Space Interventions`

### `law_enforcement`

- `Section 56 Notices`
- `Section 341 Notices`
- `Fines Issued` is derived in the dashboard: `Section 56 Notices + Section 341 Notices` (do not add as a source row)

### `cleaning`

- `Bags Filled and Collected`
- `Servitudes Cleaned`
- `Stormwater Drains Cleaned`
- `Stormwater Bags Filled`

### `social_services`

- `Incidents`
- `Client Follow ups`
- `Individual Engagements`
- `Support Sessions`
- `ID Applications`
- `Successful ID Applications`
- `Referred Clients to Shelters`
- `Work Readiness Bags Collected` (excluded from touch-point totals)
- `Successful ID Applications` (excluded from touch-point totals)

### `control_room_engagement`

- `Calls Received`
- `WhatsApps Received`

### `parks`

- `Pruned Trees` (optional, shown on Summary + Current Week)

## `c3_requests` sheet format

Columns (in order):

1. `category`
2. `reference_number`
3. `date_logged`
4. `request_status`
5. `resolved`
6. `issue_description`
7. `service`
8. `address`

Notes:

- `date_logged` should be a day value such as `2026-03-03` or `03/03/2026`.
- Summary, Current Week, and Trends derive weekly **logged** counts from `date_logged`.
- `request_status` tracks the City of Cape Town request workflow (`New`, `Registered`, `Assigned`, `In Progress`, `Closed`, `Completed`, `Service request completed`).
- The `resolved` column is a CID-managed field and is the only source used for **currently resolved** counts in the dashboard.
- For the initial seed only, existing rows can be marked resolved when `request_status` is an end state (`Closed`, `Completed`, or `Service request completed`).

## `incidents` sheet format

Columns (in order):

1. `week_start` (`YYYY-MM-DD`)
2. `incident_date` (`YYYY-MM-DD` or empty)
3. `place` (text)
4. `summary` (text)
5. `category` (text; use commas to render multiple tags in the UI)

## Local CSV file layout

The local CSV mode mirrors spreadsheet sheets:

- `data/csv/sections/urban_management.csv`
- `data/csv/sections/public_safety.csv`
- `data/csv/sections/law_enforcement.csv`
- `data/csv/sections/cleaning.csv`
- `data/csv/sections/social_services.csv`
- `data/csv/sections/parks.csv`
- `data/csv/sections/control_room_engagement.csv`
- `data/csv/sections/c3_requests.csv`
- `data/csv/incidents.csv`

## Week logic

- Week list always starts at `2025-08-01`
- Weeks are discovered from the weekly matrix sheet rows in column `A` (`>= 2025-08-01`); `c3_requests` does not create reporting weeks
- `record_status` is `REPORTED` if any weekly matrix section has a numeric value for that week
- Otherwise `record_status` is `NO_DATA_REPORTED`

## Extending data

- Add a new stat by adding a new column (new header in row `1`); it will be read automatically and shown in section-based views such as the `Current Week` tab.
- Add a new reporting week by adding a new row with `week_start` in column `A`; it will automatically be included in week selection, trends, and dashboard calculations.

## Security notes

- Keep the sheet link private.
- Give the dashboard service account read-only access.
- Never place the raw Google Sheet URL in frontend code.
