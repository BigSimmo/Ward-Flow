import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { HEALTH_SERVICES, type Unit } from "@/components/ward-management/ward-model";
import { REFERENCE_TEAM_NAMES, referenceTeamDetail } from "@/components/ward-management/reference/ward-reference-teams";
import { teamHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import { WARD_METADATA } from "@/components/ward-management/wards/ward-metadata";

export type DirectoryCategory =
  "wards" | "community" | "exec" | "escalation" | "switchboards" | "teams" | "transport" | "bedflow";

export type DirectoryFilter = "all" | DirectoryCategory;

export type DirectoryProvenance = "fixture" | "published" | "prototype";

export type DirectoryEntry = {
  id: string;
  category: DirectoryCategory;
  name: string;
  place: string;
  detail?: string;
  phone: string | null;
  email: string | null;
  href?: string;
  provenance: DirectoryProvenance;
};

export const DIRECTORY_CATEGORIES: readonly { id: DirectoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "wards", label: "Wards" },
  { id: "community", label: "Community" },
  { id: "exec", label: "Exec" },
  { id: "escalation", label: "Escalation" },
  { id: "switchboards", label: "Switchboards" },
  { id: "teams", label: "Ward teams" },
  { id: "transport", label: "Transport" },
  { id: "bedflow", label: "Bed flow" },
];

export const DIRECTORY_CATEGORY_LABEL: Record<DirectoryCategory, string> = {
  wards: "Ward",
  community: "Community",
  exec: "Exec",
  escalation: "Escalation",
  switchboards: "Switchboard",
  teams: "Ward team",
  transport: "Transport",
  bedflow: "Bed flow",
};

/** Numbers already on the Tools page before this directory. They are not rewritten into the 94xx series. */
const STATE_BED_DESK = "ext 8492 / (08) 6457 8492";
const MENTAL_HEALTH_TRANSPORT = "ext 7210";
const CHIEF_PSYCHIATRIST = "ext 1102";

const PROTOTYPE_BASE = 9400;

function prototypePhones(ids: readonly string[]): Map<string, string> {
  const phones = new Map<string, string>();
  [...ids].sort().forEach((id, index) => {
    phones.set(id, `ext ${PROTOTYPE_BASE + index}`);
  });
  return phones;
}

function entry(partial: DirectoryEntry): DirectoryEntry {
  return partial;
}

/**
 * Prototype contact book. Ward extensions come from the wards index fixture. Community phones and
 * emails come from the published register and are left blank when that register has none. New desks
 * use extension 94xx and `@example.invalid`, and are marked Prototype.
 */
export function buildDirectory(units: readonly Unit[]): DirectoryEntry[] {
  const prototypeIds = [
    "exec:executive-on-call",
    "exec:director-clinical-services",
    "escalation:duty-psychiatrist",
    "escalation:bed-management",
    "escalation:nurse-unit-manager",
    "escalation:other-service",
    ...wardSites.map((site) => `switchboard:${site.code}`),
    ...HEALTH_SERVICES.map((service) => `transport:${service}`),
    ...HEALTH_SERVICES.map((service) => `bedflow:${service}`),
  ];
  const phones = prototypePhones(prototypeIds);
  const phoneFor = (id: string) => phones.get(id) ?? null;

  const wards: DirectoryEntry[] = units.map((unit) => {
    const meta = WARD_METADATA[unit.id];
    const site = siteByCode(unit.siteCode);
    return entry({
      id: `ward:${unit.id}`,
      category: "wards",
      name: unit.name,
      place: site?.name ?? unit.siteCode,
      detail: meta ? `Nurse manager ${meta.num}` : undefined,
      phone: meta ? `ext ${meta.ext}` : null,
      email: meta ? `${unit.id}@example.invalid` : null,
      href: unitHref(unit.id),
      provenance: "fixture",
    });
  });

  const teams: DirectoryEntry[] = units.flatMap((unit) => {
    const meta = WARD_METADATA[unit.id];
    if (!meta) return [];
    return [
      entry({
        id: `team:${unit.id}`,
        category: "teams",
        name: meta.num,
        place: unit.name,
        detail: `Vocera ${meta.vocera}`,
        phone: `ext ${meta.ext}`,
        email: `team.${unit.id}@example.invalid`,
        href: unitHref(unit.id),
        provenance: "fixture",
      }),
    ];
  });

  const community: DirectoryEntry[] = REFERENCE_TEAM_NAMES.map((name) => {
    const detail = referenceTeamDetail(name);
    const team = communityTeamById(communityTeamSlug(name));
    const phone = detail?.publishedPhone ?? null;
    const email = detail?.referralEmail ?? null;
    return entry({
      id: `community:${name}`,
      category: "community",
      name,
      place: detail?.hsp ?? "Community",
      detail: detail?.publishedHours ?? undefined,
      phone,
      email,
      href: team ? teamHref(team.id) : undefined,
      provenance: phone || email ? "published" : "fixture",
    });
  });

  const exec: DirectoryEntry[] = [
    entry({
      id: "exec:chief-psychiatrist",
      category: "exec",
      name: "Chief Psychiatrist liaison",
      place: "Whole network",
      phone: CHIEF_PSYCHIATRIST,
      email: "chief-psychiatrist-liaison@example.invalid",
      provenance: "fixture",
    }),
    entry({
      id: "exec:executive-on-call",
      category: "exec",
      name: "Executive on call",
      place: "Whole network",
      phone: phoneFor("exec:executive-on-call"),
      email: "executive-on-call@example.invalid",
      provenance: "prototype",
    }),
    entry({
      id: "exec:director-clinical-services",
      category: "exec",
      name: "Director of clinical services",
      place: "Whole network",
      phone: phoneFor("exec:director-clinical-services"),
      email: "director-clinical-services@example.invalid",
      provenance: "prototype",
    }),
  ];

  const escalationPhones: Record<
    (typeof ESCALATION_CONTACTS)[number],
    { phone: string | null; provenance: DirectoryProvenance; email: string }
  > = {
    "State bed coordination desk": {
      phone: STATE_BED_DESK,
      provenance: "fixture",
      email: "state-bed-desk@example.invalid",
    },
    "Duty psychiatrist": {
      phone: phoneFor("escalation:duty-psychiatrist"),
      provenance: "prototype",
      email: "duty-psychiatrist@example.invalid",
    },
    "Bed management": {
      phone: phoneFor("escalation:bed-management"),
      provenance: "prototype",
      email: "bed-management@example.invalid",
    },
    "Nurse unit manager (destination ward)": {
      phone: phoneFor("escalation:nurse-unit-manager"),
      provenance: "prototype",
      email: "nurse-unit-manager-desk@example.invalid",
    },
    "Escort or transport provider": {
      phone: MENTAL_HEALTH_TRANSPORT,
      provenance: "fixture",
      email: "mental-health-transport@example.invalid",
    },
    "Other service": {
      phone: phoneFor("escalation:other-service"),
      provenance: "prototype",
      email: "other-service-desk@example.invalid",
    },
  };

  const escalation: DirectoryEntry[] = ESCALATION_CONTACTS.map((name) => {
    const contact = escalationPhones[name];
    return entry({
      id: `escalation:${name}`,
      category: "escalation",
      name,
      place: "Escalation",
      phone: contact.phone,
      email: contact.email,
      provenance: contact.provenance,
    });
  });

  const switchboards: DirectoryEntry[] = wardSites.map((site) =>
    entry({
      id: `switchboard:${site.code}`,
      category: "switchboards",
      name: `${site.name} switchboard`,
      place: site.service,
      phone: phoneFor(`switchboard:${site.code}`),
      email: `switchboard.${site.code.toLowerCase()}@example.invalid`,
      provenance: "prototype",
    }),
  );

  const transport: DirectoryEntry[] = [
    entry({
      id: "transport:state",
      category: "transport",
      name: "Mental health transport",
      place: "Whole network",
      phone: MENTAL_HEALTH_TRANSPORT,
      email: "mental-health-transport@example.invalid",
      provenance: "fixture",
    }),
    ...HEALTH_SERVICES.map((service) =>
      entry({
        id: `transport:${service}`,
        category: "transport",
        name: `${service} transport desk`,
        place: service,
        phone: phoneFor(`transport:${service}`),
        email: `transport.${service.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.invalid`,
        provenance: "prototype",
      }),
    ),
  ];

  const bedflow: DirectoryEntry[] = [
    entry({
      id: "bedflow:state",
      category: "bedflow",
      name: "State bed desk",
      place: "Whole network",
      phone: STATE_BED_DESK,
      email: "state-bed-desk@example.invalid",
      provenance: "fixture",
    }),
    ...HEALTH_SERVICES.map((service) =>
      entry({
        id: `bedflow:${service}`,
        category: "bedflow",
        name: `${service} bed flow coordinator`,
        place: service,
        phone: phoneFor(`bedflow:${service}`),
        email: `bedflow.${service.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.invalid`,
        provenance: "prototype",
      }),
    ),
  ];

  return [...wards, ...teams, ...community, ...exec, ...escalation, ...switchboards, ...transport, ...bedflow].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

export function filterDirectoryEntries(
  entries: readonly DirectoryEntry[],
  filter: DirectoryFilter,
  query: string,
): DirectoryEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((item) => {
    if (filter !== "all" && item.category !== filter) return false;
    if (needle.length === 0) return true;
    const haystack = [item.name, item.place, item.detail, item.phone, item.email]
      .filter((part) => part !== undefined && part !== null)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
