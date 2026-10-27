// The clinic-to-service mapping, apart from the resolver screen (F-11): the access scope reads it on
// every page, and importing it from the screen put the whole catchment tool in a phone's first load.
import { siteByCode } from "@/components/ward-management/ward-sites";

/** A hospital's name as the data layer holds it (`ward-sites.ts`), never restated here. */
function siteName(code: string): string {
  return siteByCode(code)?.name ?? code;
}

export type HealthServiceCode = "NMHS" | "EMHS" | "SMHS" | "WACHS";

export interface HealthServiceInfo {
  readonly code: HealthServiceCode;
  readonly name: string;
  readonly displayName: string;
}

export interface ServiceHospitalMapping extends HealthServiceInfo {
  readonly hospital: string;
}

/**
 * Unverified prototype mapping from a clinic string to a service and hospital.
 * The reviewed catchment documents support clinic matches, not these hospital assignments.
 */
export function mapClinicToServiceAndHospital(clinicStr: string): ServiceHospitalMapping {
  const norm = clinicStr.trim().toLowerCase();

  // 1. South Metropolitan Health Service (SMHS)
  if (norm.startsWith("alma street") || norm === "fremantle") {
    return {
      code: "SMHS",
      name: "South Metropolitan Health Service",
      displayName: "South Metro / SMHS",
      hospital: "Fiona Stanley Hospital (FSH) / Fremantle Hospital",
    };
  }
  if (norm.includes("peel") || norm.includes("rockingham") || norm.includes("kwinana")) {
    const isPeel = norm.includes("peel");
    return {
      code: "SMHS",
      name: "South Metropolitan Health Service",
      displayName: "South Metro / SMHS",
      hospital: isPeel ? `${siteName("RGH")} / ${siteName("PEEL")}` : siteName("RGH"),
    };
  }

  // 2. East Metropolitan Health Service (EMHS)
  if (norm.includes("armadale") || norm.includes("mead") || norm.includes("eudoria")) {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: "Armadale Health Service (Armadale Hospital)",
    };
  }
  if (norm.includes("bentley") || norm.includes("mills street")) {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: "Bentley Hospital / Royal Perth Hospital (RPH)",
    };
  }
  if (norm.includes("midland") || norm.includes("midalnd") || norm.includes("swan")) {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: siteName("SJGM"),
    };
  }
  if (norm.includes("inner city") || norm === "icc") {
    return {
      code: "EMHS",
      name: "East Metropolitan Health Service",
      displayName: "East Metro / EMHS",
      hospital: "Royal Perth Hospital (RPH) / Sir Charles Gairdner Hospital (SCGH)",
    };
  }

  // 3. North Metropolitan Health Service (NMHS)
  if (norm.includes("joondalup") || norm.includes("clarkson")) {
    return {
      code: "NMHS",
      name: "North Metropolitan Health Service",
      displayName: "North Metro / NMHS",
      hospital: siteName("JHC"),
    };
  }
  if (norm.includes("mirrabooka") || norm.includes("osborne") || norm.includes("subiaco")) {
    return {
      code: "NMHS",
      name: "North Metropolitan Health Service",
      displayName: "North Metro / NMHS",
      hospital: "Graylands Hospital / Sir Charles Gairdner Hospital (SCGH)",
    };
  }

  // 4. WA Country Health Service (WACHS)
  if (norm === "bunbury") {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: siteName("BUN"),
    };
  }
  if (norm.includes("albany") || norm.includes("lower great southern")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: siteName("ALB"),
    };
  }
  if (norm.includes("great south") || (norm.includes("southern") && !norm.includes("coastal"))) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: `${siteName("ALB")} / Narrogin Hospital (Metro receiving: FSH)`,
    };
  }
  if (norm.includes("narrogin")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Narrogin Hospital (Metro receiving: FSH)",
    };
  }
  if (norm.includes("wheat") || norm.includes("northam") || norm.includes("merredin") || norm.includes("western")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Northam Hospital / Merredin Hospital (Metro receiving: RPH)",
    };
  }
  if (norm.includes("geraldton") || norm.includes("midwest")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Geraldton Hospital (Metro receiving: SCGH)",
    };
  }
  if (norm.includes("gascoyne") || norm.includes("murchison")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Carnarvon Hospital / Geraldton Hospital (Metro receiving: SCGH)",
    };
  }
  if (norm.includes("goldfield") || norm.includes("coastal")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Kalgoorlie Health Campus / Esperance Hospital (Metro receiving: FSH)",
    };
  }
  if (norm.includes("kimberley")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Broome Hospital / Kununurra Hospital (Metro receiving: RPH)",
    };
  }
  if (norm.includes("pilbara") || norm.includes("north west")) {
    return {
      code: "WACHS",
      name: "WA Country Health Service",
      displayName: "Country Health (WACHS)",
      hospital: "Hedland Health Campus / Nickol Bay Hospital (Metro receiving: RPH)",
    };
  }

  // Fallback for unrecognised country locality
  return {
    code: "WACHS",
    name: "WA Country Health Service",
    displayName: "Country Health (WACHS)",
    hospital: "Regional Health Campus (WACHS)",
  };
}
