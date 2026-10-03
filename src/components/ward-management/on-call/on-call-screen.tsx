"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock, Layers, Radio, Search } from "lucide-react";
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

const SERVICE_FACILITIES: Record<string, [string, string]> = {
  "North Metro": ["Sir Charles Gairdner / Graylands", "Sir Charles Gairdner Hospital"],
  "South Metro": ["Fiona Stanley Hospital", "Fiona Stanley / Fremantle"],
  "East Metro": ["Royal Perth Hospital", "Royal Perth / Bentley"],
  Private: ["Private Facilities Liaison", "Private Facilities Liaison"],
};

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
  const searchInputId = useId();
  const departments = allEmergencyDepartments();
  const counts = roleRecordCounts();
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const [rosterTableRef, rosterOverflowing] = useTableOverflow(`${selectedService}:${normalizedQuery}:${selectedRole}`);
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
          facility: SERVICE_FACILITIES[service]?.[role.role === "Duty consultant" ? 1 : 0] ?? service,
          route: "switchboard" as const,
        })),
      ),
    ],
    [],
  );

  const filteredRoster = roster.filter(
    (item) =>
      (selectedService === "all" || item.service === selectedService) &&
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
  const hasFilters = hasDirectoryFilters || selectedRole !== "all";
  const serviceHasNoRoles =
    selectedService !== "all" &&
    HEALTH_SERVICES.includes(selectedService as keyof typeof SERVICE_ON_CALL_ROLES) &&
    SERVICE_ON_CALL_ROLES[selectedService as keyof typeof SERVICE_ON_CALL_ROLES]?.length === 0;

  function clearFilters() {
    setSelectedService("all");
    setSearchQuery("");
    setSelectedRole("all");
  }

  return (
    <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          <div className={styles.headerTitleBlock}>
            <p className={styles.eyebrow}>Statewide specialist coordination</p>
            <h1 className={styles.pageTitle}>On-call and contacts</h1>
            <p className={styles.pageSubtitle}>Find a role, its service and how to reach it.</p>
          </div>
          <WardDynamicIsland
            testId="ward-on-call-hud-island"
            className={styles.headerIsland}
            title="Directory"
            status="neutral"
            statusText="Synthetic role directory; live coverage not verified"
            ariaLabel="On-call directory summary"
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
              onClick={() => setSelectedService("all")}
            >
              All services
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${selectedService === "Statewide Network" ? styles.activeFilter : ""}`}
              aria-pressed={selectedService === "Statewide Network"}
              onClick={() => setSelectedService("Statewide Network")}
            >
              Statewide
            </button>
            {HEALTH_SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                className={`${styles.filterBtn} ${selectedService === service ? styles.activeFilter : ""}`}
                aria-pressed={selectedService === service}
                onClick={() => setSelectedService(service)}
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
                  {hasFilters ? ` of ${counts.recorded}` : " recorded"}
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
                      <tr key={item.id} data-testid={`ward-on-call-role-${item.id}`}>
                        <td className={styles.serviceCell}>{item.service}</td>
                        <td>
                          <div className={styles.roleCellTitle}>{item.role}</div>
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
                    ))}
                    {filteredRoster.length === 0 && (
                      <tr>
                        <td colSpan={5} className={styles.emptyTableState}>
                          {serviceHasNoRoles
                            ? `No on-call roles recorded for ${selectedService} in this prototype. Use the current site directory to confirm cover.`
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
                {hasDirectoryFilters ? ` of ${departments.length}` : ""}
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
                    Ask the facility switchboard for the on-call psychiatry role. Confirm who is covering the shift.
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
