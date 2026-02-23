export type RecordStatus = "REPORTED" | "NO_DATA_REPORTED";

export type NullableNumber = number | null;

export interface WeeklyMetricRow {
  week_start: string;
  week_end: string;
  week_label: string;
  record_status: RecordStatus;
  urban_total: NullableNumber;
  urban_accidents: NullableNumber;
  urban_emergency_medical_assistance: NullableNumber;
  urban_public_safety_and_security: NullableNumber;
  urban_public_space_interventions: NullableNumber;
  criminal_incidents: NullableNumber;
  arrests_made: NullableNumber;
  section56_notices: NullableNumber;
  section341_notices: NullableNumber;
  proactive_actions: NullableNumber;
  cleaning_bags_collected: NullableNumber;
  cleaning_servitudes_cleaned: NullableNumber;
  cleaning_stormwater_drains_cleaned: NullableNumber;
  cleaning_stormwater_bags_filled: NullableNumber;
  social_incidents: NullableNumber;
  social_client_follow_ups: NullableNumber;
  social_successful_id_applications: NullableNumber;
  social_shelter_referrals: NullableNumber;
  social_work_readiness_bags: NullableNumber;
  parks_jutland_park_bags: NullableNumber;
  parks_maynard_park_bags: NullableNumber;
  parks_tuin_plein_bags: NullableNumber;
  parks_gordon_street_verge_bags: NullableNumber;
  parks_wembley_square_verge_bags: NullableNumber;
  c3_logged_total: NullableNumber;
  c3_resolved_total: NullableNumber;
  c3_logged_roads_and_infrastructure: NullableNumber;
  c3_resolved_roads_and_infrastructure: NullableNumber;
  c3_logged_water_and_sanitation: NullableNumber;
  c3_resolved_water_and_sanitation: NullableNumber;
  c3_logged_electricity: NullableNumber;
  c3_resolved_electricity: NullableNumber;
  c3_logged_parks_and_recreation: NullableNumber;
  c3_resolved_parks_and_recreation: NullableNumber;
  c3_logged_waste_management: NullableNumber;
  c3_resolved_waste_management: NullableNumber;
  c3_logged_environmental_health: NullableNumber;
  c3_resolved_environmental_health: NullableNumber;
  c3_logged_law_enforcement: NullableNumber;
  c3_resolved_law_enforcement: NullableNumber;
  c3_logged_traffic: NullableNumber;
  c3_resolved_traffic: NullableNumber;
  calls_received: NullableNumber;
  whatsapps_received: NullableNumber;
}

export interface IncidentRow {
  week_start: string;
  incident_date: string | null;
  place_raw: string;
  place_normalized: string;
  summary: string;
  category: string;
}

export interface DerivedTrendPoint {
  week_start: string;
  week_label: string;
  urban_total: NullableNumber;
  criminal_incidents: NullableNumber;
  cleaning_bags_collected: NullableNumber;
  contacts_total: NullableNumber;
  urban_ma4: NullableNumber;
  criminal_ma4: NullableNumber;
  cleaning_ma4: NullableNumber;
  contacts_total_ma4: NullableNumber;
}

export interface HotspotRow {
  street: string;
  incident_count: number;
}

export interface C3Totals {
  logged: NullableNumber;
  resolved: NullableNumber;
  resolution_ratio: NullableNumber;
}

export interface C3BreakdownRow {
  department: string;
  logged: NullableNumber;
  resolved: NullableNumber;
}

export interface DashboardMeta {
  generated_at: string;
  reporting_window_start: string;
  reporting_window_end: string;
  data_updated_at: string;
  selected_week_start: string;
  available_weeks: string[];
  data_source: "google_sheets" | "local_csv";
}

export interface DashboardResponse {
  meta: DashboardMeta;
  weekly: WeeklyMetricRow[];
  current_week: WeeklyMetricRow | null;
  trends: DerivedTrendPoint[];
  c3_totals: C3Totals;
  c3_breakdown: C3BreakdownRow[];
  hotspots: HotspotRow[];
  incidents: IncidentRow[];
}

export interface DashboardQuery {
  weekStart?: string;
  windowWeeks?: number;
}
