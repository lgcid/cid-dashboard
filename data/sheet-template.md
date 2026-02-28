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

- Cell `A1`: heading text (for example `Categories`)
- Row `1`, columns `B...`: week start dates (`YYYY-MM-DD`)
- Column `A`, rows `2...`: category names
- Data cells: numbers or blank

Example (`urban_management`):

| A                                   | B          |
|-------------------------------------|------------|
| Categories                          | 2025-08-01 |
| Accidents                           | 2          |
| Emergency, Medical and Assistance   | 0          |
| Pro-active Actions                  | 0          |
| Public Space Interventions          | 63         |

## Required row names for hardcoded Summary/Trends

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
- Weeks are discovered from section sheet headers (`>= 2025-08-01`)
- `record_status` is `REPORTED` if any section has a numeric value for that week
- Otherwise `record_status` is `NO_DATA_REPORTED`

## Security notes

- Keep the sheet link private.
- Give the dashboard service account read-only access.
- Never place the raw Google Sheet URL in frontend code.
