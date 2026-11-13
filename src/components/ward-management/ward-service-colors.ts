/**
 * WA health services: names and catchments only (F-78, shared design parts, 13 Nov 2026).
 *
 * Ward Flow names a health service; it never colours one. Service brand colours were removed from
 * the app, and the `--wf-svc-*` tokens are neutral aliases kept only until nothing reads them. On
 * screen a service is its name, or its short name in a neutral tag (`service-name-tag.tsx`).
 */

import { type HealthService } from "./ward-model";
import { siteDirectory } from "./ward-sites";

function resolveSiteName(siteId: string, suffix?: string): string {
  const query = siteId.toLowerCase();
  const site = siteDirectory.find((s) => s.code.toLowerCase() === query || s.referenceSiteId?.toLowerCase() === query);
  const base = site ? site.name : siteId;
  return suffix ? `${base} ${suffix}` : base;
}

export interface ServiceDefinition {
  /** Short service code (e.g. "EMHS", "NMHS", "SMHS", "WACHS", "CAHS", "STATEWIDE") */
  readonly code: string;
  /** Full official legal name */
  readonly name: string;
  /** Short colloquial display name */
  readonly displayName: string;
  /** Primary hospitals and facilities in this catchment */
  readonly facilities: readonly string[];
}

const WA_HEALTH_SERVICES = {
  EMHS: {
    code: "EMHS",
    name: "East Metropolitan Health Service",
    displayName: "East Metro",
    facilities: [
      resolveSiteName("rph", "(RPH)"),
      resolveSiteName("bentley"),
      resolveSiteName("armadale"),
      "Kalamunda Hospital",
    ],
  },
  NMHS: {
    code: "NMHS",
    name: "North Metropolitan Health Service",
    displayName: "North Metro",
    facilities: [
      resolveSiteName("scgh", "(SCGH)"),
      "Osborne Park Hospital",
      resolveSiteName("graylands"),
      "King Edward Memorial Hospital (KEMH)",
    ],
  },
  SMHS: {
    code: "SMHS",
    name: "South Metropolitan Health Service",
    displayName: "South Metro",
    facilities: [
      "Fiona Stanley Hospital (FSH)",
      resolveSiteName("fremantle"),
      resolveSiteName("rockingham"),
      "Murray District Hospital",
      resolveSiteName("peel"),
    ],
  },
  WACHS: {
    code: "WACHS",
    name: "WA Country Health Service",
    displayName: "Country Health (WACHS)",
    facilities: [
      "Albany Hospital",
      "Bunbury Regional Hospital",
      resolveSiteName("geraldton"),
      "Kalgoorlie Health Campus",
      resolveSiteName("broome"),
      "Hedland Health Campus",
      "Northam Hospital",
      "Esperance Hospital",
    ],
  },
  CAHS: {
    code: "CAHS",
    name: "Child and Adolescent Health Service",
    displayName: "Child & Adolescent (CAHS)",
    facilities: [
      "Perth Children's Hospital (PCH)",
      "Child & Adolescent Mental Health (CAMHS)",
      "Community Child Health",
    ],
  },
  STATEWIDE: {
    code: "STATEWIDE",
    name: "Department of Health Western Australia",
    displayName: "Statewide (All Services)",
    facilities: [
      "State Mental Health Coordination",
      "Mental Health Emergency Response Line (MHERL)",
      "Rurallink",
      "PathWest",
    ],
  },
  PRIVATE: {
    code: "PRIVATE",
    name: "Private & Contracted Facilities",
    displayName: "Private / Contracted",
    facilities: ["Bethesda Hospital", "The Hollywood Clinic", "Perth Clinic", "Marian Centre"],
  },
} as const satisfies Record<string, ServiceDefinition>;

/**
 * Resolves any health service string or model enum to its definition.
 */
export function getHealthServiceDefinition(
  service: HealthService | "Statewide" | "All services" | null | undefined | string,
): ServiceDefinition {
  if (!service || service === "All services" || service === "Statewide" || service === "STATEWIDE") {
    return WA_HEALTH_SERVICES.STATEWIDE;
  }

  const s = service.trim().toLowerCase();

  if (s.includes("east") || s === "emhs") {
    return WA_HEALTH_SERVICES.EMHS;
  }
  if (s.includes("north") || s === "nmhs") {
    return WA_HEALTH_SERVICES.NMHS;
  }
  if (s.includes("south") || s === "smhs") {
    return WA_HEALTH_SERVICES.SMHS;
  }
  if (s.includes("country") || s.includes("wachs") || s.includes("rural")) {
    return WA_HEALTH_SERVICES.WACHS;
  }
  if (s.includes("child") || s.includes("adolescent") || s.includes("cahs") || s.includes("pch")) {
    return WA_HEALTH_SERVICES.CAHS;
  }
  if (s.includes("private")) {
    return WA_HEALTH_SERVICES.PRIVATE;
  }

  return WA_HEALTH_SERVICES.STATEWIDE;
}
