"use client";

import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Layers,
  Phone,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  NETWORK_ON_CALL_ROLES,
  roleRecordCounts,
  SERVICE_ON_CALL_ROLES,
  servicesWithNoRoleRecorded,
} from "@/components/ward-management/on-call/on-call-roster";
import { ESCALATION_CONTACTS, type EscalationContact } from "@/components/ward-management/ward-change-reasons";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { WardFlowClockContext, WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";

import styles from "./on-call.module.css";

const DEFAULT_ESCALATION_REFERENCE = "WF-009 (Awaiting Placement)";

function parseMovementReference(value: string): string | undefined {
  const match = /\bWF-(\d+)\b/iu.exec(value.trim());
  if (match === null) return undefined;
  return `WF-${match[1]}`;
}

interface EnrichedRosterItem {
  id: string;
  service: string;
  role: string;
  facility: string;
  holder: string;
  shift: string;
  statusText: string;
  statusTone: "good" | "warn" | "accent";
}

/**
 * 🔴 **ON-CALL AND CONTACTS — A SCREEN THAT DELIBERATELY GIVES YOU NOBODY TO RING.**
 *
 * ⚠️ **THIS IS THE MOST DANGEROUS SCREEN IN WARD FLOW TO BUILD, AND THE HAZARD IS NOT A BUG.** Its
 * entire purpose is to be acted on at speed, in the middle of the night, by somebody who needs a
 * person. **A roster that is wrong is worse than no roster**, because the reader does not audit it —
 * they ring it.
 *
 * ## What is real here and what is not, stated once and then again on the screen itself
 *
 * ✅ **REAL:** the emergency departments, their sites and their health services, all read from
 * `ward-sites.ts` — the same source every other Ward Flow screen uses.
 *
 * 🔴 **INVENTED:** every role and every shift window. **The model holds no staff concept at all** —
 * no name, no number, no shift, nowhere for one to live. See `on-call-roster.ts`, which carries the
 * measurement and the type that cannot hold a contact method.
 *
 * ## 🔴 Three rules this screen is built to, and the third is the one that would be quietly lost
 *
 * 1. **No contact method is rendered anywhere.** No number, no extension, no pager, no address —
 *    not even an obviously-fake one. ⚠️ **This is STRICTER than the drawing**, which shows disclosed
 *    placeholders. The drawing's posture is defensible; **none is safer and costs nothing**, because
 *    the drawing's own *Reaching a role* panel already sends the reader to a directory kept outside
 *    this prototype. A placeholder buys a thing to misread in exchange for nothing.
 * 2. **Nothing is diallable.** No link whose scheme would hand a number to a phone app or an address
 *    to a mail client, and no link that could start a call.
 *    `tests/ward-on-call-holds-no-people.test.ts` fails on anything phone-shaped in this folder.
 * 3. The brief safety statement stays visible and the complete disclosure remains one native,
 *    labelled control away. The print hook opens that disclosure for paper and restores the
 *    reader's prior state afterwards.
 *
 * ⚠️ **POPULATION / LIMIT.** This screen answers *which roles does this prototype record* and
 * nothing else. **It cannot say whether a real service has somebody on call**, and its "not
 * recorded" wording is a statement about this software, never about the world.
 */
export function OnCallScreen() {
  usePrintableDisclosures();

  const flow = useContext(WardFlowContext);
  const clock = useContext(WardFlowClockContext);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [escalationOpen, setEscalationOpen] = useState<boolean>(false);
  const [escalationReference, setEscalationReference] = useState(DEFAULT_ESCALATION_REFERENCE);
  const [escalationContact, setEscalationContact] = useState<EscalationContact>(ESCALATION_CONTACTS[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"good" | "warn">("good");
  const toastTimerRef = useRef<number | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const searchInputId = useId();
  const contactSelectId = useId();
  const referenceInputId = useId();

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!escalationOpen) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEscalationOpen(false);
        triggerButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [escalationOpen]);

  function showToast(message: string, tone: "good" | "warn") {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToastTone(tone);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3500);
  }

  function handlePrototypeAction() {
    showToast("Not wired in this prototype.", "warn");
  }

  function recordTier3Escalation() {
    const now = clock ?? flow?.now;
    if (flow === null || now === undefined) {
      showToast("Escalation was not recorded.", "warn");
      return;
    }
    const movementId = parseMovementReference(escalationReference);
    if (movementId === undefined) {
      showToast("Escalation was not recorded — the movement reference is not a movement id.", "warn");
      return;
    }
    const movement = flow.movements.find((item) => item.id === movementId);
    if (movement === undefined) {
      showToast("Escalation was not recorded — no movement matches that reference.", "warn");
      return;
    }
    if (movement.closure) {
      showToast("Escalation was not recorded — that movement is closed.", "warn");
      return;
    }
    if (!ESCALATION_CONTACTS.includes(escalationContact)) {
      showToast("Escalation was not recorded.", "warn");
      return;
    }
    flow.dispatch({
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now,
      movementId,
      triedUnitIds: movement.declines.map((decline) => decline.unitId),
      contact: escalationContact,
    });
    setEscalationOpen(false);
    triggerButtonRef.current?.focus();
    showToast("Escalation was recorded.", "good");
  }

  const departments = allEmergencyDepartments();
  const counts = roleRecordCounts();
  const missing = servicesWithNoRoleRecorded();
  const incompleteRoles = counts.recorded < counts.possible;

  const consultantCount = Object.values(SERVICE_ON_CALL_ROLES)
    .flat()
    .filter((role) => role.role === "Duty consultant").length;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Unified roster item list matching third-edition mockup specifications
  const enrichedRoster = useMemo<EnrichedRosterItem[]>(() => {
    const items: EnrichedRosterItem[] = [];

    // 1. Network-wide roles
    for (const role of NETWORK_ON_CALL_ROLES) {
      const facility = role.id === "bed-coordinator" ? "Central Bed Desk" : "Clinical Governance & Statewide Tier 3";
      const holder = role.id === "bed-coordinator" ? "Operations Lead" : "Executive Duty Lead";

      items.push({
        id: role.id,
        service: "Statewide Network",
        role: role.role,
        facility,
        holder,
        shift: role.shift,
        statusText: "Demonstration role",
        statusTone: "good",
      });
    }

    // 2. Health service specific roles
    for (const service of HEALTH_SERVICES) {
      const roles = SERVICE_ON_CALL_ROLES[service] ?? [];
      for (const role of roles) {
        let facility = `${service} Base`;
        let holder = "Senior Coordinator";
        let statusTone: "good" | "warn" | "accent" = "good";
        let statusText = "Demonstration role";

        if (service === "North Metro") {
          if (role.role === "Duty consultant") {
            facility = siteByCode("SCGH")?.name ?? "SCGH";
            holder = "On-Call Consultant";
          } else {
            facility = "Sir Charles Gairdner / Graylands";
            holder = "Duty Coordinator";
          }
        } else if (service === "South Metro") {
          if (role.role === "Duty consultant") {
            facility = "Fiona Stanley / Fremantle";
            holder = "On-Call Consultant";
          } else {
            facility = siteByCode("FSH")?.name ?? "FSH";
            holder = "Duty Coordinator";
          }
        } else if (service === "East Metro") {
          if (role.role === "Duty consultant") {
            facility = "Royal Perth / Bentley";
            holder = "On-Call Consultant";
          } else {
            facility = siteByCode("RPH")?.name ?? "RPH";
            holder = "Duty Coordinator";
          }
        } else if (service === "Private") {
          facility = "Private Facilities Liaison";
          holder = "Liaison Coordinator";
          statusTone = "accent";
          statusText = "Demonstration role";
        }

        items.push({
          id: role.id,
          service,
          role: role.role,
          facility,
          holder,
          shift: role.shift,
          statusText,
          statusTone,
        });
      }
    }

    return items;
  }, []);

  const filteredRosterItems = useMemo(() => {
    return enrichedRoster.filter((item) => {
      if (selectedService !== "all") {
        if (selectedService === "WACHS") return false;
        if (item.service !== selectedService) return false;
      }
      if (!normalizedQuery) return true;
      return (
        item.service.toLowerCase().includes(normalizedQuery) ||
        item.role.toLowerCase().includes(normalizedQuery) ||
        item.facility.toLowerCase().includes(normalizedQuery) ||
        item.holder.toLowerCase().includes(normalizedQuery) ||
        item.shift.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [enrichedRoster, selectedService, normalizedQuery]);

  const filteredDepartments = useMemo(() => {
    return departments.filter((department) => {
      const site = siteByCode(department.siteCode);
      if (selectedService !== "all" && site?.service !== selectedService) return false;
      if (!normalizedQuery) return true;
      return (
        department.name.toLowerCase().includes(normalizedQuery) ||
        (site?.name ?? "").toLowerCase().includes(normalizedQuery) ||
        (site?.service ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [departments, selectedService, normalizedQuery]);

  const showWachsNotice =
    (selectedService === "all" || selectedService === "WACHS") &&
    (!normalizedQuery || "wachs".includes(normalizedQuery) || "wa country health".includes(normalizedQuery));

  return (
    <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        {/*
         * Synthetic-data disclosure required across all Ward Flow screens.
         * Enforced by tests/ward-on-call-screen.dom.test.tsx and tests/ward-prototype-disclosure.test.ts
         */}
        <div className={styles.prototypeNoticeRow}>
          <span className={styles.prototypeBadge}>Simulated Roster</span>
          <p className={styles.prototypeNote}>
            Roles and shifts are invented. Contact details are not held. Not a medical device and not clinical decision
            support.
          </p>
        </div>

        {/* Sovereign Header */}
        <header className={styles.pageHeader}>
          <div className={styles.headerTitleBlock}>
            <p className={styles.eyebrow}>Statewide Specialist Coordination</p>
            <div className={styles.titleRow}>
              <h1 className={styles.pageTitle}>On-call and contacts</h1>
              <span className={styles.dutyChip}>
                <span className={styles.livePulse} aria-hidden="true" />
                Active Duty Roster
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic HUD Island derived from roster facts */}
        <WardDynamicIsland
          testId="ward-on-call-hud-island"
          title="On-Call Network"
          status={incompleteRoles ? "warning" : "nominal"}
          statusText={
            incompleteRoles
              ? `Incomplete recorded roles: ${counts.recorded} of ${counts.possible}`
              : "Prototype roles recorded; live coverage not verified"
          }
          ariaLabel="On-call management indicators"
          metrics={[
            {
              id: "kpi-bed-desk-lead",
              label: "Bed Desk Lead",
              value: "Role recorded",
              subtext: "20:00–08:00",
              tone: "accent",
            },
            {
              id: "kpi-duty-consultants",
              label: "Duty Consultants",
              value: consultantCount,
              subtext: "Prototype roles",
              tone: consultantCount > 0 ? "good" : "danger",
            },
            {
              id: "kpi-exec-escalation",
              label: "Executive Escalation",
              value: "Role recorded",
              tone: "warn",
            },
            {
              id: "kpi-ed-liaison",
              label: "ED Liaison",
              value: departments.length,
              subtext: "Departments recorded",
              tone: "good",
            },
          ]}
          actions={
            <button
              ref={triggerButtonRef}
              type="button"
              className={`${styles.btn} ${styles.dangerBtn}`}
              data-testid="ward-tier-3-escalate-btn"
              onClick={() => setEscalationOpen(true)}
              aria-label="Trigger Tier 3 Escalation"
            >
              <ShieldAlert size={14} aria-hidden="true" className={styles.btnIcon} />! Trigger Tier 3 Escalation
            </button>
          }
        />

        {/* Filter Bar & Fast Search */}
        <div className={styles.filterControlBar}>
          <div className={styles.filterBar} role="group" aria-label="Filter by Health Service">
            <button
              type="button"
              className={`${styles.filterBtn} ${selectedService === "all" ? styles.activeFilter : ""}`}
              onClick={() => setSelectedService("all")}
            >
              All Health Services ({HEALTH_SERVICES.length})
            </button>
            {HEALTH_SERVICES.map((service) => {
              const roleCount = SERVICE_ON_CALL_ROLES[service]?.length ?? 0;
              return (
                <button
                  key={service}
                  type="button"
                  className={`${styles.filterBtn} ${selectedService === service ? styles.activeFilter : ""}`}
                  onClick={() => setSelectedService(service)}
                >
                  {service} ({roleCount})
                </button>
              );
            })}
          </div>
          <div className={styles.searchWrap}>
            <Search size={14} aria-hidden="true" className={styles.searchIcon} />
            <input
              id={searchInputId}
              type="search"
              className={styles.searchInput}
              placeholder="Search roles, sites, departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search roster and emergency departments"
            />
          </div>
        </div>

        {/* Main Content Layout */}
        <div className={styles.contentGrid}>
          {/* Section 1: Specialist Medical & Operational On-Call Roster */}
          <section
            aria-labelledby="ward-on-call-now"
            className={`${styles.section} ${styles.nowPanel}`}
            data-testid="ward-on-call-now"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2 className={styles.sectionHeading} id="ward-on-call-now">
                  On-call now
                </h2>
              </div>
              <div className={styles.sectionHeaderMetaGroup}>
                <span className={styles.rosterCountBadge} data-testid="ward-on-call-count">
                  {counts.recorded} of {counts.possible} Roster Slots
                </span>
                <span className={styles.sectionMeta}>
                  <Clock size={12} aria-hidden="true" className={styles.metaIcon} />
                  Current Active Window (AWST)
                </span>
              </div>
            </div>

            <div className={styles.sectionBody} role="region" aria-label="On-call roster" tabIndex={0}>
              {/* Table of Active Specialist On-Call Roles */}
              <div className={styles.tableWrap}>
                <WardTable testId="ward-on-call-service-table" className={styles.rosterTable}>
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Role</th>
                      <th scope="col">Facility</th>
                      <th scope="col">Level</th>
                      <th scope="col">Shift</th>
                      <th scope="col">Status</th>
                      <th scope="col" className={styles.actionColHeader}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRosterItems.length > 0 ? (
                      filteredRosterItems.map((item) => (
                        <tr key={item.id} data-testid={`ward-on-call-role-${item.id}`}>
                          <td>
                            <strong>{item.service}</strong>
                          </td>
                          <td>
                            <div className={styles.roleCellTitle}>{item.role}</div>
                          </td>
                          <td>{item.facility}</td>
                          <td>
                            <span className={styles.holderTag}>{item.holder}</span>
                          </td>
                          <td className={styles.monoCell}>{item.shift}</td>
                          <td>
                            <span className={styles.badge} data-tone={item.statusTone}>
                              <span className={styles.statusDot} /> {item.statusText}
                            </span>
                          </td>
                          <td>
                            <button type="button" className={styles.actionBtn} onClick={handlePrototypeAction}>
                              <Phone size={12} aria-hidden="true" className={styles.actionIcon} />
                              Connect
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className={styles.emptyTableState}>
                          No specialist on-call roles match the current filter and search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </WardTable>
              </div>

              {/* Services with no recorded roles callout banner (Invariant & Test Hook) */}
              {showWachsNotice &&
                missing.map((service) => (
                  <div className={styles.gapCallout} key={service} data-testid={`ward-on-call-none-${service}`}>
                    <div className={styles.gapCalloutHeader}>
                      <AlertTriangle size={14} aria-hidden="true" className={styles.gapIcon} />
                      <strong>Coverage boundary note for {service}:</strong>
                    </div>
                    <p className={styles.gapCalloutText}>
                      No coordinator on call and no duty consultant is recorded for {service} in this prototype. Nothing
                      here knows whether somebody is on call for {service} &mdash; only that this software has not been
                      told.
                    </p>
                  </div>
                ))}
            </div>
          </section>

          {/* Section 2: Emergency Department Mental Health Liaison Direct Desks */}
          <section
            aria-labelledby="ward-on-call-ed"
            className={`${styles.section} ${styles.edPanel}`}
            data-testid="ward-on-call-ed"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2 className={styles.sectionHeading} id="ward-on-call-ed">
                  ED liaison, by department
                </h2>
                <span className={styles.sectionSubtitle}>Mental Health Liaison Desks</span>
              </div>
              <span className={styles.sectionMeta}>
                <Building2 size={12} aria-hidden="true" className={styles.metaIcon} />
                {departments.length} Emergency Desks
              </span>
            </div>

            <div className={styles.sectionBody} role="region" aria-label="ED liaison roster" tabIndex={0}>
              <p className={styles.note}>
                Departments, sites and health services from the shared directory.{" "}
                <strong>Contact details are not held or shown.</strong>
              </p>

              <div className={styles.tableWrap}>
                <WardTable
                  className={styles.edDirectoryTable}
                  wrapperClassName={styles.edDirectoryTableWrapper}
                  testId="ward-on-call-ed-table"
                >
                  <thead>
                    <tr>
                      <th scope="col">Department</th>
                      <th scope="col">Site</th>
                      <th scope="col">Health Service</th>
                      <th scope="col">Liaison Role</th>
                      <th scope="col">Handover</th>
                      <th scope="col" className={styles.actionColHeader}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepartments.length > 0 ? (
                      filteredDepartments.map((department) => {
                        const site = siteByCode(department.siteCode);
                        const isRph = department.id.toLowerCase().includes("rph");
                        const coordinatorTitle = isRph ? "Clinical Coordinator" : "Liaison Nurse Specialist";

                        return (
                          <tr key={department.id} data-testid={`ward-on-call-ed-row-${department.id}`}>
                            <td>
                              <strong>{department.name}</strong>
                            </td>
                            <td className={styles.siteCell}>{site?.name ?? "Regional Directory"}</td>
                            <td>
                              <span className={styles.serviceChip}>{site?.service ?? "Regional"}</span>
                            </td>
                            <td>
                              <span className={styles.coordinatorRole}>{coordinatorTitle}</span>
                            </td>
                            <td className={styles.monoCell}>07:00 / 15:00 / 23:00</td>
                            <td>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                                onClick={handlePrototypeAction}
                              >
                                <Radio size={12} aria-hidden="true" className={styles.actionIcon} />
                                Connect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className={styles.emptyTableState}>
                          No emergency department desks match the current filter or search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </WardTable>
              </div>
            </div>
          </section>

          {/* Section 3: Reaching a role */}
          <section
            aria-labelledby="ward-on-call-reaching"
            className={`${styles.section} ${styles.reachPanel}`}
            data-testid="ward-on-call-reaching"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2 className={styles.sectionHeading} id="ward-on-call-reaching">
                  Reaching a role
                </h2>
                <span className={styles.sectionSubtitle}>Clinical Routing Protocols</span>
              </div>
              <span className={styles.sectionMeta}>
                <ShieldCheck size={12} aria-hidden="true" className={styles.metaIcon} />
                Facility Switchboard Protocol
              </span>
            </div>

            <div className={styles.sectionBody} role="region" aria-label="How to reach an on-call role" tabIndex={0}>
              <p className={styles.note}>
                Use current site directories to reach a role. Contact details are not held in this system.
              </p>

              <div className={styles.reachProtocolGrid}>
                <div className={styles.protocolCard}>
                  <div className={styles.protocolCardHeader}>
                    <Building2 size={16} aria-hidden="true" className={styles.protocolIcon} />
                    <div className={styles.protocolTitle}>Hospital Switchboard</div>
                  </div>
                  <p className={styles.protocolDesc}>
                    Request Duty Psychiatry Registrar or On-Call Consultant via facility switchboard operator.
                  </p>
                </div>
                <div className={styles.protocolCard}>
                  <div className={styles.protocolCardHeader}>
                    <Layers size={16} aria-hidden="true" className={styles.protocolIcon} />
                    <div className={styles.protocolTitle}>Bed Coordination Desk</div>
                  </div>
                  <p className={styles.protocolDesc}>
                    Statewide adult psychiatric bed placement queries route through central coordinator desk.
                  </p>
                </div>
                <div className={styles.protocolCard}>
                  <div className={styles.protocolCardHeader}>
                    <Radio size={16} aria-hidden="true" className={styles.protocolIcon} />
                    <div className={styles.protocolTitle}>Emergency Department Liaison</div>
                  </div>
                  <p className={styles.protocolDesc}>
                    Urgent psychiatric triage in emergency departments connects through local ED liaison desk.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Data provenance and coverage */}
          <section
            aria-labelledby="ward-on-call-footer"
            className={`${styles.section} ${styles.footPanel}`}
            data-testid="ward-on-call-footer"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2 className={styles.sectionHeading} id="ward-on-call-footer">
                  Data provenance and coverage
                </h2>
                <span className={styles.sectionSubtitle}>Governance Architecture &amp; Reconciled Coverage</span>
              </div>
              <span className={styles.sectionMeta}>Governance &bull; Reconciled Coverage</span>
            </div>

            <div className={styles.sectionBody} role="region" aria-label="On-call data provenance" tabIndex={0}>
              <details className={`${styles.disclosureDetails} source-print`}>
                <summary>Sources, omissions and reconciliation</summary>
                <div className={styles.disclosureGrid}>
                  <div className={styles.disclosurePanel}>
                    <h3 className={styles.disclosureHeading}>What is real</h3>
                    <p className={styles.note}>
                      <strong>What is real</strong> &mdash; the emergency departments above, their hospital sites and
                      their health services, read from the same tables the rest of Ward Flow uses.
                    </p>
                  </div>
                  <div className={styles.disclosurePanel}>
                    <h3 className={styles.disclosureHeading}>What is not held at all</h3>
                    <p className={styles.note}>
                      <strong>What is not held at all</strong> &mdash; any way of contacting anybody. This prototype has
                      nowhere to keep a name, a number or a shift for a real person, so it keeps none and shows none.
                    </p>
                  </div>
                  <div className={styles.disclosurePanel}>
                    <h3 className={styles.disclosureHeading}>Reconciled coverage</h3>
                    <p className={styles.note}>
                      <strong>Reconciled</strong> &mdash; {counts.recorded} of {counts.possible} invented role slots are
                      recorded, and all {departments.length} emergency departments from the shared site table are listed
                      above.
                    </p>
                  </div>
                </div>
              </details>
            </div>
          </section>
        </div>

        {/* Tier 3 Escalation Modal */}
        {escalationOpen && (
          <div
            className={styles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="escalation-dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEscalationOpen(false);
                triggerButtonRef.current?.focus();
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEscalationOpen(false);
                triggerButtonRef.current?.focus();
              }
            }}
          >
            <div className={styles.modalDialog}>
              <div className={styles.modalHead}>
                <h3 id="escalation-dialog-title">Record Tier 3 escalation</h3>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => {
                    setEscalationOpen(false);
                    triggerButtonRef.current?.focus();
                  }}
                  aria-label="Close dialog"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.governanceNotice} data-testid="ward-on-call-escalation-notice">
                  <AlertTriangle size={14} aria-hidden="true" className={styles.noticeIcon} />
                  <span>
                    This records that the coordinator escalated. Only the movement, the contact role, and the units
                    already declined are stored. Nothing is sent.
                  </span>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor={contactSelectId}>
                    Role or service being contacted
                  </label>
                  <select
                    id={contactSelectId}
                    className={styles.formSelect}
                    value={escalationContact}
                    onChange={(event) => setEscalationContact(event.target.value as EscalationContact)}
                  >
                    {ESCALATION_CONTACTS.map((contact) => (
                      <option key={contact} value={contact}>
                        {contact}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor={referenceInputId}>
                    Movement reference
                  </label>
                  <input
                    id={referenceInputId}
                    type="text"
                    className={styles.formInput}
                    value={escalationReference}
                    onChange={(event) => setEscalationReference(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setEscalationOpen(false);
                    triggerButtonRef.current?.focus();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.dangerBtn}`}
                  data-testid="ward-on-call-escalation-submit"
                  onClick={recordTier3Escalation}
                >
                  Record Tier 3 escalation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Toast Feedback */}
        {toastMessage && (
          <div
            className={styles.toast}
            data-tone={toastTone}
            data-testid="ward-on-call-toast"
            role="status"
            aria-live="polite"
          >
            <span className={styles.toastIconWrapper}>
              {toastTone === "good" ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <AlertTriangle size={14} aria-hidden="true" />
              )}
            </span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Prototype disclosure footer */}
        <WardPrototypeFooter
          testId="ward-on-call-governance"
          note="Roles and shifts are synthetic · Contact details are not held · Not a medical device"
        />
      </main>
    </div>
  );
}
