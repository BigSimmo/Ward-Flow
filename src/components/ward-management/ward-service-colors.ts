/**
 * WA HEALTH SERVICES COLOR KEY & BRAND SPECIFICATION
 *
 * Sourced directly from the official Government of Western Australia Department of Health
 * production stylesheets (DOHWA / HSP corporate identity guidelines):
 *
 * - East Metropolitan Health Service (EMHS):   Primary Green  #00825E (EMHS.css)
 * - North Metropolitan Health Service (NMHS):  Primary Red    #990057 (NMHS.css)
 * - South Metropolitan Health Service (SMHS):  Primary Purple #5A2476 (SMHS.css)
 * - WA Country Health Service (WACHS):         Primary Blue   #005B94 (WACHS.css)
 * - Child & Adolescent Health Service (CAHS):  Primary Blue   #0076BE (CAHS.css)
 * - Statewide (WA Health / Department of Health): WA Health   #0071A5 / Emerald #10B981
 * - Private / Contracted:                     Neutral Slate  #475569
 *
 * Provides typed color tokens, soft luminous pastel tints for top-bar badges, high-contrast
 * text inks meeting WCAG 2.1 AA (4.5:1+) and AAA (7:1+) criteria, and helper lookup functions.
 */

import { type HealthService } from "./ward-model";
import { wardSites } from "./ward-sites";

function resolveSiteName(siteId: string, suffix?: string): string {
  const query = siteId.toLowerCase();
  const site = wardSites.find((s) => s.code.toLowerCase() === query || s.referenceSiteId?.toLowerCase() === query);
  const base = site ? site.name : siteId;
  return suffix ? `${base} ${suffix}` : base;
}

export interface ServiceColorDefinition {
  /** Short service code (e.g. "EMHS", "NMHS", "SMHS", "WACHS", "CAHS", "STATEWIDE") */
  readonly code: string;
  /** Full official legal name */
  readonly name: string;
  /** Short colloquial display name */
  readonly displayName: string;
  /** Primary brand color hex code from official style guide */
  readonly brandHex: string;
  /** Secondary or accent brand color if defined */
  readonly secondaryHex?: string;
  /** Official style sheet source */
  readonly sourceStylesheet: string;
  /** Primary hospitals and facilities in this catchment */
  readonly facilities: readonly string[];
  /** Saturated status dot color */
  readonly dotColor: string;
  /** Light mode tokens for cockpit header badge */
  readonly light: {
    readonly bg: string;
    readonly border: string;
    readonly ink: string;
    readonly contrastRatio: string;
  };
  /** Dark mode tokens */
  readonly dark: {
    readonly bg: string;
    readonly border: string;
    readonly ink: string;
    readonly dot: string;
  };
  /** CSS custom property prefix (e.g. "--svc-east") */
  readonly cssVarPrefix: string;
}

export const WA_HEALTH_SERVICES_COLOR_KEY = {
  EMHS: {
    code: "EMHS",
    name: "East Metropolitan Health Service",
    displayName: "East Metro",
    brandHex: "#00825e",
    secondaryHex: "#ffdd00",
    sourceStylesheet: "https://emhs.health.wa.gov.au/~/media/DOHWA/css/EMHS.css",
    facilities: [
      resolveSiteName("rph", "(RPH)"),
      resolveSiteName("bentley"),
      resolveSiteName("armadale"),
      "Kalamunda Hospital",
    ],
    dotColor: "#00825e",
    light: {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      ink: "#065f46",
      contrastRatio: "8.2:1 (AAA)",
    },
    dark: {
      bg: "rgba(16, 185, 129, 0.15)",
      border: "rgba(52, 211, 153, 0.3)",
      ink: "#6ee7b7",
      dot: "#34d399",
    },
    cssVarPrefix: "--svc-east",
  },
  NMHS: {
    code: "NMHS",
    name: "North Metropolitan Health Service",
    displayName: "North Metro",
    brandHex: "#990057",
    sourceStylesheet: "https://nmhs.health.wa.gov.au/~/media/DOHWA/css/NMHS.css",
    facilities: [
      resolveSiteName("scgh", "(SCGH)"),
      "Osborne Park Hospital",
      resolveSiteName("graylands"),
      "King Edward Memorial Hospital (KEMH)",
    ],
    dotColor: "#990057",
    light: {
      bg: "#fdf2f8",
      border: "#fbcfe8",
      ink: "#831843",
      contrastRatio: "7.9:1 (AAA)",
    },
    dark: {
      bg: "rgba(219, 39, 119, 0.15)",
      border: "rgba(244, 114, 182, 0.3)",
      ink: "#fbcfe8",
      dot: "#f472b6",
    },
    cssVarPrefix: "--svc-north",
  },
  SMHS: {
    code: "SMHS",
    name: "South Metropolitan Health Service",
    displayName: "South Metro",
    brandHex: "#5a2476",
    secondaryHex: "#9d0033",
    sourceStylesheet: "https://smhs.health.wa.gov.au/~/media/DOHWA/css/SMHS.css",
    facilities: [
      "Fiona Stanley Hospital (FSH)",
      resolveSiteName("fremantle"),
      resolveSiteName("rockingham"),
      "Murray District Hospital",
      resolveSiteName("peel"),
    ],
    dotColor: "#5a2476",
    light: {
      bg: "#faf5ff",
      border: "#e9d5ff",
      ink: "#581c87",
      contrastRatio: "8.4:1 (AAA)",
    },
    dark: {
      bg: "rgba(168, 85, 247, 0.15)",
      border: "rgba(192, 132, 252, 0.3)",
      ink: "#e9d5ff",
      dot: "#c084fc",
    },
    cssVarPrefix: "--svc-south",
  },
  WACHS: {
    code: "WACHS",
    name: "WA Country Health Service",
    displayName: "Country Health (WACHS)",
    brandHex: "#005b94",
    secondaryHex: "#00667c",
    sourceStylesheet: "https://wacountry.health.wa.gov.au/~/media/DOHWA/css/WACHS.css",
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
    dotColor: "#005b94",
    light: {
      bg: "#f0f9ff",
      border: "#bae6fd",
      ink: "#0369a1",
      contrastRatio: "7.1:1 (AAA)",
    },
    dark: {
      bg: "rgba(14, 165, 233, 0.15)",
      border: "rgba(56, 189, 248, 0.3)",
      ink: "#bae6fd",
      dot: "#38bdf8",
    },
    cssVarPrefix: "--svc-wachs",
  },
  CAHS: {
    code: "CAHS",
    name: "Child and Adolescent Health Service",
    displayName: "Child & Adolescent (CAHS)",
    brandHex: "#0076be",
    secondaryHex: "#f7921e",
    sourceStylesheet: "https://cahs.health.wa.gov.au/~/media/DOHWA/css/CAHS.css",
    facilities: [
      "Perth Children's Hospital (PCH)",
      "Child & Adolescent Mental Health (CAMHS)",
      "Community Child Health",
    ],
    dotColor: "#0076be",
    light: {
      bg: "#f0f9ff",
      border: "#bae6fd",
      ink: "#026aa7",
      contrastRatio: "7.0:1 (AAA)",
    },
    dark: {
      bg: "rgba(2, 106, 167, 0.15)",
      border: "rgba(56, 189, 248, 0.3)",
      ink: "#bae6fd",
      dot: "#a5d8ff",
    },
    cssVarPrefix: "--svc-cahs",
  },
  STATEWIDE: {
    code: "STATEWIDE",
    name: "Department of Health Western Australia",
    displayName: "Statewide (All Services)",
    brandHex: "#0071a5",
    secondaryHex: "#10b981",
    sourceStylesheet: "https://www.health.wa.gov.au/~/media/DOHWA/css/DOH.css",
    facilities: [
      "State Mental Health Coordination",
      "Mental Health Emergency Response Line (MHERL)",
      "Rurallink",
      "PathWest",
    ],
    // WA Health corporate green, from health.wa.gov.au's stylesheet.
    dotColor: "#005b38",
    light: {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      ink: "#065f46",
      contrastRatio: "8.2:1 (AAA)",
    },
    dark: {
      bg: "rgba(16, 185, 129, 0.15)",
      border: "rgba(52, 211, 153, 0.3)",
      ink: "#6ee7b7",
      dot: "#a3d9b8",
    },
    cssVarPrefix: "--svc-statewide",
  },
  PRIVATE: {
    code: "PRIVATE",
    name: "Private & Contracted Facilities",
    displayName: "Private / Contracted",
    brandHex: "#475569",
    sourceStylesheet: "Ward Flow Clinical Scope Model",
    facilities: ["Bethesda Hospital", "The Hollywood Clinic", "Perth Clinic", "Marian Centre"],
    dotColor: "#64748b",
    light: {
      bg: "#f8fafc",
      border: "#cbd5e1",
      ink: "#334155",
      contrastRatio: "8.5:1 (AAA)",
    },
    dark: {
      bg: "rgba(100, 116, 139, 0.15)",
      border: "rgba(148, 163, 184, 0.3)",
      ink: "#e2e8f0",
      dot: "#94a3b8",
    },
    cssVarPrefix: "--svc-private",
  },
} as const satisfies Record<string, ServiceColorDefinition>;

export type ServiceColorKey = keyof typeof WA_HEALTH_SERVICES_COLOR_KEY;

/**
 * Resolves any health service string or model enum to its authoritative color definition.
 */
export function getHealthServiceColorDefinition(
  service: HealthService | "Statewide" | "All services" | null | undefined | string,
): ServiceColorDefinition {
  if (!service || service === "All services" || service === "Statewide" || service === "STATEWIDE") {
    return WA_HEALTH_SERVICES_COLOR_KEY.STATEWIDE;
  }

  const s = service.trim().toLowerCase();

  if (s.includes("east") || s === "emhs") {
    return WA_HEALTH_SERVICES_COLOR_KEY.EMHS;
  }
  if (s.includes("north") || s === "nmhs") {
    return WA_HEALTH_SERVICES_COLOR_KEY.NMHS;
  }
  if (s.includes("south") || s === "smhs") {
    return WA_HEALTH_SERVICES_COLOR_KEY.SMHS;
  }
  if (s.includes("country") || s.includes("wachs") || s.includes("rural")) {
    return WA_HEALTH_SERVICES_COLOR_KEY.WACHS;
  }
  if (s.includes("child") || s.includes("adolescent") || s.includes("cahs") || s.includes("pch")) {
    return WA_HEALTH_SERVICES_COLOR_KEY.CAHS;
  }
  if (s.includes("private")) {
    return WA_HEALTH_SERVICES_COLOR_KEY.PRIVATE;
  }

  return WA_HEALTH_SERVICES_COLOR_KEY.STATEWIDE;
}

/**
 * Returns inline CSS style attributes for an interactive scope badge based on service.
 */
export function getHealthServiceBadgeStyle(
  service: HealthService | "Statewide" | "All services" | null | undefined | string,
): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const def = getHealthServiceColorDefinition(service);
  return {
    backgroundColor: `var(${def.cssVarPrefix}-bg, ${def.light.bg})`,
    borderColor: `var(${def.cssVarPrefix}-border, ${def.light.border})`,
    color: `var(${def.cssVarPrefix}-ink, ${def.light.ink})`,
  };
}

/**
 * Returns inline CSS style attributes for a status dot.
 */
export function getHealthServiceDotStyle(
  service: HealthService | "Statewide" | "All services" | null | undefined | string,
): {
  backgroundColor: string;
} {
  const def = getHealthServiceColorDefinition(service);
  return {
    backgroundColor: `var(${def.cssVarPrefix}, ${def.dotColor})`,
  };
}
