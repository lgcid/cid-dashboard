# Google Sheet Template Specification

This dashboard expects **two tabs** in one Google Sheet.

## Tab 1: `weekly_metrics`

### Required columns (in order)

1. `week_start` (`YYYY-MM-DD`)
2. `week_end` (`YYYY-MM-DD`)
3. `week_label` (text)
4. `record_status` (`REPORTED` or `NO_DATA_REPORTED`)
5. `urban_total` (number)
6. `criminal_incidents` (number)
7. `arrests_made` (number)
8. `proactive_actions` (number)
9. `cleaning_bags_collected` (number)
10. `social_shelter_referrals` (number)
11. `social_work_readiness_bags` (number)
12. `c3_logged_total` (number)
13. `c3_resolved_total` (number)
14. `c3_logged_roads_and_infrastructure` (number)
15. `c3_resolved_roads_and_infrastructure` (number)
16. `c3_logged_water_and_sanitation` (number)
17. `c3_resolved_water_and_sanitation` (number)
18. `c3_logged_electricity` (number)
19. `c3_resolved_electricity` (number)
20. `c3_logged_parks_and_recreation` (number)
21. `c3_resolved_parks_and_recreation` (number)
22. `c3_logged_waste_management` (number)
23. `c3_resolved_waste_management` (number)
24. `c3_logged_environmental_health` (number)
25. `c3_resolved_environmental_health` (number)
26. `c3_logged_law_enforcement` (number)
27. `c3_resolved_law_enforcement` (number)
28. `c3_logged_traffic` (number)
29. `c3_resolved_traffic` (number)
30. `calls_received` (number)
31. `whatsapps_received` (number)

## Tab 2: `incidents`

### Required columns (in order)

1. `week_start` (`YYYY-MM-DD`)
2. `incident_date` (`YYYY-MM-DD` or empty)
3. `place` (text)
4. `summary` (text)
5. `category` (text)

## CSV Import Workflow

1. Import `/Users/dagmar/Code/personal/cid-dashboard/data/exports/weekly_metrics.csv` into tab `weekly_metrics`.
2. Import `/Users/dagmar/Code/personal/cid-dashboard/data/exports/incidents.csv` into tab `incidents`.
3. Keep header row names unchanged.

## Security Notes

- Keep the sheet link private.
- Give the dashboard service account **read-only** access.
- Never place the raw Google Sheet URL in frontend code.
