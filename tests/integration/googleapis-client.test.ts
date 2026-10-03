import { describe, expect, it } from "vitest";
import { google } from "googleapis";

describe("googleapis client", () => {
  it("still exposes the Sheets v4 values reader used by the dashboard", () => {
    const sheets = google.sheets({ version: "v4" });

    expect(typeof sheets.spreadsheets.values.get).toBe("function");
  });
});
