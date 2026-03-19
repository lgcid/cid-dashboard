import { expect, test, type Page } from "@playwright/test";

function visibleReportingWeekSelect(page: Page) {
  return page.locator("#dashboard-reporting-week, #dashboard-reporting-week-mobile").filter({ visible: true });
}

test("dashboard API serves fixed local CSV data for a historical week", async ({ request }) => {
  const response = await request.get("/api/dashboard?weekStart=2026-02-23");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();

  expect(payload.meta.data_source).toBe("local_csv");
  expect(payload.meta.selected_week_start).toBe("2026-02-23");
  expect(payload.current_week.week_start).toBe("2026-02-23");
  expect(payload.current_week.metrics.criminal_incidents).toBe(5);
  expect(payload.current_week.metrics.section56_notices).toBe(5);
  expect(payload.current_week.metrics.section341_notices).toBe(47);
  expect(payload.current_week.metrics.c3_logged_total).toBe(18);
  expect(
    payload.incidents.filter((incident: { week_start: string }) => incident.week_start === "2026-02-23")
  ).toHaveLength(5);
});

test("preview query exposes one unpublished week in the API response", async ({ request }) => {
  const response = await request.get("/api/dashboard?preview=2026-03-10");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();

  expect(payload.meta.available_weeks.at(-1)).toBe("2026-03-09");
  expect(payload.meta.reporting_window_end).toBe("2026-03-15");
  expect(payload.current_week.week_start).toBe("2026-03-09");
  expect(payload.current_week.metrics.criminal_incidents).toBe(6);
  expect(payload.current_week.metrics.c3_logged_total).toBe(1);
});

test("dashboard renders and tab navigation works without client errors", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Weekly Operations Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Summary", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Current Week" }).click();
  await expect(page.getByRole("heading", { name: "Current Week", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public Safety", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cleaning & Maintenance", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Social Services", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parks & Recreation", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Law Enforcement", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Urban Management Incidents", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control Room Engagement", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "C3 Logged Requests", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Criminal Incidents by Location", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hotspot Intelligence/, level: 4 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Incident Log/, level: 4 })).toBeVisible();

  await page.getByRole("button", { name: "Trends" }).click();
  await expect(page.getByRole("heading", { name: "Trends", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public Safety Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cleaning & Maintenance Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Social Services Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parks & Recreation Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Law Enforcement Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Urban Management Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control Room Engagement Trend", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CoCT C3 Logged Requests Trend", level: 3 })).toBeVisible();

  await page.getByRole("button", { name: "C3 Tracker" }).click();
  await expect(page.getByRole("heading", { name: "C3 Tracker", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Logged vs Resolved by Category", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Backlog by Category", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pressure Points", level: 3 })).toBeVisible();
});

test("current week view updates when a historical reporting week is selected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Current Week" }).click();
  await visibleReportingWeekSelect(page).selectOption("2026-02-23");

  const incidentsSection = page.locator("#incidents");

  await expect(incidentsSection.getByText("Roeland Street", { exact: true })).toBeVisible();
  await expect(incidentsSection.getByText("Buitenkant Street", { exact: true })).toBeVisible();
  await expect(incidentsSection.getByText("Scott Street", { exact: true })).toBeVisible();
});

test("preview query makes the unpublished latest week visible in the dashboard", async ({ page }) => {
  await page.goto("/?preview=2026-03-10");
  await page.getByRole("button", { name: "Current Week" }).click();

  await expect(visibleReportingWeekSelect(page)).toHaveValue("2026-03-09");

  const incidentsSection = page.locator("#incidents");

  await expect(incidentsSection.getByText("Hope Street", { exact: true })).toBeVisible();
  await expect(incidentsSection).toContainText("09 Mar 2026 to 15 Mar 2026");
});

test("trends view reflects a fixed range and monthly granularity", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Trends" }).click();
  await page.locator("#trends-from-date").fill("2026-02-23");
  await page.locator("#trends-to-date").fill("2026-03-02");
  await page.getByRole("button", { name: "Month" }).click();

  const trendsSection = page.locator("#trends");

  await expect(page.getByText("Monthly results from 23 Feb 2026 to 02 Mar 2026", { exact: false })).toBeVisible();
  await expect(trendsSection).toContainText("4-month average");
  await expect(trendsSection.getByText("Public Safety Trend", { exact: true })).toBeVisible();
});

test("c3 tracker reflects a fixed date range and expected totals", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "C3 Tracker" }).click();
  await page.locator("#c3-from-date").fill("2026-03-07");
  await page.locator("#c3-to-date").fill("2026-03-10");

  await expect(page.getByText("07 Mar 2026 to 08 Mar 2026.", { exact: true })).toBeVisible();
  await expect(page.locator("article", { hasText: "Total Logged" })).toContainText("9");
  await expect(page.locator("article", { hasText: "Resolved" })).toContainText("2");
  await expect(page.locator("article", { hasText: "Open Backlog" })).toContainText("7");
  await expect(page.locator("article", { hasText: "Resolution Rate" })).toContainText("22%");
});

test("summary export downloads and chart surfaces render SVG output", async ({ page }) => {
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^lgcid-summary-.*\.png$/);

  await page.getByRole("button", { name: "Trends" }).click();
  await page.locator("#trends-from-date").fill("2026-02-23");
  await page.locator("#trends-to-date").fill("2026-03-02");

  const trendSvgs = page.locator("#trends .recharts-responsive-container svg");
  const trendCurves = page.locator("#trends .recharts-line-curve");

  await expect(trendSvgs.first()).toBeVisible();
  expect(await trendCurves.count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "C3 Tracker" }).click();

  const c3Svgs = page.locator("#c3 .recharts-responsive-container svg");
  const c3Bars = page.locator("#c3 .recharts-bar-rectangle");

  await expect(c3Svgs.first()).toBeVisible();
  expect(await c3Bars.count()).toBeGreaterThan(0);
});

test("interactive dashboard buttons expose the pointer cursor", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Current Week" })).toHaveCSS("cursor", "pointer");
  await expect(page.getByRole("button", { name: "Print" })).toHaveCSS("cursor", "pointer");

  await page.getByRole("button", { name: "Trends" }).click();

  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveCSS("cursor", "pointer");
  await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveCSS("cursor", "pointer");
  await expect(page.getByRole("button", { name: "Year", exact: true })).toHaveCSS("cursor", "pointer");
});
