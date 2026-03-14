import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGoogleAuth,
  mockHeaders,
  mockSheetsFactory,
  mockValuesGet
} = vi.hoisted(() => ({
  mockGoogleAuth: vi.fn(),
  mockHeaders: vi.fn(),
  mockSheetsFactory: vi.fn(),
  mockValuesGet: vi.fn()
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: mockGoogleAuth
}));

vi.mock("googleapis", () => ({
  google: {
    sheets: mockSheetsFactory
  }
}));

const ENV_KEYS = [
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

describe("google sheets integration boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    restoreEnv();

    mockGoogleAuth.mockImplementation(function GoogleAuthMock() {
      return { kind: "google-auth-client" };
    });
    mockSheetsFactory.mockReturnValue({
      spreadsheets: {
        values: {
          get: mockValuesGet
        }
      }
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("normalizes provider config, creates auth, and fetches sheet rows", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "reader@example.com";
    process.env.GOOGLE_SHEET_ID = "sheet-123";
    process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER =
      "projects/123456789/locations/global/workloadIdentityPools/vercel/providers/dashboard";
    delete process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE;
    delete process.env.VERCEL_OIDC_TOKEN;

    mockHeaders.mockResolvedValue(new Headers([["x-vercel-oidc-token", "oidc-token-from-header"]]));
    mockValuesGet.mockResolvedValue({
      data: {
        values: [["week_start", "value"], ["2026-02-23", 5]]
      }
    });

    const { fetchSheetRows, readGoogleSheetsEnv } = await import("@/lib/google-sheets");
    const env = readGoogleSheetsEnv();
    const rows = await fetchSheetRows("public_safety!A1:ZZ5000");

    expect(env).toEqual({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "reader@example.com",
      GOOGLE_SHEET_ID: "sheet-123",
      GOOGLE_WORKLOAD_IDENTITY_AUDIENCE:
        "//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel/providers/dashboard"
    });
    expect(rows).toEqual([["week_start", "value"], ["2026-02-23", 5]]);
    expect(mockGoogleAuth).toHaveBeenCalledTimes(1);

    const authOptions = mockGoogleAuth.mock.calls[0]?.[0];
    expect(authOptions).toMatchObject({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      credentials: {
        type: "external_account",
        audience:
          "//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel/providers/dashboard",
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        token_url: "https://sts.googleapis.com/v1/token",
        service_account_impersonation_url:
          "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/reader%40example.com:generateAccessToken"
      }
    });
    expect(await authOptions.credentials.subject_token_supplier.getSubjectToken()).toBe("oidc-token-from-header");
    expect(mockSheetsFactory).toHaveBeenCalledWith({
      version: "v4",
      auth: { kind: "google-auth-client" }
    });
    expect(mockValuesGet).toHaveBeenCalledWith({
      spreadsheetId: "sheet-123",
      range: "public_safety!A1:ZZ5000",
      valueRenderOption: "UNFORMATTED_VALUE"
    });
  });

  it("throws the existing configuration error when required env vars are missing", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SHEET_ID;
    delete process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE;
    delete process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER;

    const { fetchSheetRows } = await import("@/lib/google-sheets");

    await expect(fetchSheetRows("public_safety!A1:ZZ5000")).rejects.toThrow(
      "Missing Google Sheets environment configuration. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SHEET_ID, and GOOGLE_WORKLOAD_IDENTITY_AUDIENCE or GOOGLE_WORKLOAD_IDENTITY_PROVIDER."
    );
  });
});
