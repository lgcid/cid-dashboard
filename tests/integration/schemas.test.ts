import { describe, expect, it } from "vitest";
import { c3RequestRowSchema, incidentSchema } from "@/lib/schemas";

describe("schema normalization", () => {
  it("normalizes incident dates while preserving required text fields", () => {
    const incident = incidentSchema.parse({
      week_start: " 23/02/2026 ",
      incident_date: "24.02.2026",
      place: "Roeland Street",
      summary: "Reported incident",
      category: "Theft"
    });

    expect(incident).toEqual({
      week_start: "2026-02-23",
      incident_date: "2026-02-24",
      place: "Roeland Street",
      summary: "Reported incident",
      category: "Theft"
    });
  });

  it("turns blank optional incident dates into null", () => {
    const incident = incidentSchema.parse({
      week_start: "2026-02-23",
      incident_date: "   ",
      place: "Buitenkant Street",
      summary: "No incident date supplied",
      category: "Patrol"
    });

    expect(incident.incident_date).toBeNull();
  });

  it("trims c3 request fields and coerces truthy resolved aliases", () => {
    const request = c3RequestRowSchema.parse({
      category: " Roads & Infrastructure ",
      reference_number: " REF-123 ",
      date_logged: " 23/02/2026 ",
      request_status: " Resolved ",
      resolved: " yes ",
      issue_description: " Blocked drain ",
      service: " Stormwater ",
      address: " 1 Main Road "
    });

    expect(request).toEqual({
      category: "Roads & Infrastructure",
      reference_number: "REF-123",
      date_logged: "23/02/2026",
      request_status: "Resolved",
      resolved: true,
      issue_description: "Blocked drain",
      service: "Stormwater",
      address: "1 Main Road"
    });
  });

  it("normalizes blank c3 request optionals to null", () => {
    const request = c3RequestRowSchema.parse({
      category: "Traffic",
      reference_number: "   ",
      date_logged: "",
      request_status: "   ",
      resolved: "",
      issue_description: "Signal outage",
      service: "Roads",
      address: "Adderley Street"
    });

    expect(request.reference_number).toBeNull();
    expect(request.date_logged).toBeNull();
    expect(request.request_status).toBeNull();
    expect(request.resolved).toBeNull();
  });
});
