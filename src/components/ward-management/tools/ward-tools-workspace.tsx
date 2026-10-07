"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BedDouble, Search, Phone, Mail, ClipboardList, Truck, Clock, Users } from "lucide-react";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { standingFigures } from "../ward-standing-strip";
import { capacityBreakdown, bedsPendingPreparation, openBedsNow } from "../ward-bed-availability";
import { occupiedBeds } from "../statistics/statistics-occupancy";
import { dayOf, formatInstant } from "../ward-clock";
import { isOpen } from "../ward-derivations";
import { wardSites, siteByCode, allEmergencyDepartments } from "../ward-sites";
import { COMMUNITY_TEAM_PAGES } from "../community/community-derivations";
import { contactForTeam } from "../community/community-team-contact-mapping";
import { HEALTH_SERVICES, TRANSPORT_PROVIDERS, type Unit } from "../ward-model";
import styles from "./ward-tools-workspace.module.css";

const root = "/mockups/ward-flow";

export function NetworkFigures() {
  const { units, admissions, movements, bedReleases, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  const [category, setCategory] = useState("all");
  const capacity = units.map((unit) => capacityBreakdown(unit, bedReleases, leaveBeds, now));
  const total = units.reduce((sum, unit) => sum + unit.beds, 0);
  const occupied = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  const available = capacity.reduce((sum, value) => sum + value.availableNow, 0);
  const open = movements.filter(isOpen);
  const deadlines = standingFigures({
    units,
    admissions,
    movements,
    bedReleases,
    leaveBeds,
    now,
    chromeRole: "coordinator",
  }).filter((figure) => ["passed", "within-hour", "longest"].includes(figure.key));
  const groups = [
    {
      id: "capacity",
      label: "Beds & capacity",
      icon: BedDouble,
      figures: [
        { label: "Total beds", value: String(total), sub: `${units.length} wards` },
        {
          label: "Occupied",
          value: String(occupied.occupied),
          sub: total ? `${Math.round((occupied.occupied / total) * 100)}% occupancy` : "—",
        },
        {
          label: "Ready",
          value: String(available),
          sub: total ? `${Math.round((available / total) * 100)}% of beds` : "—",
        },
        {
          label: "Open for placement",
          value: String(units.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0)),
          sub: "Can be pulled into",
        },
        {
          label: "Pending preparation",
          value: String(units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0)),
          sub: "Free beds pending",
        },
        { label: "Pulled beds", value: String(occupied.pulled), sub: "Awaiting arrival" },
        {
          label: "Held beds",
          value: String(capacity.reduce((sum, value) => sum + value.held, 0)),
          sub: "Not allocatable",
        },
        {
          label: "On leave",
          value: String(capacity.reduce((sum, value) => sum + value.onLeave, 0)),
          sub: "Bed retained",
        },
      ],
    },
    {
      id: "flow",
      label: "Flow & discharges",
      icon: Truck,
      figures: [
        { label: "Open movements", value: String(open.length), sub: "Active placement records" },
        {
          label: "From ED",
          value: String(open.filter((movement) => movement.originEdId !== undefined).length),
          sub: "Open placements",
        },
        {
          label: "Admissions today",
          value: String(
            admissions.filter((admission) => admission.arrivedAt !== null && dayOf(admission.arrivedAt) === dayOf(now))
              .length,
          ),
          sub: "Recorded arrivals",
        },
        {
          label: "Discharges today",
          value: String(
            admissions.filter((admission) => admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now))
              .length,
          ),
          sub: "Recorded departures",
        },
        {
          label: "Confirmed today",
          value: String(capacity.reduce((sum, value) => sum + value.confirmedToday, 0)),
          sub: "Discharge not yet complete",
        },
        {
          label: "Expected today",
          value: String(capacity.reduce((sum, value) => sum + value.expectedToday, 0)),
          sub: "Unconfirmed discharges",
        },
        {
          label: "Blocked today",
          value: String(capacity.reduce((sum, value) => sum + value.blockedToday, 0)),
          sub: "Recorded discharge blockers",
        },
      ],
    },
    { id: "deadlines", label: "Waits & recorded limits", icon: Clock, figures: deadlines },
  ];
  return (
    <div className={styles.workspace} data-testid="ward-stats-drawer-content">
      <div className={styles.meta}>
        <span className={styles.liveDot} /> Whole network <span>Synthetic · {formatInstant(now)}</span>
      </div>
      <div className={styles.filters} role="group" aria-label="Figure categories">
        {[{ id: "all", label: "All figures" }, ...groups].map((group) => (
          <button
            key={group.id}
            type="button"
            aria-pressed={category === group.id}
            onClick={() => setCategory(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>
      {groups
        .filter((group) => category === "all" || category === group.id)
        .map((group) => (
          <section className={styles.surface} key={group.id}>
            <h3 className={styles.heading}>
              <group.icon aria-hidden="true" />
              {group.label}
            </h3>
            <dl className={styles.figures}>
              {group.figures.map((figure) => (
                <div key={figure.label} data-flagged={"flagged" in figure && figure.flagged ? true : undefined}>
                  <dt>{figure.label}</dt>
                  <dd>
                    {figure.value}
                    <small>{figure.sub}</small>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      <Link className={styles.moreLink} href={`${root}/statistics`}>
        Open statistics <ArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}

type ContactCategory = "wards" | "ed" | "community" | "switchboards" | "coordinators" | "transport" | "escalation";
export type DirectoryEntry = {
  id: string;
  name: string;
  context: string;
  category: ContactCategory;
  href: string;
  phone?: string | null;
  email?: string | null;
  recordedOn?: string | null;
  mockPhone?: boolean;
  mockEmail?: boolean;
};

/** Contact associations use only the repository's approved team mapping. Missing details stay explicit. */
export function toolsDirectoryEntries(units: Unit[]): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [
    ...units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      context: siteByCode(unit.siteCode)?.name ?? unit.siteCode,
      category: "wards" as const,
      href: `${root}/ward/${unit.id}`,
    })),
    ...allEmergencyDepartments().map((ed) => ({
      id: ed.id,
      name: ed.name,
      context: siteByCode(ed.siteCode)?.name ?? ed.siteCode,
      category: "ed" as const,
      href: `${root}/ed/${ed.id}`,
    })),
    ...COMMUNITY_TEAM_PAGES.map((team) => {
      const contact = contactForTeam(team.name);
      return {
        id: team.id,
        name: team.name,
        context: "Community mental health",
        category: "community" as const,
        href: `${root}/community/${team.id}`,
        phone: contact?.publishedPhone,
        email: contact?.referralEmail,
        recordedOn: contact?.recordedOn,
      };
    }),
    ...wardSites.map((site) => ({
      id: `switchboard-${site.code}`,
      name: `${site.name} switchboard`,
      context: site.service,
      category: "switchboards" as const,
      href: `${root}/on-call#ward-reach-switchboard`,
    })),
    ...HEALTH_SERVICES.map((service) => ({
      id: `coordinator-${service}`,
      name: `${service} bed flow coordinator`,
      context: "Bed placement",
      category: "coordinators" as const,
      href: `${root}/on-call#ward-reach-bed`,
    })),
    ...TRANSPORT_PROVIDERS.map((provider) => ({
      id: `transport-${provider}`,
      name: provider,
      context: "Transport bookings",
      category: "transport" as const,
      href: `${root}/movements`,
    })),
    ...["Executive on call", "Duty consultant psychiatrist", "Clinical governance escalation", "State bed desk"].map(
      (name) => ({
        id: name,
        name,
        context: "On-call & escalation",
        category: "escalation" as const,
        href: `${root}/on-call`,
      }),
    ),
  ];
  // Owner-requested mock contacts. The unassigned 0000 prefix and .invalid domain cannot be
  // mistaken for the published contacts; mock methods intentionally have no dial/email links.
  return entries.map((entry, index) => ({
    ...entry,
    phone: entry.phone ?? `(08) 0000 ${String(index + 1000).padStart(4, "0")}`,
    email: entry.email ?? `${entry.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.invalid`,
    mockPhone: !entry.phone,
    mockEmail: !entry.email,
  }));
}

export function ToolsContactDirectory({ onNavigate }: { onNavigate: () => void }) {
  const { units } = useWardFlow();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const entries = toolsDirectoryEntries(units);
  const categories = [
    { id: "all", label: "All contacts" },
    { id: "wards", label: "Wards" },
    { id: "ed", label: "ED teams" },
    { id: "community", label: "Community" },
    { id: "switchboards", label: "Switchboards" },
    { id: "coordinators", label: "Bed flow" },
    { id: "transport", label: "Transport" },
    { id: "escalation", label: "Exec & escalation" },
  ];
  const terms = query.toLowerCase().trim().split(/\s+/);
  const matches = entries.filter(
    (entry) =>
      (category === "all" || entry.category === category) &&
      terms.every((term) =>
        `${entry.name} ${entry.context} ${entry.phone ?? ""} ${entry.email ?? ""}`.toLowerCase().includes(term),
      ),
  );
  return (
    <div className={styles.workspace}>
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <input
          type="search"
          aria-label="Search contact directory"
          placeholder="Search team, hospital, number or email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" aria-label="Clear contact search" onClick={() => setQuery("")}>
            Clear
          </button>
        )}
      </label>
      <div className={styles.filters} role="group" aria-label="Contact types">
        {categories.map((item) => (
          <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.meta} role="status">
        {matches.length} synthetic records{" "}
        <span>Mock contact details labelled · {categories.find((item) => item.id === category)?.label}</span>
      </div>
      <ul className={styles.contacts} aria-label="Contact directory">
        {matches.map((entry) => (
          <li className={styles.surface} key={`${entry.category}-${entry.id}`}>
            <Link className={styles.contactTitle} href={entry.href} onClick={onNavigate}>
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.context}</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <div className={styles.contactMethods}>
              {entry.mockPhone ? (
                <span>
                  <Phone aria-hidden="true" />
                  <span className={styles.methodValue}>{entry.phone}</span>
                  <b className={styles.mockBadge}>Mock</b>
                </span>
              ) : (
                <a href={`tel:${entry.phone?.replace(/[^+\d]/g, "")}`}>
                  <Phone aria-hidden="true" />
                  <span className={styles.methodValue}>{entry.phone}</span>
                </a>
              )}
              {entry.mockEmail ? (
                <span>
                  <Mail aria-hidden="true" />
                  <span className={styles.methodValue}>{entry.email}</span>
                  <b className={styles.mockBadge}>Mock</b>
                </span>
              ) : (
                <a href={`mailto:${entry.email}`}>
                  <Mail aria-hidden="true" />
                  <span className={styles.methodValue}>{entry.email}</span>
                </a>
              )}
            </div>
            {!entry.mockPhone && (
              <small className={styles.contactDate}>
                Published · {entry.recordedOn ?? "Date not recorded"} · Not call-tested; may be obsolete
              </small>
            )}
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <div className={styles.empty}>
          <Users aria-hidden="true" />
          <strong>No matching contacts</strong>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Reset search
          </button>
        </div>
      )}
    </div>
  );
}

export function OperationalLinks({ onNavigate }: { onNavigate: () => void }) {
  const links = [
    { href: "handover", name: "Shift handover", detail: "Review and print", icon: ClipboardList },
    { href: "capacity", name: "Available beds", detail: "Find placement capacity", icon: BedDouble },
    { href: "delays", name: "Discharge blockers", detail: "Review delayed discharges", icon: Clock },
    { href: "movements", name: "Transport & movements", detail: "Track current journeys", icon: Truck },
    { href: "on-call", name: "On-call & escalation", detail: "Find covering roles", icon: Phone },
    { href: "legal-forms", name: "Recorded form limits", detail: "Review legal form records", icon: ClipboardList },
  ];
  return (
    <div className={styles.actionGrid}>
      {links.map((link) => (
        <Link className={styles.action} href={`${root}/${link.href}`} key={link.href} onClick={onNavigate}>
          <link.icon aria-hidden="true" />
          <span>
            <strong>{link.name}</strong>
            <small>{link.detail}</small>
          </span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
