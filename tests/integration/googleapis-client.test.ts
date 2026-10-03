import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { google } from "googleapis";

describe("googleapis client", () => {
  it("still exposes the Sheets v4 values reader used by the dashboard", () => {
    const sheets = google.sheets({ version: "v4" });

    expect(typeof sheets.spreadsheets.values.get).toBe("function");
  });

  it("requests and parses Sheet values with the real client", async () => {
    const requests: URL[] = [];
    const server = createServer((request, response) => {
      requests.push(new URL(request.url ?? "/", "http://localhost"));
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ values: [["week_start", "value"], ["2026-02-23", 5]] }));
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();

    try {
      if (!address || typeof address === "string") {
        throw new Error("Sheet test server did not receive a port");
      }

      const sheets = google.sheets({ version: "v4" });
      const result = await sheets.spreadsheets.values.get(
        {
          spreadsheetId: "sheet-123",
          range: "public_safety!A1:B2",
          valueRenderOption: "UNFORMATTED_VALUE"
        },
        { rootUrl: `http://127.0.0.1:${address.port}` }
      );

      expect(result.data.values).toEqual([["week_start", "value"], ["2026-02-23", 5]]);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.pathname).toBe("/v4/spreadsheets/sheet-123/values/public_safety%21A1%3AB2");
      expect(requests[0]?.searchParams.get("valueRenderOption")).toBe("UNFORMATTED_VALUE");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
