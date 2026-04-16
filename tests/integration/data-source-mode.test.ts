import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchSheetRows = vi.fn();
const readGoogleSheetsEnv = vi.fn();

vi.mock("@/lib/google-sheets", () => ({
  fetchSheetRows,
  readGoogleSheetsEnv
}));

const ENV_KEYS = [
  "DATA_SOURCE",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SHEET_ID",
  "GOOGLE_WORKLOAD_IDENTITY_AUDIENCE",
  "GOOGLE_WORKLOAD_IDENTITY_PROVIDER",
  "VERCEL_OIDC_TOKEN"
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

describe("data source mode selection", () => {
  beforeEach(() => {
    vi.resetModules();
    restoreEnv();
    delete process.env.DATA_SOURCE;
    fetchSheetRows.mockReset();
    readGoogleSheetsEnv.mockReset();
  });

  afterEach(() => {
    restoreEnv();
    vi.clearAllMocks();
  });

  it("uses local CSV when DATA_SOURCE is not set", async () => {
    readGoogleSheetsEnv.mockReturnValue(null);

    const { loadData } = await import("@/lib/data-source");
    const data = await loadData();

    expect(data.source).toBe("local_csv");
    expect(fetchSheetRows).not.toHaveBeenCalled();
  });

  it("fails instead of falling back to CSV when DATA_SOURCE=google_sheets and sheet loading fails", async () => {
    process.env.DATA_SOURCE = "google_sheets";
    readGoogleSheetsEnv.mockReturnValue({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service-account@example.com",
      GOOGLE_SHEET_ID: "sheet-123",
      GOOGLE_WORKLOAD_IDENTITY_AUDIENCE: "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider"
    });
    fetchSheetRows.mockRejectedValue(new Error("Sheet load failed"));

    const { loadData } = await import("@/lib/data-source");

    await expect(loadData()).rejects.toThrow("Sheet load failed");
    expect(fetchSheetRows).toHaveBeenCalled();
  });

  it("shows a configuration error instead of falling back to CSV when DATA_SOURCE=google_sheets and Sheets config is missing", async () => {
    process.env.DATA_SOURCE = "google_sheets";
    readGoogleSheetsEnv.mockReturnValue(null);

    const { loadData } = await import("@/lib/data-source");

    await expect(loadData()).rejects.toThrow(
      "DATA_SOURCE is set to google_sheets, but the Google Sheets authentication environment variables are incomplete."
    );
    expect(fetchSheetRows).not.toHaveBeenCalled();
  });

  it("still uses local CSV when CSV mode is explicitly requested", async () => {
    process.env.DATA_SOURCE = "local_csv";
    readGoogleSheetsEnv.mockReturnValue({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "service-account@example.com",
      GOOGLE_SHEET_ID: "sheet-123",
      GOOGLE_WORKLOAD_IDENTITY_AUDIENCE: "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider"
    });

    const { loadData } = await import("@/lib/data-source");
    const data = await loadData();

    expect(data.source).toBe("local_csv");
    expect(fetchSheetRows).not.toHaveBeenCalled();
  });
});
