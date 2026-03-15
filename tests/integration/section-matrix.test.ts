import { describe, expect, it } from "vitest";
import { parseSectionMatrix } from "@/lib/section-matrix";

describe("section matrix shape", () => {
  it("parses week headers from row 1 and categories from column A", () => {
    const section = parseSectionMatrix(
      [
        ["", "2026-03-02", "2026-02-23"],
        ["Criminal Incidents", "0", "5"],
        ["Arrests Made", "1", "3"]
      ],
      "public_safety"
    );

    expect(section).toEqual({
      key: "public_safety",
      heading: "Categories",
      categories: [
        {
          category: "Criminal Incidents",
          values: {
            "2026-03-02": 0,
            "2026-02-23": 5
          }
        },
        {
          category: "Arrests Made",
          values: {
            "2026-03-02": 1,
            "2026-02-23": 3
          }
        }
      ]
    });
  });

  it("rejects the legacy week-down-column matrix shape", () => {
    expect(() =>
      parseSectionMatrix(
        [
          ["week_start", "Criminal Incidents", "Arrests Made"],
          ["2026-03-02", "0", "1"],
          ["2026-02-23", "5", "3"]
        ],
        "public_safety"
      )
    ).toThrow(
      'Section "public_safety" must use week headers in row 1 (B1 onward) and category labels in column A (A2 downward).'
    );
  });
});
