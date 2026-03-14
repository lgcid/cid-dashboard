import { expect, test } from "@playwright/test";

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

test("dashboard renders and tab navigation works without client errors", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Weekly Operations Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();

  await page.getByRole("button", { name: "Current Week" }).click();
  await expect(page.getByRole("heading", { name: "Current Week" })).toBeVisible();

  await page.getByRole("button", { name: "Trends" }).click();
  await expect(page.getByRole("heading", { name: "Trends" })).toBeVisible();

  await page.getByRole("button", { name: "C3 Tracker" }).click();
  await expect(page.getByRole("heading", { name: "C3 Tracker" })).toBeVisible();
});

test("current week view updates when a historical reporting week is selected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Current Week" }).click();
  await page.getByLabel("Reporting week").selectOption("2026-02-23");

  const incidentsSection = page.locator("#incidents");

  await expect(incidentsSection.getByText("Roeland Street", { exact: true })).toBeVisible();
  await expect(incidentsSection.getByText("Buitenkant Street", { exact: true })).toBeVisible();
  await expect(incidentsSection.getByText("Scott Street", { exact: true })).toBeVisible();
});

test("trends view reflects a fixed range and monthly granularity", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Trends" }).click();
  await page.getByLabel("From").fill("2026-02-23");
  await page.getByLabel("To").fill("2026-03-02");
  await page.getByRole("button", { name: "Month" }).click();

  const trendsSection = page.locator("#trends");

  await expect(trendsSection).toContainText("Monthly results from 23 Feb 2026 to 02 Mar 2026");
  await expect(trendsSection).toContainText("4-month average");
  await expect(trendsSection.getByText("Public Safety Trend", { exact: true })).toBeVisible();
});

test("c3 tracker reflects a fixed date range and expected totals", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "C3 Tracker" }).click();
  await page.getByLabel("From").fill("2026-03-07");
  await page.getByLabel("To").fill("2026-03-10");

  await expect(page.getByText("07 Mar 2026 to 10 Mar 2026")).toBeVisible();
  await expect(page.locator("article", { hasText: "Total Logged" })).toContainText("10");
  await expect(page.locator("article", { hasText: "Resolved" })).toContainText("2");
  await expect(page.locator("article", { hasText: "Open Backlog" })).toContainText("8");
  await expect(page.locator("article", { hasText: "Resolution Rate" })).toContainText("20%");
});
