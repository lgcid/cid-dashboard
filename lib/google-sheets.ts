import { google } from "googleapis";

export interface GoogleSheetsEnv {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
  GOOGLE_SHEET_ID: string;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

export function readGoogleSheetsEnv(): GoogleSheetsEnv | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !sheetId) {
    return null;
  }

  return {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: email,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: normalizePrivateKey(key),
    GOOGLE_SHEET_ID: sheetId
  };
}

export async function fetchSheetRows(range: string): Promise<string[][]> {
  const env = readGoogleSheetsEnv();
  if (!env) {
    throw new Error("Missing Google Sheets environment configuration.");
  }

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE"
  });

  return (response.data.values ?? []) as string[][];
}
