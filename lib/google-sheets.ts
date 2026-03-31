import { headers } from "next/headers";
import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_STS_TOKEN_URL = "https://sts.googleapis.com/v1/token";
const VERCEL_OIDC_HEADER = "x-vercel-oidc-token";

export interface GoogleSheetsEnv {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SHEET_ID: string;
  GOOGLE_WORKLOAD_IDENTITY_AUDIENCE: string;
}

type HeaderReader = {
  get(name: string): string | null;
};

function normalizeWorkloadIdentityAudience(audienceOrProvider: string): string {
  const normalized = audienceOrProvider.trim();
  if (!normalized) {
    return normalized;
  }
  if (normalized.startsWith("//iam.googleapis.com/")) {
    return normalized;
  }
  if (normalized.startsWith("projects/")) {
    return `//iam.googleapis.com/${normalized}`;
  }
  return normalized;
}

export function readGoogleSheetsEnv(): GoogleSheetsEnv | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  const workloadIdentityAudience = process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE?.trim();
  const workloadIdentityProvider = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER?.trim();
  const audience = workloadIdentityAudience ?? workloadIdentityProvider;

  if (!email || !sheetId || !audience) {
    return null;
  }

  return {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: email,
    GOOGLE_SHEET_ID: sheetId,
    GOOGLE_WORKLOAD_IDENTITY_AUDIENCE: normalizeWorkloadIdentityAudience(audience)
  };
}

function readVercelOidcTokenFromEnv(): string | null {
  const envToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  return null;
}

export function readVercelOidcTokenFromRequestHeaders(requestHeaders: HeaderReader): string | null {
  const headerToken = requestHeaders.get(VERCEL_OIDC_HEADER)?.trim();
  if (headerToken) {
    return headerToken;
  }

  return null;
}

async function resolveVercelOidcToken(vercelOidcToken?: string): Promise<string | null> {
  if (vercelOidcToken?.trim()) {
    return vercelOidcToken.trim();
  }

  const envToken = readVercelOidcTokenFromEnv();
  if (envToken) {
    return envToken;
  }

  try {
    const requestHeaders = await headers();
    return readVercelOidcTokenFromRequestHeaders(requestHeaders);
  } catch {
    return null;
  }
}

function buildServiceAccountImpersonationUrl(email: string): string {
  return `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(email)}:generateAccessToken`;
}

async function createSheetsAuth(env: GoogleSheetsEnv, vercelOidcToken?: string): Promise<GoogleAuth> {
  const resolvedVercelOidcToken = await resolveVercelOidcToken(vercelOidcToken);
  if (!resolvedVercelOidcToken) {
    throw new Error(
      "Missing Vercel OIDC token for Google Sheets access. On Vercel this should be provided in the request context. For local development, set VERCEL_OIDC_TOKEN or use DATA_SOURCE=local_csv."
    );
  }

  const auth = new GoogleAuth({
    credentials: {
      type: "external_account",
      audience: env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      token_url: GOOGLE_STS_TOKEN_URL,
      service_account_impersonation_url: buildServiceAccountImpersonationUrl(env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
      subject_token_supplier: {
        getSubjectToken: async () => resolvedVercelOidcToken
      }
    },
    scopes: [SHEETS_READONLY_SCOPE]
  });

  return auth;
}

export async function fetchSheetRows(range: string, options: { vercelOidcToken?: string } = {}): Promise<string[][]> {
  const env = readGoogleSheetsEnv();
  if (!env) {
    throw new Error(
      "Missing Google Sheets environment configuration. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SHEET_ID, and GOOGLE_WORKLOAD_IDENTITY_AUDIENCE or GOOGLE_WORKLOAD_IDENTITY_PROVIDER."
    );
  }

  const auth = await createSheetsAuth(env, options.vercelOidcToken);
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE"
  });

  return (response.data.values ?? []) as string[][];
}
