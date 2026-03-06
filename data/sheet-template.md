# Google Sheet Template Specification

This dashboard now reads **one spreadsheet sheet per section**.

## Required sheets

1. `urban_management`
2. `public_safety`
3. `cleaning`
4. `social_services`
5. `parks`
6. `communications`
7. `c3_logged`
8. `c3_resolved`
9. `incidents`

## Section sheet format (all sheets except `incidents`)

- Cell `A1`: `week_start`
- Row `1`, columns `B...`: category / stat names
- Column `A`, rows `2...`: week start dates (`YYYY-MM-DD`)
- Data cells: numbers or blank

Example (`urban_management`):

| A          | B         | C                               | D                 | E                           |
|------------|-----------|---------------------------------|-------------------|-----------------------------|
| week_start | Accidents | Emergency, Medical and Assistance | Pro-active Actions | Public Space Interventions |
| 2025-08-01 | 2         | 0                               | 0                 | 63                          |
| 2025-08-08 | 1         | 1                               | 2                 | 54                          |

## Required column names for hardcoded Summary/Trends

### `public_safety`

- `Criminal Incidents`
- `Arrests Made`
- `Section 56 Notices`
- `Section 341 Notices`
- `Pro-active Actions`

### `cleaning`

- `Bags Filled and Collected`
- `Servitudes Cleaned`
- `Stormwater Drains Cleaned`
- `Stormwater Bags Filled`

### `communications`

- `Calls Received`
- `WhatsApps Received`

## `incidents` sheet format

Columns (in order):

1. `week_start` (`YYYY-MM-DD`)
2. `incident_date` (`YYYY-MM-DD` or empty)
3. `place` (text)
4. `summary` (text)
5. `category` (text)

## Local CSV file layout

The local CSV mode mirrors spreadsheet sheets:

- `data/csv/sections/urban_management.csv`
- `data/csv/sections/public_safety.csv`
- `data/csv/sections/cleaning.csv`
- `data/csv/sections/social_services.csv`
- `data/csv/sections/parks.csv`
- `data/csv/sections/communications.csv`
- `data/csv/sections/c3_logged.csv`
- `data/csv/sections/c3_resolved.csv`
- `data/csv/incidents.csv`

## Week logic

- Week list always starts at `2025-08-01`
- Weeks are discovered from section sheet rows in column `A` (`>= 2025-08-01`)
- `record_status` is `REPORTED` if any section has a numeric value for that week
- Otherwise `record_status` is `NO_DATA_REPORTED`

## Extending data

- Add a new stat by adding a new column (new header in row `1`); it will be read automatically and shown in section-based views such as the `Current Week` tab.
- Add a new reporting week by adding a new row with `week_start` in column `A`; it will automatically be included in week selection, trends, and dashboard calculations.

## Security notes

- Keep the sheet link private.
- Give the dashboard service account read-only access.
- Never place the raw Google Sheet URL in frontend code.
