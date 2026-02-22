import { z } from "zod";

function nullableNumber() {
  return z.preprocess((value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const str = String(value).trim();
    if (!str || str.toLowerCase() === "null") {
      return null;
    }
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  }, z.number().nullable());
}

export const weeklyMetricSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  week_label: z.string(),
  record_status: z.enum(["REPORTED", "NO_DATA_REPORTED"]),
  urban_total: nullableNumber(),
  urban_accidents: nullableNumber(),
  urban_emergency_medical_assistance: nullableNumber(),
  urban_public_safety_and_security: nullableNumber(),
  urban_public_space_interventions: nullableNumber(),
  criminal_incidents: nullableNumber(),
  arrests_made: nullableNumber(),
  section56_notices: nullableNumber(),
  section341_notices: nullableNumber(),
  proactive_actions: nullableNumber(),
  cleaning_bags_collected: nullableNumber(),
  cleaning_servitudes_cleaned: nullableNumber(),
  cleaning_stormwater_drains_cleaned: nullableNumber(),
  cleaning_stormwater_bags_filled: nullableNumber(),
  social_incidents: nullableNumber(),
  social_client_follow_ups: nullableNumber(),
  social_successful_id_applications: nullableNumber(),
  social_shelter_referrals: nullableNumber(),
  social_work_readiness_bags: nullableNumber(),
  parks_jutland_park_bags: nullableNumber(),
  parks_maynard_park_bags: nullableNumber(),
  parks_tuin_plein_bags: nullableNumber(),
  parks_gordon_street_verge_bags: nullableNumber(),
  parks_wembley_square_verge_bags: nullableNumber(),
  c3_logged_total: nullableNumber(),
  c3_resolved_total: nullableNumber(),
  c3_logged_roads_and_infrastructure: nullableNumber(),
  c3_resolved_roads_and_infrastructure: nullableNumber(),
  c3_logged_water_and_sanitation: nullableNumber(),
  c3_resolved_water_and_sanitation: nullableNumber(),
  c3_logged_electricity: nullableNumber(),
  c3_resolved_electricity: nullableNumber(),
  c3_logged_parks_and_recreation: nullableNumber(),
  c3_resolved_parks_and_recreation: nullableNumber(),
  c3_logged_waste_management: nullableNumber(),
  c3_resolved_waste_management: nullableNumber(),
  c3_logged_environmental_health: nullableNumber(),
  c3_resolved_environmental_health: nullableNumber(),
  c3_logged_law_enforcement: nullableNumber(),
  c3_resolved_law_enforcement: nullableNumber(),
  c3_logged_traffic: nullableNumber(),
  c3_resolved_traffic: nullableNumber(),
  calls_received: nullableNumber(),
  whatsapps_received: nullableNumber()
});

export const incidentSchema = z.object({
  week_start: z.string(),
  incident_date: z.string().nullable(),
  place_raw: z.string(),
  place_normalized: z.string(),
  summary: z.string(),
  category: z.string()
});

export const weeklyMetricRowsSchema = z.array(weeklyMetricSchema);
export const incidentRowsSchema = z.array(incidentSchema);
