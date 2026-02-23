export const BRAND = {
  colors: {
    black: "#000000",
    white: "#FFFFFF",
    safetyCleaning: "#FFF300",
    social: "#FF3087",
    parks: "#44D62C"
  },
  fonts: {
    heading: "Montserrat",
    body: "Roboto Condensed"
  },
  logoPath: "/logos/lgcid-horizontal-black.png",
  logoPathWhite: "/logos/lgcid-horizontal-white.png"
} as const;

export const C3_DEPARTMENTS = [
  "roads_and_infrastructure",
  "water_and_sanitation",
  "electricity",
  "parks_and_recreation",
  "waste_management",
  "environmental_health",
  "law_enforcement",
  "traffic"
] as const;

export const C3_DEPARTMENT_LABELS: Record<(typeof C3_DEPARTMENTS)[number], string> = {
  roads_and_infrastructure: "Roads & Infrastructure",
  water_and_sanitation: "Water & Sanitation",
  electricity: "Electricity",
  parks_and_recreation: "Parks & Recreation",
  waste_management: "Waste Management",
  environmental_health: "Environmental Health",
  law_enforcement: "Law Enforcement",
  traffic: "Traffic"
};

export const HOTSPOT_DEFAULT_WEEKS = 4;
export const HOTSPOT_LIMIT = 8;

export const NO_DATA_LABEL = "No Data Reported";
