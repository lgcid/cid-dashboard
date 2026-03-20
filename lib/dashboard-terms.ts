import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Building2,
  ClipboardList,
  FileText,
  PhoneCall,
  Scale,
  TrendingUp
} from "lucide-react";

export type DashboardTermsDefinition = {
  term: string;
  definition: string;
};

export type DashboardTermsSection = {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconPath?: string;
  accentToken:
    | "neutral"
    | "safety"
    | "cleaning"
    | "social"
    | "parks"
    | "lawEnforcement"
    | "urbanManagement";
  definitions: DashboardTermsDefinition[];
};

export const DASHBOARD_TERMS_TITLE = "CID Dashboard: Terms and Definitions";

export const DASHBOARD_TERMS_INTRO =
  "This document provides definitions for the metrics and terminology used in the Lower Gardens CID Weekly Operations Dashboard.";

export const DASHBOARD_TERMS_SECTIONS: DashboardTermsSection[] = [
  {
    id: "general-terms",
    title: "General Terms",
    icon: BookOpenText,
    accentToken: "neutral",
    definitions: [
      {
        term: "CID (City Improvement District)",
        definition:
          'A defined geographic area in which property owners pay an additional levy to fund "top-up" services (over and above those provided by the City) to improve the safety, cleanliness, and environment of the area.'
      },
      {
        term: "LGCID (Lower Gardens CID)",
        definition: "The non-profit organisation and geographic area representing the Lower Gardens community."
      },
      {
        term: "Reporting Week",
        definition: "The specific seven-day period (Monday to Sunday) for which the data is being displayed."
      }
    ]
  },
  {
    id: "public-safety",
    title: "Public Safety",
    description:
      "These metrics track criminal activity within the CID and crime prevention activities by the public safety officers:",
    iconPath: "/icons/pillar-safety.webp",
    accentToken: "safety",
    definitions: [
      {
        term: "Criminal Incidents",
        definition: "Actual crimes reported or witnessed, such as theft out of motor vehicles, common robbery, or burglary."
      },
      {
        term: "Arrests",
        definition:
          "The successful apprehension of a suspect by public safety officers or law enforcement officers, typically followed by a handover to the South African Police Service (SAPS)."
      },
      {
        term: "Stop and Search",
        definition: "Pro-active actions taken based on observation rather than in response to a reported crime."
      },
      {
        term: "Public Space Intervention",
        definition:
          "The management and movement of individuals in public spaces to ensure areas remain accessible and orderly (e.g. the movement of homeless people)."
      }
    ]
  },
  {
    id: "cleaning-maintenance",
    title: "Cleaning & Maintenance",
    description: "These metrics track the cleaning and maintenance activities of the CID cleaning team:",
    iconPath: "/icons/pillar-cleaning.webp",
    accentToken: "cleaning",
    definitions: [
      {
        term: "Cleaning Bags Collected",
        definition:
          "The cumulative total of all bags collected by the cleaning team. This figure is the sum of Bags Filled and Collected + Stormwater Bags Filled."
      },
      {
        term: "Bags Filled and Collected",
        definition: "The total number of refuse bags filled with litter and waste collected from streets and public spaces."
      },
      {
        term: "Stormwater Bags Filled",
        definition: "Refuse bags filled specifically from rubbish and debris collected out of the drains."
      },
      {
        term: "Servitudes Cleaned",
        definition: "Maintenance and litter removal in public alleyways, passages, or strips of land (servitudes)."
      },
      {
        term: "Stormwater Drains Cleaned",
        definition: "Removal of debris from street-level drainage grates to prevent flooding."
      }
    ]
  },
  {
    id: "social-services",
    title: "Social Services",
    description:
      "These metrics track both direct outreach and employment transition initiatives supported by the CID social services team:",
    iconPath: "/icons/pillar-social.webp",
    accentToken: "social",
    definitions: [
      {
        term: "Social Services Touch Points",
        definition:
          "The cumulative total of core outreach activities. This figure is the sum of Incidents, Client Engagements, Client Follow Ups, Support Sessions, ID Applications, and Referred Clients to Shelters."
      },
      {
        term: "Incidents",
        definition: "Individual encounters or specific social-related events recorded (e.g, domestic violence issues or suicide prevention)."
      },
      {
        term: "Individual Engagements",
        definition: "Initial meetings with potential clients, typically during outreach visits."
      },
      {
        term: "Client Follow Ups",
        definition:
          "Subsequent engagements with clients to monitor their progress, provide ongoing support, or move them further along a path of assistance."
      },
      {
        term: "Successful ID Applications",
        definition:
          "Assistance provided to a client that successfully results in them obtaining a valid identification document, which is a prerequisite for many social and employment services."
      },
      {
        term: "Referred Clients to Shelters",
        definition: "The successful facilitation of placing or referring an individual to a formal shelter facility."
      },
      {
        term: "Work Readiness Program",
        definition:
          'A temporary initiative providing employment to formally homeless people from the area. Participants join the program to job-shadow the cleaning and parks teams, providing "top-up" labor and additional services such as graffiti removal.'
      },
      {
        term: "Work Readiness Bags Collected",
        definition: "The number of refuse bags collected specifically by participants in the Work Readiness program."
      }
    ]
  },
  {
    id: "parks-recreation",
    title: "Parks & Recreation",
    description: "These metrics track activities across all green areas managed or supported by the CID park wardens:",
    iconPath: "/icons/pillar-parks.webp",
    accentToken: "parks",
    definitions: [
      {
        term: "Bags",
        definition:
          "Specifically refers to the volume of organic and inorganic waste collected from public parks and green spaces managed or supported by the CID."
      },
      {
        term: "Trees Pruned",
        definition: "Refers to the number of trees trimmed"
      }
    ]
  },
  {
    id: "law-enforcement",
    title: "Law Enforcement",
    description: "These metrics track the fines issued by the CID’s Law Enforcement officer:",
    icon: Scale,
    accentToken: "lawEnforcement",
    definitions: [
      {
        term: "Section 56 Notices",
        definition:
          "Fines or summonses issued to an individual for by-law contraventions (e.g. public consumption of alcohol or littering)."
      },
      {
        term: "Section 341 Notices",
        definition: "Fines typically issued for traffic-related or administrative offenses (e.g. illegal parking)."
      }
    ]
  },
  {
    id: "urban-management",
    title: "Urban Management",
    description: "These metrics track public space incidents and actions:",
    icon: Building2,
    accentToken: "urbanManagement",
    definitions: [
      {
        term: "Motor Vehicle Accidents",
        definition: "Any incidents involving vehicles or pedestrians that require coordination, traffic management, or reporting."
      },
      {
        term: "Emergency, Medical and Assistance",
        definition:
          "Providing immediate first aid, calling for emergency services (ambulances/fire), or assisting community members in distress or medical need."
      },
      {
        term: "Pro-active Actions",
        definition:
          "Actions taken by safety officers based on observation rather than in response to a reported crime. This includes checking unsecured properties, or identifying potential safety hazards before an incident occurs."
      },
      {
        term: "By-Law Management",
        definition: "General activities related to enforcing the city’s by-laws (e.g., lighting fires)."
      }
    ]
  },
  {
    id: "c3-tracker",
    title: "C3 Tracker",
    description: "These metrics track interaction with the City of Cape Town’s (CoCT) service request system:",
    icon: ClipboardList,
    accentToken: "neutral",
    definitions: [
      {
        term: "C3 Logged",
        definition:
          "A formal service request submitted by the CID to the City of Cape Town for issues outside the CID's direct mandate (e.g. burst pipes, street light outages)."
      },
      {
        term: "C3 Resolved",
        definition:
          "A ticket that has been closed by the City and subsequently determined to be resolved by the CID after the reported issue has been addressed."
      },
      {
        term: "Category",
        definition:
          "The classification of the municipal issue (e.g. Water & Sanitation, Electricity, Solid Waste, or Roads & Stormwater)."
      },
      {
        term: "Roads & Infrastructure",
        definition: "Issues related to road surfaces (potholes), sidewalks, street signage, and public infrastructure."
      },
      {
        term: "Water & Sanitation",
        definition: "Water leaks, burst pipes, blocked sewers, or water outages."
      },
      {
        term: "Electricity",
        definition: "Streetlight outages, power failures, or damaged electrical boxes."
      },
      {
        term: "Parks & Recreation",
        definition: "Maintenance of public parks, play equipment, or irrigation in green spaces."
      },
      {
        term: "Waste Management",
        definition: "Illegal dumping, missed refuse collections, or bin repairs."
      },
      {
        term: "Environmental Health",
        definition: "Issues like noise pollution, air quality, or health hazards in public spaces."
      },
      {
        term: "Law Enforcement",
        definition: "City-mandated enforcement issues like illegal occupation or trading violations."
      },
      {
        term: "Traffic",
        definition: "Faulty traffic lights, traffic signal timing, or road safety concerns."
      }
    ]
  },
  {
    id: "control-room-engagement",
    title: "Control Room Engagement",
    description:
      "These metrics track resident reporting, service request activity, and the operations of the CID 24-hour Control Room:",
    icon: PhoneCall,
    accentToken: "neutral",
    definitions: [
      {
        term: "Calls + WhatsApp Received",
        definition:
          "The total volume of incoming calls to the CID’s 24-hour number or messages received by the dedicated WhatsApp number."
      }
    ]
  },
  {
    id: "trends",
    title: "Trends",
    description: "The Trends tab provides a longitudinal view of CID performance over key metrics:",
    icon: TrendingUp,
    accentToken: "neutral",
    definitions: [
      {
        term: "Weekly Metric Value",
        definition:
          "The actual recorded count or value for a specific category (e.g. number of incidents, bags collected, or touch points) for each individual week shown on the chart."
      },
      {
        term: "4-Week Moving Average",
        definition:
          "A calculation used to smooth out short-term fluctuations and highlight longer-term trends. It represents the average value of a metric over the most recent four weeks (the current week plus the three preceding weeks)."
      }
    ]
  }
];
