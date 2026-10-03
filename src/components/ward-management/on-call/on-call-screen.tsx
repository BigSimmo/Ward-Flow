"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock, Layers, Radio, Search, Star } from "lucide-react";
import { NETWORK_ON_CALL_ROLES, roleRecordCounts, SERVICE_ON_CALL_ROLES } from "./on-call-roster";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";

import { edHref } from "@/components/ward-management/shell/ward-facade";

import styles from "./on-call.module.css";

interface RosterItem {
  id: string;
  service: string;
  role: string;
  facility: string;
  shift: string;
  route: "bed" | "switchboard";
}

/** Site names are owned by ward-sites.ts; read at call time because the network can be swapped. */
const siteName = (code: string): string => siteByCode(code)?.name ?? code;

function serviceFacilities(service: string): [string, string] | undefined {
  switch (service) {
    case "North Metro":
      return ["Sir Charles Gairdner / Graylands", siteName("SCGH")];
    case "South Metro":
      return [siteName("FSH"), "Fiona Stanley / Fremantle"];
    case "East Metro":
      return [siteName("RPH"), "Royal Perth / Bentley"];
    case "Private":
      return ["Private Facilities Liaison", "Private Facilities Liaison"];
    default:
      return undefined;
  }
}

const FAVOURITES_KEY = "ward-flow:on-call:favourites";
const ROLE_IDS = new Set(
  [...NETWORK_ON_CALL_ROLES, ...Object.values(SERVICE_ON_CALL_ROLES).flat()].map((role) => role.id),
);

const SERVICE_PREFERENCE_KEY = "ward-flow:on-call:service";

type RoleFilter = "all" | "coordinator" | "consultant" | "governance";

const ROLE_PURPOSES: Record<string, string> = {
  "Bed coordinator": "Statewide bed placement",
  "Governance lead": "Senior operational escalation",
  "Coordinator on call": "Service placement & transfers",
  "Duty consultant": "Specialist psychiatry advice",
};

function useTableOverflow(contentKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const scroller = ref.current?.firstElementChild;
    if (!(scroller instanceof HTMLElement)) return;
    const measure = () => setOverflowing(scroller.scrollWidth > scroller.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    const table = scroller.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [contentKey]);
  return [ref, overflowing] as const;
}

/**
 * Role directory only: roles and shifts are synthetic, while EDs come from the shared site directory.
 * No staff identity or contact method is held or rendered. Routing links open guidance on this page;
 * they do not initiate calls. Empty service filters describe missing records, never real coverage.
 */
export function OnCallScreen() {
  const [selectedService, setSelectedService] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleFilter>("all");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // Reveal collapsed coverage and handover rows for native printing and restore each row afterwards.
  useEffect(() => {
    let revealed: HTMLElement[] = [];
    const expand = () => {
      if (revealed.length) return;
      revealed = [...window.document.querySelectorAll<HTMLElement>("tr[data-print-expand][hidden]")];
      revealed.forEach((row) => row.removeAttribute("hidden"));
    };
    const restore = () => {
      revealed.forEach((row) => {
        if (row.isConnected) row.setAttribute("hidden", "");
      });
      revealed = [];
    };
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      restore();
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, []);
  const [preferenceNotice, setPreferenceNotice] = useState("");
  const favouritesChangedRef = useRef(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (favouritesChangedRef.current) return;
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem(FAVOURITES_KEY) ?? "[]");
        if (Array.isArray(saved))
          setFavourites([...new Set(saved.filter((id): id is string => typeof id === "string" && ROLE_IDS.has(id)))]);
      } catch {
        // Invalid or unavailable preferences never prevent use of the directory.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  function toggleFavourite(id: string) {
    favouritesChangedRef.current = true;
    const next = favourites.includes(id) ? favourites.filter((value) => value !== id) : [...favourites, id];
    setFavourites(next);
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      setPreferenceNotice("");
    } catch {
      setPreferenceNotice("Favourites are available for this visit only; browser storage is unavailable.");
    }
  }
  const serviceChangedRef = useRef(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (serviceChangedRef.current) return;
      try {
        const saved = window.localStorage.getItem(SERVICE_PREFERENCE_KEY);
        if (saved && ["all", "Statewide Network", ...HEALTH_SERVICES].includes(saved)) setSelectedService(saved);
      } catch {
        // Preferences are optional; the directory remains usable without browser storage.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function selectService(service: string) {
    serviceChangedRef.current = true;
    setSelectedService(service);
    try {
      window.localStorage.setItem(SERVICE_PREFERENCE_KEY, service);
    } catch {
      // Keep the current selection in memory if storage is unavailable.
    }
  }
  const searchInputId = useId();
  const departments = allEmergencyDepartments();
  const counts = roleRecordCounts();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const [rosterTableRef, rosterOverflowing] = useTableOverflow(
    `${selectedService}:${normalizedQuery}:${selectedRole}:${favouritesOnly}:${favourites.join(",")}:${expandedRole}`,
  );
  const [edTableRef, edOverflowing] = useTableOverflow(`${selectedService}:${normalizedQuery}`);

  const roster = useMemo<RosterItem[]>(
    () => [
      ...NETWORK_ON_CALL_ROLES.map((role) => ({
        ...role,
        service: "Statewide Network",
        facility: role.id === "bed-coordinator" ? "Central Bed Desk" : "Statewide Tier 3 desk",
        route: role.id === "bed-coordinator" ? ("bed" as const) : ("switchboard" as const),
      })),
      ...HEALTH_SERVICES.flatMap((service) =>
        SERVICE_ON_CALL_ROLES[service].map((role) => ({
          ...role,
          service,
          facility: serviceFacilities(service)?.[role.role === "Duty consultant" ? 1 : 0] ?? service,
          route: "switchboard" as const,
        })),
      ),
    ],
    [],
  );

  const filteredRoster = roster.filter(
    (item) =>
      (selectedService === "all" || item.service === selectedService) &&
      (!favouritesOnly || favourites.includes(item.id)) &&
      (selectedRole === "all" ||
        (selectedRole === "coordinator" && item.role.toLowerCase().includes("coordinator")) ||
        (selectedRole === "consultant" && item.role === "Duty consultant") ||
        (selectedRole === "governance" && item.role === "Governance lead")) &&
      (!normalizedQuery ||
        [
          item.service,
          item.role,
          item.facility,
          item.shift,
          item.service === "Private" ? "Private placement enquiries" : (ROLE_PURPOSES[item.role] ?? ""),
        ].some((value) => value.toLowerCase().includes(normalizedQuery))),
  );
  const filteredDepartments = departments.filter((department) => {
    const site = siteByCode(department.siteCode);
    return (
      (selectedService === "all" || site?.service === selectedService) &&
      (!normalizedQuery ||
        [department.name, department.siteCode, site?.name ?? "", site?.service ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ))
    );
  });
  const hasDirectoryFilters = selectedService !== "all" || Boolean(normalizedQuery);
  const hasFilters = hasDirectoryFilters || selectedRole !== "all" || favouritesOnly;
  const serviceHasNoRoles =
    selectedService !== "all" &&
    HEALTH_SERVICES.includes(selectedService as keyof typeof SERVICE_ON_CALL_ROLES) &&
    SERVICE_ON_CALL_ROLES[selectedService as keyof typeof SERVICE_ON_CALL_ROLES]?.length === 0;

  function clearFilters() {
    selectService("all");
    setSearchQuery("");
    setSelectedRole("all");
    setFavouritesOnly(false);
    setExpandedRole(null);
  }

  return (
    <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          <div className={styles.headerTitleBlock}>
            <p className={styles.eyebrow}>Statewide specialist coordination</p>
            <h1 className={styles.pageTitle}>On-call and contacts</h1>
            <p className={styles.pageSubtitle}>Role directory · WA mental health services</p>
          </div>
          <WardDynamicIsland
            testId="ward-on-call-hud-island"
            className={styles.headerIsland}
            title="Whole network"
            status="neutral"
            statusText="Synthetic role directory; live coverage not verified"
            ariaLabel="Whole-network on-call directory summary"
            align="end"
            metrics={[
              { label: "Roles", value: counts.recorded },
              { label: "Consultants", value: roster.filter((role) => role.role === "Duty consultant").length },
              { label: "EDs", value: departments.length },
            ]}
          />
        </header>

        <div className={styles.filterControlBar}>
          <div className={styles.filterBar} role="group" aria-label="Filter by Health Service">
            <button
              type="button"
              className={`${styles.filterBtn} ${selectedService === "all" ? styles.activeFilter : ""}`}
              aria-pressed={selectedService === "all"}
              onClick={() => selectService("all")}
            >
              All services
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${selectedService === "Statewide Network" ? styles.activeFilter : ""}`}
              aria-pressed={selectedService === "Statewide Network"}
              onClick={() => selectService("Statewide Network")}
            >
              Statewide
            </button>
            {HEALTH_SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                className={`${styles.filterBtn} ${selectedService === service ? styles.activeFilter : ""}`}
                aria-pressed={selectedService === service}
                onClick={() => selectService(service)}
              >
                {service}
              </button>
            ))}
          </div>
          <div className={styles.searchWrap}>
            <Search size={14} aria-hidden="true" className={styles.searchIcon} />
            <label className="sr-only" htmlFor={searchInputId}>
              Search roster and emergency departments
            </label>
            <input
              id={searchInputId}
              type="search"
              className={styles.searchInput}
              placeholder="Search roles, hospitals or services…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          {hasFilters && (
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className={styles.contentGrid}>
          <section aria-labelledby="ward-on-call-now" className={styles.section} data-testid="ward-on-call-now">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionHeading} id="ward-on-call-now">
                On-call roles
              </h2>
              <div className={styles.sectionHeaderMetaGroup}>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${favouritesOnly ? styles.activeFilter : ""}`}
                  aria-pressed={favouritesOnly}
                  onClick={() => setFavouritesOnly(!favouritesOnly)}
                >
                  Favourites ({favourites.length})
                </button>
                <select
                  className={styles.roleSelect}
                  aria-label="Filter on-call roles"
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as RoleFilter)}
                >
                  <option value="all">All roles</option>
                  <option value="coordinator">Coordinators</option>
                  <option value="consultant">Duty consultants</option>
                  <option value="governance">Governance lead</option>
                </select>
                <span className={styles.rosterCountBadge} data-testid="ward-on-call-count" aria-live="polite">
                  {filteredRoster.length} {filteredRoster.length === 1 ? "role" : "roles"}
                  {hasFilters ? ` of ${counts.recorded}` : " recorded"} · synthetic records
                </span>
                <span className={styles.sectionMeta}>
                  <Clock size={14} aria-hidden="true" />
                  Synthetic shifts · AWST
                </span>
              </div>
            </div>
            <div className={styles.sectionBody}>
              <p className={styles.note}>
                Roles and shifts are invented. Contact details are not held. Confirm current cover through the site
                directory.
              </p>
              {preferenceNotice && (
                <p className={styles.note} role="status">
                  {preferenceNotice}
                </p>
              )}
              <div ref={rosterTableRef} className={styles.tableRegion}>
                <WardTable
                  overflowing={rosterOverflowing}
                  testId="ward-on-call-service-table"
                  className={styles.rosterTable}
                  wrapperClassName={styles.tableScroll}
                >
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Role / facility</th>
                      <th scope="col">Contact for</th>
                      <th scope="col">Shift (AWST)</th>
                      <th scope="col">Reach via</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.map((item) => (
                      <Fragment key={item.id}>
                        <tr data-testid={`ward-on-call-role-${item.id}`}>
                          <td className={styles.serviceCell}>{item.service}</td>
                          <td>
                            <div className={styles.roleTitleRow}>
                              <div className={styles.roleCellTitle}>{item.role}</div>
                              <button
                                type="button"
                                className={styles.favouriteButton}
                                aria-label={`Favourite ${item.role} for ${item.service}`}
                                aria-pressed={favourites.includes(item.id)}
                                onClick={() => toggleFavourite(item.id)}
                              >
                                <Star
                                  size={16}
                                  aria-hidden="true"
                                  fill={favourites.includes(item.id) ? "currentColor" : "none"}
                                />
                              </button>
                            </div>
                            <div className={styles.cellDetail}>{item.facility}</div>
                          </td>
                          <td className={styles.purposeCell}>
                            {item.service === "Private"
                              ? "Private placement enquiries"
                              : (ROLE_PURPOSES[item.role] ?? "Confirm role scope with service")}
                          </td>
                          <td className={styles.shiftCell}>
                            {item.shift
                              .replace("On call from home,", "From home,")
                              .replace("Business hours only,", "Business hours,")
                              .replaceAll(" to ", "–")}
                            <button
                              type="button"
                              className={styles.detailButton}
                              aria-label={`Coverage and handover for ${item.role} for ${item.service}`}
                              aria-expanded={expandedRole === item.id}
                              aria-controls={`ward-coverage-${item.id}`}
                              onClick={() => setExpandedRole(expandedRole === item.id ? null : item.id)}
                            >
                              Coverage &amp; handover
                            </button>
                          </td>
                          <td>
                            <a
                              className={styles.routingLink}
                              href={`#ward-reach-${item.route}`}
                              aria-label={`How to reach ${item.role} for ${item.service}`}
                            >
                              {item.route === "bed" ? "Bed desk" : "Switchboard"}
                              <ArrowRight size={14} aria-hidden="true" />
                            </a>
                          </td>
                        </tr>
                        <tr
                          className={styles.coverageRow}
                          hidden={expandedRole !== item.id}
                          data-print-expand=""
                          id={`ward-coverage-${item.id}`}
                        >
                          <td colSpan={5} className={styles.coverageCell}>
                            <dl className={styles.coverageGrid}>
                              <div>
                                <dt>Current cover</dt>
                                <dd>Not verified</dd>
                              </div>
                              <div>
                                <dt>Last confirmed / maintained by</dt>
                                <dd>Not recorded</dd>
                              </div>
                              <div>
                                <dt>Illustrative shift ends · AWST</dt>
                                <dd>{item.shift.match(/to (\d{2}:\d{2})$/)?.[1] ?? "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Next confirmed contact</dt>
                                <dd>Not recorded</dd>
                              </div>
                            </dl>
                            <p className={styles.note}>
                              Confirm the current role-holder, handover time and incoming contact through the service’s
                              current directory. This page has no live roster source.
                            </p>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                    {filteredRoster.length === 0 && (
                      <tr>
                        <td colSpan={5} className={styles.emptyTableState}>
                          {serviceHasNoRoles
                            ? `No on-call roles recorded for ${selectedService} in this prototype. Use the current site directory to confirm cover.`
                            : favouritesOnly
                              ? "No favourite roles match. Star a role in All roles, or clear filters to see the directory."
                              : "No on-call roles match your search."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </WardTable>
              </div>
              {rosterOverflowing && (
                <p className={styles.scrollHint}>Scroll the table sideways to see shift times and routing guidance.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="ward-on-call-ed" className={styles.section} data-testid="ward-on-call-ed">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionHeading} id="ward-on-call-ed">
                ED liaison, by department
              </h2>
              <span className={styles.sectionMeta} aria-live="polite">
                {filteredDepartments.length} {filteredDepartments.length === 1 ? "department" : "departments"}
                {hasDirectoryFilters ? ` of ${departments.length}` : ""} · synthetic records
              </span>
            </div>
            <div className={styles.sectionBody}>
              <div ref={edTableRef} className={styles.tableRegion}>
                <WardTable
                  overflowing={edOverflowing}
                  testId="ward-on-call-ed-table"
                  className={styles.edDirectoryTable}
                  wrapperClassName={styles.tableScroll}
                >
                  <thead>
                    <tr>
                      <th scope="col">Hospital / emergency department</th>
                      <th scope="col">Health service</th>
                      <th scope="col">Reach via</th>
                      <th scope="col">Workspace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepartments.map((department) => {
                      const site = siteByCode(department.siteCode);
                      return (
                        <tr key={department.id} data-testid={`ward-on-call-ed-row-${department.id}`}>
                          <td className={styles.siteCell} title={department.name}>
                            <strong>{site?.name ?? department.name}</strong>
                            <span className={styles.siteCode}>{department.siteCode} ED</span>
                          </td>
                          <td>
                            <span className={styles.serviceChip}>{site?.service ?? "Regional"}</span>
                          </td>
                          <td>
                            <a
                              className={styles.routingLink}
                              href="#ward-reach-ed"
                              aria-label={`How to reach ${department.name}`}
                            >
                              Local ED liaison
                              <ArrowRight size={14} aria-hidden="true" />
                            </a>
                          </td>
                          <td>
                            <Link
                              className={styles.workspaceLink}
                              href={edHref(department.id)}
                              prefetch={false}
                              aria-label={`Open ${department.name} workspace`}
                            >
                              Open ED
                              <ArrowRight size={14} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDepartments.length === 0 && (
                      <tr>
                        <td colSpan={4} className={styles.emptyTableState}>
                          No emergency departments match the current filter or search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </WardTable>
              </div>
              {edOverflowing && (
                <p className={styles.scrollHint}>
                  Scroll the table sideways to see health services, routing and ED workspaces.
                </p>
              )}
            </div>
          </section>

          <section
            aria-labelledby="ward-on-call-reaching"
            className={styles.section}
            data-testid="ward-on-call-reaching"
          >
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionHeading} id="ward-on-call-reaching">
                Reaching a role
              </h2>
              <span className={styles.sectionMeta}>Use the current site directory</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.reachProtocolGrid}>
                <div id="ward-reach-switchboard" tabIndex={-1} className={styles.protocolCard}>
                  <div className={styles.protocolCardHeader}>
                    <Building2 size={18} aria-hidden="true" className={styles.protocolIcon} />
                    <h3 className={styles.protocolTitle}>Hospital switchboard</h3>
                  </div>
                  <p className={styles.protocolDesc}>
                    Ask the facility switchboard for the required on-call role. Confirm who is covering the shift.
                  </p>
                </div>
                <div id="ward-reach-bed" tabIndex={-1} className={styles.protocolCard}>
                  <div className={styles.protocolCardHeader}>
                    <Layers size={18} aria-hidden="true" className={styles.protocolIcon} />
                    <h3 className={styles.protocolTitle}>Bed coordination desk</h3>
                  </div>
                  <p className={styles.protocolDesc}>
                    Use the current bed coordination directory for statewide placement queries. Have the movement
                    reference ready.
                  </p>
                </div>
                <div id="ward-reach-ed" tabIndex={-1} className={styles.protocolCard}>
                  <div className={styles.protocolCardHeader}>
                    <Radio size={18} aria-hidden="true" className={styles.protocolIcon} />
                    <h3 className={styles.protocolTitle}>Emergency department liaison</h3>
                  </div>
                  <p className={styles.protocolDesc}>
                    Use the hospital’s current directory to reach its local mental health liaison team. Confirm the
                    responsible role.
                  </p>
                </div>
              </div>
              <div className={styles.contactPrep}>
                <h3>If the first team cannot be reached</h3>
                <p>
                  Ask the facility switchboard or current service directory to confirm the covering role and the
                  approved local fallback route. Follow the facility’s urgent escalation procedure when needed. No
                  service-specific fallback procedure is recorded here.
                </p>
              </div>
              <div className={styles.contactPrep}>
                <h3>Before you contact a team</h3>
                <p>
                  Have the movement reference, referring site, reason for contact and urgency ready. Include the
                  receiving ward if agreed. Confirm the person’s role and the next action; record the outcome in the
                  movement record.
                </p>
              </div>
            </div>
          </section>
        </div>
        <WardPrototypeFooter
          testId="ward-on-call-governance"
          note="Roles and shifts are synthetic · Contact details are not held · Not a medical device"
        />
      </main>
    </div>
  );
}
