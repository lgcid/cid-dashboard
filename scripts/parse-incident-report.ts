#!/usr/bin/env node
// @ts-nocheck

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPORTING_WINDOW_START = "2025-08-01";
const REPORTING_WINDOW_END = "2026-02-22";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const INPUT_FILE = path.join(ROOT, "LGCID Incident Report.txt");
const OUTPUT_DIR = path.join(ROOT, "data", "exports");

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};

const C3_DEPARTMENTS = [
  ["roads_and_infrastructure", "Roads and Infrastructure"],
  ["water_and_sanitation", "Water and Sanitation"],
  ["electricity", "Electricity"],
  ["parks_and_recreation", "Parks and Recreation"],
  ["waste_management", "Waste Management"],
  ["environmental_health", "Environmental Health"],
  ["law_enforcement", "Law Enforcement"],
  ["traffic", "Traffic"]
];

const WEEKLY_HEADERS = [
  "week_start",
  "week_end",
  "week_label",
  "record_status",
  "urban_total",
  "urban_accidents",
  "urban_emergency_medical_assistance",
  "urban_public_safety_and_security",
  "urban_public_space_interventions",
  "criminal_incidents",
  "arrests_made",
  "section56_notices",
  "section341_notices",
  "proactive_actions",
  "cleaning_bags_collected",
  "cleaning_servitudes_cleaned",
  "cleaning_stormwater_drains_cleaned",
  "cleaning_stormwater_bags_filled",
  "social_incidents",
  "social_client_follow_ups",
  "social_successful_id_applications",
  "social_shelter_referrals",
  "social_work_readiness_bags",
  "parks_jutland_park_bags",
  "parks_maynard_park_bags",
  "parks_tuin_plein_bags",
  "parks_gordon_street_verge_bags",
  "parks_wembley_square_verge_bags",
  "c3_logged_total",
  "c3_resolved_total",
  "c3_logged_roads_and_infrastructure",
  "c3_resolved_roads_and_infrastructure",
  "c3_logged_water_and_sanitation",
  "c3_resolved_water_and_sanitation",
  "c3_logged_electricity",
  "c3_resolved_electricity",
  "c3_logged_parks_and_recreation",
  "c3_resolved_parks_and_recreation",
  "c3_logged_waste_management",
  "c3_resolved_waste_management",
  "c3_logged_environmental_health",
  "c3_resolved_environmental_health",
  "c3_logged_law_enforcement",
  "c3_resolved_law_enforcement",
  "c3_logged_traffic",
  "c3_resolved_traffic",
  "calls_received",
  "whatsapps_received"
];

const INCIDENT_HEADERS = [
  "week_start",
  "incident_date",
  "place_raw",
  "place_normalized",
  "summary",
  "category"
];

const AUDIT_HEADERS = [
  "kind",
  "source_type",
  "source_index",
  "source_range",
  "week_start",
  "week_end",
  "dedupe_key",
  "kept",
  "note"
];

function toCsv(rows, headers) {
  if (!rows.length) {
    return `${headers.join(",")}\n`;
  }
  const esc = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => esc(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function cleanText(raw) {
  let text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const commentTail = text.search(/^\[[a-z]\]/im);
  if (commentTail !== -1) {
    text = text.slice(0, commentTail);
  }
  return text;
}

function monthToIndex(name) {
  return MONTHS[name.toLowerCase()] ?? null;
}

function parseRangePart(part, fallbackYear = null, fallbackMonth = null) {
  const cleaned = part
    .trim()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ");

  const match = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?(?:\s+([A-Za-z]+))?(?:\s+(\d{4}))?$/i);
  if (!match) {
    throw new Error(`Cannot parse range part: ${part}`);
  }

  const day = Number(match[1]);
  const month = match[2] ? monthToIndex(match[2]) : fallbackMonth;
  const year = match[3] ? Number(match[3]) : fallbackYear;

  if (!month || !year) {
    throw new Error(`Missing month/year in part: ${part}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function parseWeekRange(raw, block) {
  const cleaned = raw
    .replace(/\[[^\]]*\]/g, "")
    .replace(/Public Safety/gi, "")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  const blockDateMatch = block.match(/Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const fallbackYear = blockDateMatch ? Number(blockDateMatch[3]) : 2025;

  const toPattern = cleaned.match(
    /(\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?(?:\s+[A-Za-z]+)?(?:\s+\d{4})?)\s+to(?:\s+the)?\s+(\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?(?:\s+[A-Za-z]+)?(?:\s+\d{4})?)/i
  );

  if (toPattern) {
    const end = parseRangePart(toPattern[2], fallbackYear, null);
    const start = parseRangePart(toPattern[1], end.getUTCFullYear(), end.getUTCMonth() + 1);
    if (start > end) {
      if (!/[A-Za-z]/.test(toPattern[1])) {
        start.setUTCMonth(start.getUTCMonth() - 1);
      } else {
        start.setUTCFullYear(start.getUTCFullYear() - 1);
      }
    }
    return { start, end };
  }

  const sameMonthPattern = cleaned.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s*-\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?$/i
  );

  if (sameMonthPattern) {
    const month = monthToIndex(sameMonthPattern[3]);
    const year = Number(sameMonthPattern[4] ?? fallbackYear);
    const start = new Date(Date.UTC(year, month - 1, Number(sameMonthPattern[1])));
    const end = new Date(Date.UTC(year, month - 1, Number(sameMonthPattern[2])));
    return { start, end };
  }

  const crossMonthPattern = cleaned.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*-\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?$/i
  );

  if (crossMonthPattern) {
    const year = Number(crossMonthPattern[5] ?? fallbackYear);
    const startMonth = monthToIndex(crossMonthPattern[2]);
    const endMonth = monthToIndex(crossMonthPattern[4]);
    const start = new Date(Date.UTC(year, startMonth - 1, Number(crossMonthPattern[1])));
    const end = new Date(Date.UTC(year, endMonth - 1, Number(crossMonthPattern[3])));

    if (start > end) {
      start.setUTCFullYear(start.getUTCFullYear() - 1);
    }
    return { start, end };
  }

  throw new Error(`Could not parse week range: ${raw}`);
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function dateAddDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function formatWeekLabel(startIso, endIso) {
  return `${startIso} to ${endIso}`;
}

function emptyWeeklyRow(weekStart, weekEnd, status = "REPORTED") {
  const row = {
    week_start: weekStart,
    week_end: weekEnd,
    week_label: formatWeekLabel(weekStart, weekEnd),
    record_status: status,
    urban_total: null,
    urban_accidents: null,
    urban_emergency_medical_assistance: null,
    urban_public_safety_and_security: null,
    urban_public_space_interventions: null,
    criminal_incidents: null,
    arrests_made: null,
    section56_notices: null,
    section341_notices: null,
    proactive_actions: null,
    cleaning_bags_collected: null,
    cleaning_servitudes_cleaned: null,
    cleaning_stormwater_drains_cleaned: null,
    cleaning_stormwater_bags_filled: null,
    social_incidents: null,
    social_client_follow_ups: null,
    social_successful_id_applications: null,
    social_shelter_referrals: null,
    social_work_readiness_bags: null,
    parks_jutland_park_bags: null,
    parks_maynard_park_bags: null,
    parks_tuin_plein_bags: null,
    parks_gordon_street_verge_bags: null,
    parks_wembley_square_verge_bags: null,
    c3_logged_total: null,
    c3_resolved_total: null,
    c3_logged_roads_and_infrastructure: null,
    c3_resolved_roads_and_infrastructure: null,
    c3_logged_water_and_sanitation: null,
    c3_resolved_water_and_sanitation: null,
    c3_logged_electricity: null,
    c3_resolved_electricity: null,
    c3_logged_parks_and_recreation: null,
    c3_resolved_parks_and_recreation: null,
    c3_logged_waste_management: null,
    c3_resolved_waste_management: null,
    c3_logged_environmental_health: null,
    c3_resolved_environmental_health: null,
    c3_logged_law_enforcement: null,
    c3_resolved_law_enforcement: null,
    c3_logged_traffic: null,
    c3_resolved_traffic: null,
    calls_received: null,
    whatsapps_received: null
  };

  return row;
}

function extractNumber(block, patterns) {
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (!match) {
      continue;
    }
    const value = match[1] ?? match[2] ?? null;
    if (value === null || value === undefined) {
      continue;
    }
    const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getSection(block, startRegex, endRegex) {
  const startMatch = block.match(startRegex);
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }
  const start = startMatch.index;
  const fromStart = block.slice(start);
  const endMatch = fromStart.match(endRegex);
  if (!endMatch || endMatch.index === undefined) {
    return fromStart;
  }
  return fromStart.slice(0, endMatch.index);
}

function parseC3Sections(block) {
  const loggedSection = getSection(block, /CoCT C3 \(service requests\) logged/i, /CoCT C3 resolved/i);
  const resolvedSection = getSection(
    block,
    /CoCT C3 resolved/i,
    /(Public Safety|Cleaning|Social Services|Parks and Recreation|Calls Received|Whatsapps Received|Your Eyes, Our Impact|Reporting of CRIME|Date:\s*\d{2}\/\d{2}\/\d{4}|$)/i
  );

  const values = {};

  let loggedSum = 0;
  let loggedCount = 0;
  let resolvedSum = 0;
  let resolvedCount = 0;

  for (const [slug, label] of C3_DEPARTMENTS) {
    const logged = extractNumber(loggedSection, [
      new RegExp(`${label}\\s*:\\s*(\\d+)\\s*request[s]?\\s*logged`, "i"),
      new RegExp(`${label}\\s*:\\s*(\\d+)\\b`, "i")
    ]);
    const resolved = extractNumber(resolvedSection, [
      new RegExp(`${label}\\s*:\\s*(\\d+)\\s*request[s]?\\s*resolved`, "i"),
      new RegExp(`${label}\\s*:\\s*(\\d+)\\b`, "i")
    ]);

    values[`c3_logged_${slug}`] = logged;
    values[`c3_resolved_${slug}`] = resolved;

    if (logged !== null) {
      loggedSum += logged;
      loggedCount += 1;
    }
    if (resolved !== null) {
      resolvedSum += resolved;
      resolvedCount += 1;
    }
  }

  const loggedTotal = extractNumber(loggedSection, [/\n\s*\*?\s*(\d+)\s*logged\b/i, /^\s*\*?\s*(\d+)\s*$/im]);
  const resolvedTotal = extractNumber(resolvedSection, [/\n\s*\*?\s*(\d+)\s*resolved\b/i, /^\s*\*?\s*(\d+)\s*$/im]);

  values.c3_logged_total = loggedTotal ?? (loggedCount ? loggedSum : null);
  values.c3_resolved_total = resolvedTotal ?? (resolvedCount ? resolvedSum : null);

  return values;
}

function parseMetrics(block, weekStart, weekEnd) {
  const row = emptyWeeklyRow(weekStart, weekEnd, "REPORTED");

  row.urban_total = extractNumber(block, [
    /\*\s*(\d+)\s+incidents reported/i,
    /\*\s*Incidents reported\s*\n\s*\*\s*(\d+)\s+incidents reported/i
  ]);
  row.urban_accidents = extractNumber(block, [
    /\*\s*Accidents?\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Accidents?\s*:\s*(\d+)/i,
    /\*\s*Motor vehicle accidents?\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Motor vehicle accidents?\s*:\s*(\d+)/i
  ]);
  row.urban_emergency_medical_assistance = extractNumber(block, [
    /\*\s*Emergency,\s*Medical and Assistance\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Emergency,\s*Medical and Assistance\s*:\s*(\d+)/i,
    /\*\s*Medical assistance\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Medical assistance\s*:\s*(\d+)/i
  ]);
  row.urban_public_safety_and_security = extractNumber(block, [
    /\*\s*Public Safety and Security(?:\s*\(by-laws\))?\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Public Safety and Security(?:\s*\(by-laws\))?\s*:\s*(\d+)/i
  ]);
  row.urban_public_space_interventions = extractNumber(block, [
    /\*\s*Public Space Interventions\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Public Space Interventions\s*:\s*(\d+)/i
  ]);
  row.criminal_incidents = extractNumber(block, [
    /\*\s*(?:Criminal Incidents|Criminal incidents)\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*(?:Criminal Incidents|Criminal incidents)\s*:\s*\*\s*(\d+)/i
  ]);
  row.arrests_made = extractNumber(block, [
    /\*\s*(?:Arrests Made|Arrests made)\s*:\s*\n\s*\*\s*(\d+)/i,
    /(\d+)\s+arrests?\s+have\s+been\s+made/i,
    /\*\s*(?:Arrests Made|Arrests made)\s*\n\s*\*\s*(\d+)/i
  ]);
  row.section56_notices = extractNumber(block, [
    /Section\s*56\s+notices[^\n:]*:\s*\n\s*\*\s*(\d+)/i,
    /Section\s*56\s+notices[^\n:]*:\s*(\d+)/i
  ]);
  row.section341_notices = extractNumber(block, [
    /Section\s*341\s+notices[^\n:]*:\s*\n\s*\*\s*(\d+)/i,
    /Section\s*341\s+notices[^\n:]*:\s*(\d+)/i
  ]);
  row.proactive_actions = extractNumber(block, [
    /\*\s*Pro-?active Actions\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Pro-?active Actions\s*:\s*(\d+)/i,
    /Pro-?active actions(?:\s*\([^\)]*\))?\s*:\s*(\d+)/i
  ]);
  row.cleaning_bags_collected = extractNumber(block, [
    /\*\s*Bags filled and collected\s*:\s*\n\s*\*\s*(\d+)\s*bags/i,
    /\*\s*Bags filled and collected\s*:\s*\*\s*(\d+)\s*bags/i,
    /\*\s*Bags filled and collected\s*:\s*\n\s*\*\s*(\d+)/i
  ]);
  row.cleaning_servitudes_cleaned = extractNumber(block, [
    /Servitudes cleaned\s*:\s*\n\s*\*\s*(\d+)/i,
    /Servitudes cleaned\s*:\s*(\d+)/i
  ]);
  row.cleaning_stormwater_drains_cleaned = extractNumber(block, [
    /Stormwater drains[\s\S]{0,100}?\*\s*Cleaned:\s*(\d+)/i,
    /Stormwater drains cleaned\s*:\s*\n\s*\*\s*(\d+)/i,
    /Stormwater drains cleaned\s*:\s*(\d+)/i
  ]);
  row.cleaning_stormwater_bags_filled = extractNumber(block, [
    /Stormwater drains[\s\S]{0,140}?\*\s*Bags filled:\s*(\d+)/i
  ]);
  row.social_incidents = extractNumber(block, [
    /Social Services[\s\S]{0,120}?\*\s*Incidents:\s*(\d+)/i,
    /\*\s*Incidents:\s*(\d+)\s*(?:\n|$)/i
  ]);
  row.social_client_follow_ups = extractNumber(block, [
    /Client follow ups\s*:\s*(\d+)/i,
    /Client follow-ups\s*:\s*(\d+)/i
  ]);
  row.social_successful_id_applications = extractNumber(block, [
    /Successful ID applications\s*:\s*(\d+)/i,
    /Successful ID applications\s*:\s*\n\s*\*\s*(\d+)/i
  ]);
  row.social_shelter_referrals = extractNumber(block, [
    /\*\s*Referred clients to SafeSpaces\/shelters\s*:\s*(\d+)/i,
    /\*\s*Referred clients to SafeSpaces\/shelters\s*:\s*\n\s*\*\s*(\d+)/i,
    /\*\s*Referred clients to SafeSpaces\/shelters\s*\n\s*\*\s*(\d+)/i,
    /Referred clients to SafeSpaces\/shelters\s*\n\s*\*\s*(\d+)/i
  ]);
  row.social_work_readiness_bags = extractNumber(block, [
    /\*\s*Work readiness programme\s*:[\s\S]{0,80}?\*\s*Bags collected\s*:\s*(\d+)\s*bags/i,
    /\*\s*Bags collected\s*:\s*(\d+)\s*bags/i
  ]);
  row.parks_jutland_park_bags = extractNumber(block, [
    /Jutland Park\s*:\s*(\d+)\s*bags?/i
  ]);
  row.parks_maynard_park_bags = extractNumber(block, [
    /Maynard Park\s*:\s*(\d+)\s*bags?/i
  ]);
  row.parks_tuin_plein_bags = extractNumber(block, [
    /Tuin Plein\s*:\s*(\d+)\s*bags?/i
  ]);
  row.parks_gordon_street_verge_bags = extractNumber(block, [
    /Gordon Street (?:verge|Garden)\s*:\s*(\d+)\s*bags?/i
  ]);
  row.parks_wembley_square_verge_bags = extractNumber(block, [
    /Wembley Square verge\s*:\s*(\d+)\s*bags?/i,
    /Wembley Square Verge\s*:\s*(\d+)\s*bags?/i
  ]);
  row.calls_received = extractNumber(block, [/\*?\s*(\d+)\s*calls received/i]);
  row.whatsapps_received = extractNumber(block, [/\*?\s*(\d+)\s*WhatsApps received/i]);

  const c3 = parseC3Sections(block);
  for (const [key, value] of Object.entries(c3)) {
    row[key] = value;
  }

  return row;
}

function normalizePlace(place) {
  return place
    .toLowerCase()
    .replace(/\bbarnett\b/g, "barnet")
    .replace(/\bwembley\s+rd\b/g, "wembley road")
    .replace(/\bglyn\b/g, "glynn")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIncidentDate(raw) {
  const clean = raw.trim().replace(/\s+/g, " ");
  const wordsMatch = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (wordsMatch) {
    const day = Number(wordsMatch[1]);
    const month = monthToIndex(wordsMatch[2]);
    const year = Number(wordsMatch[3]);
    if (month) {
      const date = new Date(Date.UTC(year, month - 1, day));
      return toIso(date);
    }
  }

  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return toIso(date);
  }

  return null;
}

function parseIncidents(block, weekStart) {
  const incidents = [];
  const dateRegex = /\*\s*Date:\s*([^\n]+)\n/gi;
  const matches = [...block.matchAll(dateRegex)];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    if (current.index === undefined) {
      continue;
    }

    const segmentEnd = next && next.index !== undefined ? next.index : block.length;
    const segment = block.slice(current.index, segmentEnd);

    const placeMatch = segment.match(/\*\s*Place:\s*([^\n]+)/i);
    const summaryMatch = segment.match(/\*\s*Incident\s*report:\s*([\s\S]+)/i);

    if (!placeMatch || !summaryMatch) {
      continue;
    }

    const summary = summaryMatch[1]
      .split(
        /\n\s*(?:\*\s*(?:Incident:|Date:|Place:)|City of Cape Town|Cleaning:|Social Services:|Parks and Recreation:|Calls Received at the Control Room|Whatsapps Received|Your Eyes, Our Impact|Reporting of CRIME|LGCID Weekly Incident Report|Date:\s*\d{2}\/\d{2}\/\d{4})/i
      )[0]
      .replace(/\s+/g, " ")
      .trim();

    const contextBeforeDate = block.slice(Math.max(0, current.index - 220), current.index);
    const categoryMatch = [...contextBeforeDate.matchAll(/\*\s*Incident:\s*([^\n]+)/gi)].at(-1);

    incidents.push({
      week_start: weekStart,
      incident_date: parseIncidentDate(current[1].trim()),
      place_raw: placeMatch[1].trim(),
      place_normalized: normalizePlace(placeMatch[1]),
      summary,
      category: categoryMatch ? categoryMatch[1].trim() : "Criminal Incident"
    });
  }

  // Fallback for older narrative-only "Notable Incidents" bullets without Date/Place fields.
  if (!incidents.length) {
    const notableSection = getSection(
      block,
      /Notable Incidents/i,
      /(Reporting of CRIME|Date:\s*\d{2}\/\d{2}\/\d{4}|LGCID Weekly Incident Report|$)/i
    );
    const bulletMatches = [...notableSection.matchAll(/^\s*\*\s+(.+)$/gim)];
    for (const match of bulletMatches) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (
        text.length < 30 ||
        /^(Incident:|Date:|Place:|If you are a victim|Incidents must also|CoCT C3|Bags filled|Arrests made|Criminal incidents)/i.test(
          text
        )
      ) {
        continue;
      }

      const placeHint =
        text.match(
          /\b(?:in|on|at|near)\s+([A-Za-z\.\s]+?(?:Street|Road|Park|Plein|Terrace|Bridge))(?:\b|,|\.|\)|\s)/i
        )?.[1] ?? "Location not specified";

      incidents.push({
        week_start: weekStart,
        incident_date: null,
        place_raw: placeHint.trim(),
        place_normalized: normalizePlace(placeHint),
        summary: text,
        category: "Notable Incident"
      });
    }
  }

  return incidents;
}

function collectMarkers(text) {
  const markers = [];

  const fromRegex = /^Dear stakeholders, we hope that this update finds you well\. Please find the latest LGCID weekly incident report from the\s+(.+?)(?:\.|$)/gim;
  const titleRegex = /^LGCID Weekly Incident Report:\s*(.+)$/gim;
  const plainRegex = /^(\d{1,2}\s+August\s+to\s+\d{1,2}\s+August\s+\d{4})$/gim;

  for (const match of text.matchAll(fromRegex)) {
    markers.push({
      index: match.index,
      sourceType: "from_line",
      rangeText: match[1].trim()
    });
  }

  for (const match of text.matchAll(titleRegex)) {
    markers.push({
      index: match.index,
      sourceType: "title_line",
      rangeText: match[1].trim()
    });
  }

  for (const match of text.matchAll(plainRegex)) {
    markers.push({
      index: match.index,
      sourceType: "standalone_range",
      rangeText: match[1].trim()
    });
  }

  return markers.sort((a, b) => a.index - b.index);
}

function withinWindow(iso) {
  return iso >= REPORTING_WINDOW_START && iso <= REPORTING_WINDOW_END;
}

async function main() {
  const raw = await fs.readFile(INPUT_FILE, "utf8");
  const text = cleanText(raw);

  const markers = collectMarkers(text);
  const parsedEntries = [];
  const auditRows = [];

  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1];
    const blockStart = marker.index;
    const blockEnd = nextMarker ? nextMarker.index : text.length;
    const block = text.slice(blockStart, blockEnd);

    try {
      const { start, end } = parseWeekRange(marker.rangeText, block);
      const weekStart = toIso(start);
      const weekEnd = toIso(end);

      if (!withinWindow(weekStart)) {
        auditRows.push({
          kind: "parsed",
          source_type: marker.sourceType,
          source_index: marker.index,
          source_range: marker.rangeText,
          week_start: weekStart,
          week_end: weekEnd,
          dedupe_key: `${weekStart}|${weekEnd}`,
          kept: "no",
          note: "out_of_window"
        });
        return;
      }

      const row = parseMetrics(block, weekStart, weekEnd);
      const incidents = parseIncidents(block, weekStart);
      parsedEntries.push({
        row: {
          ...row,
          _sourceType: marker.sourceType,
          _sourceIndex: marker.index,
          _sourceRange: marker.rangeText
        },
        incidents
      });
    } catch (error) {
      auditRows.push({
        kind: "parsed",
        source_type: marker.sourceType,
        source_index: marker.index,
        source_range: marker.rangeText,
        week_start: "",
        week_end: "",
        dedupe_key: "",
        kept: "no",
        note: `parse_error:${error instanceof Error ? error.message : "unknown"}`
      });
    }
  });

  const dedupedMap = new Map();
  for (const entry of parsedEntries) {
    const row = entry.row;
    const key = `${row.week_start}|${row.week_end}`;
    if (dedupedMap.has(key)) {
      const previous = dedupedMap.get(key).row;
      auditRows.push({
        kind: "dedupe",
        source_type: previous._sourceType,
        source_index: previous._sourceIndex,
        source_range: previous._sourceRange,
        week_start: previous.week_start,
        week_end: previous.week_end,
        dedupe_key: key,
        kept: "no",
        note: "replaced_by_later_occurrence"
      });
    }
    dedupedMap.set(key, entry);
  }

  const dedupedEntries = [...dedupedMap.values()]
    .map((entry) => {
      const clean = { ...entry.row };
      delete clean._sourceType;
      delete clean._sourceIndex;
      delete clean._sourceRange;
      return {
        row: clean,
        incidents: entry.incidents
      };
    })
    .sort((a, b) => a.row.week_start.localeCompare(b.row.week_start));

  const dedupedRows = dedupedEntries.map((entry) => entry.row);

  for (const row of dedupedRows) {
    auditRows.push({
      kind: "final_reported",
      source_type: "deduped",
      source_index: "",
      source_range: "",
      week_start: row.week_start,
      week_end: row.week_end,
      dedupe_key: `${row.week_start}|${row.week_end}`,
      kept: "yes",
      note: "reported"
    });
  }

  const incidentRows = dedupedEntries
    .flatMap((entry) => entry.incidents)
    .filter((incident) => incident.week_start >= REPORTING_WINDOW_START && incident.week_start <= REPORTING_WINDOW_END);

  const incidentDeduped = [];
  const incidentKeys = new Set();
  for (const incident of incidentRows) {
    const key = `${incident.week_start}|${incident.incident_date ?? ""}|${incident.place_normalized}|${incident.summary}`;
    if (incidentKeys.has(key)) {
      continue;
    }
    incidentKeys.add(key);
    incidentDeduped.push(incident);
  }

  const incidentCountByWeek = {};
  for (const incident of incidentDeduped) {
    incidentCountByWeek[incident.week_start] = (incidentCountByWeek[incident.week_start] ?? 0) + 1;
  }

  const finalRows = [];

  if (dedupedRows.length) {
    const firstStart = dedupedRows[0].week_start;
    let leadingCursor = REPORTING_WINDOW_START;
    while (leadingCursor < firstStart) {
      const missingRow = emptyWeeklyRow(leadingCursor, dateAddDays(leadingCursor, 6), "NO_DATA_REPORTED");
      finalRows.push(missingRow);
      auditRows.push({
        kind: "generated_missing",
        source_type: "generated",
        source_index: "",
        source_range: "",
        week_start: missingRow.week_start,
        week_end: missingRow.week_end,
        dedupe_key: `${missingRow.week_start}|${missingRow.week_end}`,
        kept: "yes",
        note: "gap_before_first_report"
      });
      leadingCursor = dateAddDays(leadingCursor, 7);
    }

    for (let i = 0; i < dedupedRows.length; i += 1) {
      const current = dedupedRows[i];
      const next = dedupedRows[i + 1];

      finalRows.push(current);

      if (next) {
        let gapCursor = dateAddDays(current.week_start, 7);
        while (gapCursor < next.week_start) {
          const missingRow = emptyWeeklyRow(gapCursor, dateAddDays(gapCursor, 6), "NO_DATA_REPORTED");
          finalRows.push(missingRow);
          auditRows.push({
            kind: "generated_missing",
            source_type: "generated",
            source_index: "",
            source_range: "",
            week_start: missingRow.week_start,
            week_end: missingRow.week_end,
            dedupe_key: `${missingRow.week_start}|${missingRow.week_end}`,
            kept: "yes",
            note: "gap_between_reports"
          });
          gapCursor = dateAddDays(gapCursor, 7);
        }
      }
    }

    let trailingCursor = dateAddDays(dedupedRows[dedupedRows.length - 1].week_start, 7);
    while (trailingCursor <= REPORTING_WINDOW_END) {
      const missingRow = emptyWeeklyRow(trailingCursor, dateAddDays(trailingCursor, 6), "NO_DATA_REPORTED");
      finalRows.push(missingRow);
      auditRows.push({
        kind: "generated_missing",
        source_type: "generated",
        source_index: "",
        source_range: "",
        week_start: missingRow.week_start,
        week_end: missingRow.week_end,
        dedupe_key: `${missingRow.week_start}|${missingRow.week_end}`,
        kept: "yes",
        note: "gap_after_latest_report"
      });
      trailingCursor = dateAddDays(trailingCursor, 7);
    }
  }

  for (const row of dedupedRows) {
    const missingCore = [
      ["urban_total", row.urban_total],
      ["criminal_incidents", row.criminal_incidents],
      ["arrests_made", row.arrests_made],
      ["proactive_actions", row.proactive_actions],
      ["cleaning_bags_collected", row.cleaning_bags_collected],
      ["c3_logged_total", row.c3_logged_total],
      ["c3_resolved_total", row.c3_resolved_total]
    ]
      .filter(([, value]) => value === null || value === undefined || value === "")
      .map(([name]) => name);

    auditRows.push({
      kind: "quality_check",
      source_type: "derived",
      source_index: "",
      source_range: "",
      week_start: row.week_start,
      week_end: row.week_end,
      dedupe_key: `${row.week_start}|${row.week_end}`,
      kept: "yes",
      note: `missing_core=${missingCore.length ? missingCore.join("|") : "none"};incidents=${incidentCountByWeek[row.week_start] ?? 0}`
    });
  }

  const sortedIncidents = incidentDeduped.sort((a, b) => {
      if (a.week_start !== b.week_start) {
        return a.week_start.localeCompare(b.week_start);
      }
      return (a.incident_date ?? "").localeCompare(b.incident_date ?? "");
    });

  const normalizedFinalRows = finalRows
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((row) => ({
      ...row,
      week_label: formatWeekLabel(row.week_start, row.week_end)
    }));

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await fs.writeFile(
    path.join(OUTPUT_DIR, "weekly_metrics.csv"),
    toCsv(
      normalizedFinalRows.map((row) => {
        const ordered = {};
        WEEKLY_HEADERS.forEach((header) => {
          ordered[header] = row[header];
        });
        return ordered;
      }),
      WEEKLY_HEADERS
    ),
    "utf8"
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, "incidents.csv"),
    toCsv(
      sortedIncidents.map((row) => {
        const ordered = {};
        INCIDENT_HEADERS.forEach((header) => {
          ordered[header] = row[header];
        });
        return ordered;
      }),
      INCIDENT_HEADERS
    ),
    "utf8"
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, "parser_audit.csv"),
    toCsv(
      auditRows.map((row) => {
        const ordered = {};
        AUDIT_HEADERS.forEach((header) => {
          ordered[header] = row[header];
        });
        return ordered;
      }),
      AUDIT_HEADERS
    ),
    "utf8"
  );

  console.log(`Exported ${normalizedFinalRows.length} weekly rows, ${sortedIncidents.length} incidents.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
