/**
 * The suburb or postcode to catchment lookup, without any screen: the Tools sheet's resolver, the
 * Community and ward suburb lookups and the header search all read it (search and forms review,
 * 31 October 2026). Split out of `ward-catchment-resolver.tsx` so the header search loads no React.
 */
import {
  S2015_CATCHMENT_ROWS,
  lookupCatchment,
  normaliseSuburbKey,
  type CatchmentLookup,
} from "@/components/ward-management/ward-catchment";
import { mapClinicToServiceAndHospital, type HealthServiceInfo } from "./ward-catchment-mapping";

export type CatchmentStatus = "Reviewed clinic match" | "Contested / split" | "Unreviewed" | "Not found";

export interface ContestedAnswerDetail {
  readonly clinics: readonly string[];
  readonly documentId: string;
  readonly documentLabel: string;
  readonly hospital: string;
  readonly healthService: HealthServiceInfo;
  readonly postcodes: readonly string[];
}

export interface ResolvedCatchment {
  readonly suburb: string;
  readonly postcodes: readonly string[];
  readonly healthService: HealthServiceInfo;
  readonly primaryHospital: string;
  readonly communityClinic: string;
  readonly status: CatchmentStatus;
  readonly caveats?: string;
  readonly contestedAnswers?: readonly ContestedAnswerDetail[];
  readonly documentSources: readonly string[];
  readonly rawLookup?: CatchmentLookup;
}

export type QueryResolutionType = "suburb" | "postcode" | "not-found" | "empty";

export interface CatchmentQueryResult {
  readonly query: string;
  readonly type: QueryResolutionType;
  readonly results: readonly ResolvedCatchment[];
  readonly notFoundMessage?: string;
}

export const QUICK_PICK_SUBURBS = ["Perth", "Morley", "Fremantle", "Armadale", "Joondalup", "Rockingham"] as const;

/** Pre-indexed lookup sets for postcodes and suburbs */
const ROWS_BY_POSTCODE: ReadonlyMap<string, readonly (typeof S2015_CATCHMENT_ROWS)[number][]> = (() => {
  const map = new Map<string, (typeof S2015_CATCHMENT_ROWS)[number][]>();
  for (const row of S2015_CATCHMENT_ROWS) {
    if (!row.postcode) continue;
    const bucket = map.get(row.postcode);
    if (bucket) bucket.push(row);
    else map.set(row.postcode, [row]);
  }
  return map;
})();

const POSTCODES_BY_SUBURB_KEY: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const row of S2015_CATCHMENT_ROWS) {
    const key = normaliseSuburbKey(row.suburb);
    const bucket = map.get(key);
    if (bucket) {
      if (!bucket.includes(row.postcode)) bucket.push(row.postcode);
    } else {
      map.set(key, [row.postcode]);
    }
  }
  return map;
})();

/**
 * Resolves a single suburb name into a full ResolvedCatchment representation.
 */
export function resolveSuburb(suburbQuery: string): ResolvedCatchment | null {
  const lookup = lookupCatchment(suburbQuery);
  if (lookup.state === "unknown") {
    return null;
  }

  const suburbName = lookup.suburb;
  const suburbKey = normaliseSuburbKey(suburbName);
  const knownPostcodes = POSTCODES_BY_SUBURB_KEY.get(suburbKey) ?? [];

  // Extract distinct document sources
  const documentSources = Array.from(
    new Set(
      lookup.answers.map((a) => `${a.document.label || a.document.id} (${a.document.date ?? "date not recorded"})`),
    ),
  );

  if (lookup.state === "reviewed") {
    const primaryClinic = lookup.answers[0]?.clinics.join(", ") || "Clinic not recorded";
    const mapping = mapClinicToServiceAndHospital(primaryClinic);
    const postcodes = lookup.answers[0]?.postcodes.length > 0 ? lookup.answers[0].postcodes : knownPostcodes;

    return {
      suburb: suburbName,
      postcodes,
      healthService: {
        code: mapping.code,
        name: mapping.name,
        displayName: mapping.displayName,
      },
      primaryHospital: mapping.hospital,
      communityClinic: primaryClinic,
      status: "Reviewed clinic match",
      documentSources,
      rawLookup: lookup,
    };
  }

  if (lookup.state === "unreviewed") {
    const primaryClinic = lookup.answers[0]?.clinics.join(", ") || "Clinic not recorded";
    const mapping = mapClinicToServiceAndHospital(primaryClinic);
    const postcodes = lookup.answers[0]?.postcodes.length > 0 ? lookup.answers[0].postcodes : knownPostcodes;

    return {
      suburb: suburbName,
      postcodes,
      healthService: {
        code: mapping.code,
        name: mapping.name,
        displayName: mapping.displayName,
      },
      primaryHospital: mapping.hospital,
      communityClinic: primaryClinic,
      status: "Unreviewed",
      caveats: lookup.note,
      documentSources,
      rawLookup: lookup,
    };
  }

  // Contested suburb
  const contestedAnswers: ContestedAnswerDetail[] = lookup.answers.map((ans) => {
    const clinicStr = ans.clinics.join(" / ");
    const mapping = mapClinicToServiceAndHospital(clinicStr);
    return {
      clinics: ans.clinics,
      documentId: ans.document.id,
      documentLabel: ans.document.label,
      hospital: mapping.hospital,
      healthService: {
        code: mapping.code,
        name: mapping.name,
        displayName: mapping.displayName,
      },
      postcodes: ans.postcodes,
    };
  });

  // Determine aggregate clinic string and hospital representation
  const clinicStrings = lookup.answers.map((a) => `${a.clinics.join(" / ")} (${a.document.id})`);
  const primaryClinic = clinicStrings.join(" vs ");

  // Aggregate hospital and health service
  const distinctServices = Array.from(new Set(contestedAnswers.map((a) => a.healthService.code)));
  const distinctHospitals = Array.from(new Set(contestedAnswers.map((a) => a.hospital)));

  const primaryServiceCode = distinctServices[0] ?? "SMHS";
  const primaryServiceName =
    distinctServices.length > 1
      ? `Split (${distinctServices.join(" / ")})`
      : (contestedAnswers[0]?.healthService.name ?? "South Metropolitan Health Service");
  const primaryServiceDisplay =
    distinctServices.length > 1
      ? `${distinctServices.join(" / ")} Split`
      : (contestedAnswers[0]?.healthService.displayName ?? "South Metro / SMHS");

  const allPostcodes = Array.from(new Set([...lookup.answers.flatMap((a) => a.postcodes), ...knownPostcodes]));

  return {
    suburb: suburbName,
    postcodes: allPostcodes,
    healthService: {
      code: primaryServiceCode,
      name: primaryServiceName,
      displayName: primaryServiceDisplay,
    },
    primaryHospital: distinctHospitals.join(" / "),
    communityClinic: primaryClinic,
    status: "Contested / split",
    caveats: lookup.note,
    contestedAnswers,
    documentSources,
    rawLookup: lookup,
  };
}

/**
 * Searches for all suburbs located within a specified 4-digit WA postcode.
 */
export function findSuburbsByPostcode(postcodeQuery: string): readonly ResolvedCatchment[] {
  const cleanPostcode = postcodeQuery.trim();
  const rows = ROWS_BY_POSTCODE.get(cleanPostcode);
  if (!rows || rows.length === 0) {
    return [];
  }

  // Deduplicate suburbs within this postcode
  const seenSuburbs = new Set<string>();
  const resolvedList: ResolvedCatchment[] = [];

  for (const row of rows) {
    const key = normaliseSuburbKey(row.suburb);
    if (seenSuburbs.has(key)) continue;
    seenSuburbs.add(key);

    const resolved = resolveSuburb(row.suburb);
    if (resolved) {
      resolvedList.push(resolved);
    }
  }

  return resolvedList;
}

/**
 * Main query resolver: parses either a suburb name or a postcode and produces
 * a structured resolution result.
 */
export function resolveCatchmentQuery(rawQuery: string): CatchmentQueryResult {
  const query = rawQuery.trim();
  if (!query) {
    return { query: "", type: "empty", results: [] };
  }

  // Check if query is a postcode (3 to 4 digits)
  if (/^\d{3,4}$/.test(query)) {
    const postcodeResults = findSuburbsByPostcode(query);
    if (postcodeResults.length > 0) {
      return {
        query,
        type: "postcode",
        results: postcodeResults,
      };
    }
    return {
      query,
      type: "not-found",
      results: [],
      notFoundMessage: `No WA catchment records found for postcode "${query}". Please check the 4-digit WA postcode or try searching by suburb name.`,
    };
  }

  // Attempt direct / aliased suburb resolution
  const suburbResult = resolveSuburb(query);
  if (suburbResult) {
    return {
      query,
      type: "suburb",
      results: [suburbResult],
    };
  }

  // Check if query matches a partial suburb name
  const norm = normaliseSuburbKey(query);
  const partialMatches = S2015_CATCHMENT_ROWS.filter((r) => normaliseSuburbKey(r.suburb).includes(norm));

  if (partialMatches.length > 0) {
    const seen = new Set<string>();
    const partialResults: ResolvedCatchment[] = [];

    for (const r of partialMatches) {
      const key = normaliseSuburbKey(r.suburb);
      if (seen.has(key)) continue;
      seen.add(key);

      const resolved = resolveSuburb(r.suburb);
      if (resolved) {
        partialResults.push(resolved);
      }
    }

    if (partialResults.length > 0) {
      return {
        query,
        type: "suburb",
        results: partialResults,
      };
    }
  }

  return {
    query,
    type: "not-found",
    results: [],
    notFoundMessage: `No WA catchment records found matching "${query}". Please check the spelling or search by 4-digit postcode.`,
  };
}

/**
 * Formats a prototype summary with clinic provenance and mapping limitations retained.
 */
export function formatCatchmentSummary(entry: ResolvedCatchment): string {
  const postcodesStr = entry.postcodes.length > 0 ? entry.postcodes.join(", ") : "Not recorded";
  const lines = [
    `WA Mental Health Catchment Summary`,
    `Prototype reference only — not a verified referral destination.`,
    `──────────────────────────────────`,
    `Suburb: ${entry.suburb}`,
    `Postcode: ${postcodesStr}`,
    `Health Service (unverified prototype mapping): ${entry.healthService.name} (${entry.healthService.code})`,
    `Hospital (unverified prototype mapping): ${entry.primaryHospital}`,
    `Follow-up Community Clinic: ${entry.communityClinic}`,
    `Clinic Match Status: ${entry.status}`,
    `Clinic sources: ${entry.documentSources.join("; ")}`,
    `Hospital and service mappings are not verified by these clinic sources. Confirm the destination separately.`,
  ];

  if (entry.caveats) {
    lines.push(`Caveats / Notes: ${entry.caveats}`);
  }

  if (entry.contestedAnswers && entry.contestedAnswers.length > 0) {
    lines.push(`Discrepancy details:`);
    for (const ans of entry.contestedAnswers) {
      lines.push(
        `  • ${ans.documentId}: ${ans.clinics.join(", ")} -> Unverified prototype hospital: ${ans.hospital} (${ans.healthService.code})`,
      );
    }
  }

  return lines.join("\n");
}
