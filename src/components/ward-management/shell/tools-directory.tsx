"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Mail, Phone, Search } from "lucide-react";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { NETWORK_ON_CALL_ROLES, SERVICE_ON_CALL_ROLES } from "@/components/ward-management/on-call/on-call-roster";
import {
  REFERENCE_TEAM_CAVEAT,
  referenceTeamDetail,
} from "@/components/ward-management/reference/ward-reference-teams";
import { edHref, teamHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { HEALTH_SERVICES, type Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode, wardSites } from "@/components/ward-management/ward-sites";

import styles from "./ward-bar.module.css";

type DirectoryKind =
  "switchboards" | "coordinators" | "exec" | "transport" | "wards" | "ward-teams" | "emergency" | "community";

type DirectoryEntry = {
  id: string;
  kind: DirectoryKind;
  name: string;
  detail: string;
  phone: string;
  email: string;
  href?: string;
  published: boolean;
};

const KINDS: readonly { id: DirectoryKind; label: string }[] = [
  { id: "switchboards", label: "Switchboards" },
  { id: "coordinators", label: "Bed flow" },
  { id: "exec", label: "Exec" },
  { id: "transport", label: "Transport" },
  { id: "wards", label: "Wards" },
  { id: "ward-teams", label: "Ward teams" },
  { id: "emergency", label: "Emergency" },
  { id: "community", label: "Community" },
];

/** Stable prototype extension. Not a public number and not for dialling. */
function prototypeExtension(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `Prototype ext ${2000 + ((hash >>> 0) % 7000)}`;
}

function prototypeEmail(id: string): string {
  const slug = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "desk"}@prototype.wardflow.test`;
}

function siteName(code: string): string {
  return siteByCode(code)?.name ?? code;
}

function buildDirectory(units: readonly Unit[]): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];

  for (const site of wardSites) {
    entries.push({
      id: `switch-${site.code}`,
      kind: "switchboards",
      name: `${site.name} switchboard`,
      detail: site.service,
      phone: prototypeExtension(`switchboard-${site.code}`),
      email: prototypeEmail(`switchboard-${site.code}`),
      published: false,
    });
  }

  entries.push({
    id: "coord-state",
    kind: "coordinators",
    name: "State bed flow coordinator",
    detail: NETWORK_ON_CALL_ROLES.find((role) => role.id === "bed-coordinator")?.shift ?? "Statewide desk",
    phone: prototypeExtension("bed-coordinator-state"),
    email: prototypeEmail("bed-coordinator-state"),
    published: false,
  });
  for (const service of HEALTH_SERVICES) {
    const coordinator = SERVICE_ON_CALL_ROLES[service].find((role) => role.role.startsWith("Coordinator"));
    entries.push({
      id: `coord-${service}`,
      kind: "coordinators",
      name: `${service} bed flow coordinator`,
      detail: coordinator?.shift ?? "No coordinator shift recorded",
      phone: prototypeExtension(`bed-coordinator-${service}`),
      email: prototypeEmail(`bed-coordinator-${service}`),
      published: false,
    });
  }

  entries.push({
    id: "exec-governance",
    kind: "exec",
    name: "Governance lead",
    detail: NETWORK_ON_CALL_ROLES.find((role) => role.id === "governance-lead")?.shift ?? "Escalation",
    phone: prototypeExtension("governance-lead"),
    email: prototypeEmail("governance-lead"),
    published: false,
  });
  entries.push({
    id: "exec-escalation",
    kind: "exec",
    name: "State escalation desk",
    detail: "Senior operational escalation",
    phone: prototypeExtension("state-escalation"),
    email: prototypeEmail("state-escalation"),
    published: false,
  });
  for (const service of HEALTH_SERVICES) {
    entries.push({
      id: `exec-${service}`,
      kind: "exec",
      name: `${service} escalation`,
      detail: "Service executive desk",
      phone: prototypeExtension(`escalation-${service}`),
      email: prototypeEmail(`escalation-${service}`),
      published: false,
    });
  }

  entries.push({
    id: "transport-state",
    kind: "transport",
    name: "Mental health transport",
    detail: "Statewide desk",
    phone: prototypeExtension("transport-state"),
    email: prototypeEmail("transport-state"),
    published: false,
  });
  for (const service of HEALTH_SERVICES) {
    entries.push({
      id: `transport-${service}`,
      kind: "transport",
      name: `${service} transport`,
      detail: "Service transport desk",
      phone: prototypeExtension(`transport-${service}`),
      email: prototypeEmail(`transport-${service}`),
      published: false,
    });
  }

  for (const unit of units) {
    const hospital = siteName(unit.siteCode);
    entries.push({
      id: `ward-${unit.id}`,
      kind: "wards",
      name: unit.name,
      detail: `${hospital} · ${unit.cohort}`,
      phone: prototypeExtension(`ward-${unit.id}`),
      email: prototypeEmail(`ward-${unit.id}`),
      href: unitHref(unit.id),
      published: false,
    });
    entries.push({
      id: `team-${unit.id}`,
      kind: "ward-teams",
      name: `${unit.name} nursing team`,
      detail: hospital,
      phone: prototypeExtension(`ward-team-${unit.id}`),
      email: prototypeEmail(`ward-team-${unit.id}`),
      href: unitHref(unit.id),
      published: false,
    });
  }

  for (const department of allEmergencyDepartments()) {
    entries.push({
      id: `ed-${department.id}`,
      kind: "emergency",
      name: department.name,
      detail: siteName(department.siteCode),
      phone: prototypeExtension(`ed-${department.id}`),
      email: prototypeEmail(`ed-${department.id}`),
      href: edHref(department.id),
      published: false,
    });
  }

  for (const team of COMMUNITY_TEAM_PAGES) {
    const published = referenceTeamDetail(team.name);
    entries.push({
      id: `community-${team.id}`,
      kind: "community",
      name: team.name,
      detail: published?.hsp ?? "Community team",
      phone: published?.publishedPhone ?? "Not published",
      email: published?.referralEmail ?? "Not published",
      href: teamHref(team.id),
      published: published !== null,
    });
  }

  return entries;
}

function entryMatches(entry: DirectoryEntry, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = `${entry.name} ${entry.detail} ${entry.phone} ${entry.email}`.toLowerCase();
  return haystack.includes(query);
}

export function ToolsDirectoryPanel({ units, onNavigate }: { units: readonly Unit[]; onNavigate: () => void }) {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => buildDirectory(units), [units]);
  const normalised = query.trim().toLowerCase();
  const visible = entries.filter((entry) => entryMatches(entry, normalised));

  return (
    <div className={styles.directoryPanel}>
      <label className={styles.directorySearch}>
        <Search aria-hidden="true" />
        <input
          aria-label="Search ward contacts"
          placeholder="Search name, number or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className={styles.directoryCaveat}>
        Prototype extensions are not live lines. Do not dial them. Community rows marked Published use the service
        directory. {REFERENCE_TEAM_CAVEAT}
      </p>
      <nav className={styles.directoryKinds} aria-label="Directory number types">
        {KINDS.map((kind) => (
          <a key={kind.id} href={`#ward-directory-${kind.id}`}>
            {kind.label}
            <span>{entries.filter((entry) => entry.kind === kind.id).length}</span>
          </a>
        ))}
      </nav>
      <p className={styles.directoryNote} role="status">
        {visible.length} of {entries.length} contacts
        {visible.length === 0 ? " · No matching locations." : ""}
      </p>
      {KINDS.map((kind) => {
        const rows = visible.filter((entry) => entry.kind === kind.id);
        return (
          <section key={kind.id} id={`ward-directory-${kind.id}`} className={styles.directorySection}>
            <h3 className={styles.toolsHeading}>
              {kind.label} <span>{rows.length}</span>
            </h3>
            <ul className={styles.directoryList} aria-label={kind.id === "wards" ? "Ward contacts" : kind.label}>
              {rows.map((entry) => (
                <li key={entry.id}>
                  <div className={styles.directoryRow}>
                    <div className={styles.directoryIdentity}>
                      {entry.href ? (
                        <Link href={entry.href} onClick={onNavigate}>
                          <span>{entry.name}</span>
                        </Link>
                      ) : (
                        <strong>{entry.name}</strong>
                      )}
                      <small>
                        {entry.detail}
                        {entry.published ? " · Published" : ""}
                      </small>
                    </div>
                    <div className={styles.directoryChannels}>
                      <span>
                        <Phone aria-hidden="true" />
                        {entry.phone}
                      </span>
                      <span>
                        <Mail aria-hidden="true" />
                        {entry.email}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
