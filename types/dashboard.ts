export type RecordStatus = "REPORTED" | "NO_DATA_REPORTED";

export type NullableNumber = number | null;

export const SECTION_KEYS = [
  "urban_management",
  "public_safety",
  "law_enforcement",
  "cleaning",
  "social_services",
  "parks",
  "control_room_engagement",
  "c3_requests"
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
export type MatrixSectionKey = Exclude<SectionKey, "c3_requests">;
export const MATRIX_SECTION_KEYS = SECTION_KEYS.filter(
  (key): key is MatrixSectionKey => key !== "c3_requests"
);

export interface WeekRecord {
  week_start: string;
  week_end: string;
  week_label: string;
  record_status: RecordStatus;
}

export interface SectionCategoryRow {
  category: string;
  values: Record<string, NullableNumber>;
}

export interface SectionData {
  key: SectionKey;
  heading: string;
  categories: SectionCategoryRow[];
}

export type SectionMap = Record<SectionKey, SectionData>;

export interface HardcodedWeeklyMetrics {
  urban_total: NullableNumber;
  criminal_incidents: NullableNumber;
  arrests_made: NullableNumber;
  section56_notices: NullableNumber;
  section341_notices: NullableNumber;
  proactive_actions: NullableNumber;
  public_space_interventions: NullableNumber;
  cleaning_bags_collected: NullableNumber;
  cleaning_servitudes_cleaned: NullableNumber;
  cleaning_stormwater_drains_cleaned: NullableNumber;
  cleaning_stormwater_bags_filled: NullableNumber;
  social_touch_points: NullableNumber;
  parks_total_bags: NullableNumber;
  parks_pruned_trees: NullableNumber;
  c3_logged_total: NullableNumber;
  calls_received: NullableNumber;
  whatsapps_received: NullableNumber;
}

export type HardcodedWeeklyMetricKey = keyof HardcodedWeeklyMetrics;

export interface WeeklyMetricRow extends WeekRecord {
  metrics: HardcodedWeeklyMetrics;
}

export interface IncidentRow {
  week_start: string;
  incident_date: string | null;
  place: string;
  summary: string;
  category: string;
}

export interface C3RequestRow {
  category: string;
  reference_number: string | null;
  date_logged: string | null;
  request_status: string | null;
  resolved: boolean | null;
  issue_description: string;
  service: string;
  address: string;
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

export interface C3TrackerTotals {
  logged: number;
  resolved: number;
  backlog: number;
  resolution_ratio: NullableNumber;
}

export interface C3TrackerBreakdownRow {
  department: string;
  logged: number;
  resolved: number;
  backlog: number;
  resolution_ratio: NullableNumber;
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
  weeks: WeekRecord[];
  sections: SectionMap;
  weekly: WeeklyMetricRow[];
  current_week: WeeklyMetricRow | null;
  trends: DerivedTrendPoint[];
  c3_tracker_totals: C3TrackerTotals;
  c3_tracker_breakdown: C3TrackerBreakdownRow[];
  c3_request_rows: C3RequestRow[];
  hotspots: HotspotRow[];
  incidents: IncidentRow[];
}

export interface DashboardQuery {
  weekStart?: string;
  windowWeeks?: number;
}
