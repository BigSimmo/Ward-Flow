/*
 * The community team screen's side panels and prompt lists: search, notices, since you looked, how
 * to reach, on duty, coverage, and the two Worth attention lists. Each is built from the screen's
 * view on every render, the same element the screen used to build inline, so a panel that renders
 * nothing is still `null`.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { Badge, SinceYouLooked, StatusGlyph, TextInput, type WfTone } from "@/components/wf";
import { ratifiedSameServiceNames } from "@/components/ward-management/community/community-ratified-aliases";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { daysBetween, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import {
  contactDecisionFor,
  contactForTeam,
} from "@/components/ward-management/community/community-team-contact-mapping";
import { REFERENCE_TEAM_CAVEAT } from "@/components/ward-management/reference/ward-reference-teams";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import styles from "./community.module.css";
import phoneCss from "./community-team-phone.module.css";
import v6 from "./community-team-v6.module.css";
import { DEMO_COMMUNITY_STAFF } from "./community-demo-cohort";
import { teamSinceItems, elapsedSinceOrUnderADay } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** Search results shown at once; the rest are reached by typing more of the name or UMRN. */
const SEARCH_RESULT_LIMIT = 8;

/**
 * The side column's sample roster (v6 "On duty today"). Illustrative only, the same eight example
 * roles the page carried before, by role rather than by name. No caseload counts: those were
 * invented figures with nothing behind them.
 */
const SAMPLE_ROSTER: readonly {
  initials: string;
  role: string;
  detail: string;
  status: "On duty" | "In field" | "At base";
  lead?: boolean;
}[] = [
  {
    initials: "SC",
    role: "Consultant psychiatrist",
    detail: "Catchment lead · clinic room 2",
    status: "On duty",
    lead: true,
  },
  { initials: "KR", role: "Senior registrar", detail: "Vehicle 1 · co-response", status: "In field" },
  { initials: "JL", role: "Medical officer", detail: "Clinic room 1 · physical health reviews", status: "On duty" },
  { initials: "KV", role: "Nurse unit manager", detail: "Coordination · triage allocation", status: "On duty" },
  { initials: "TB", role: "Registered nurse", detail: "Depot and crisis · vehicle 1", status: "In field" },
  { initials: "CD", role: "RN case manager", detail: "Home visits", status: "On duty" },
  { initials: "MD", role: "Senior social worker", detail: "Housing and NDIS liaison", status: "At base" },
  { initials: "EW", role: "Occupational therapist", detail: "Recovery assessments", status: "At base" },
];

const ROSTER_TONE: Record<(typeof SAMPLE_ROSTER)[number]["status"], WfTone> = {
  "On duty": "success",
  "In field": "info",
  "At base": "neutral",
};

/** Desktop "Worth attention" lines, each derived from the lists the page already shows. */
export function communityAttentionItems(view: CommunityScreenView) {
  const {
    now,
    identityOf,
    lists,
    waitingReferrals,
    pastPlannedDateCount,
    admittedWhileAlreadyWithTeam,
    shortestAcceptanceToAdmissionGap,
  } = view;
  /*
   * "Worth your attention" — every entry derived from the arrays already computed above, never a
   * new figure invented for the rail. Each condition is independent, so a quiet team with nothing
   * to flag renders none of them rather than a padded list, and the panel says so in words.
   */
  const attentionItems: ReactNode[] = [];
  if (waitingReferrals.length > 0) {
    const oldest = waitingReferrals[0];
    attentionItems.push(
      <>
        <strong>{identityOf(oldest)}</strong> has waited {referralWaitLine(oldest, now)} for an answer from this team —
        the longest of the {waitingReferrals.length} referral{waitingReferrals.length === 1 ? "" : "s"} waiting.
      </>,
    );
  }
  if (shortestAcceptanceToAdmissionGap) {
    const { admission, acceptedAt, arrivedAt } = shortestAcceptanceToAdmissionGap;
    attentionItems.push(
      <>
        <strong>{identityOf(admission)}</strong> was admitted{" "}
        {elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} after this team accepted them — the shortest gap
        of the {admittedWhileAlreadyWithTeam.length} admitted while already with this team, and the one worth checking
        first.
      </>,
    );
  }
  if (pastPlannedDateCount > 0) {
    attentionItems.push(
      <>
        {pastPlannedDateCount} of the {lists.expectedBack.length} planned discharge{" "}
        {lists.expectedBack.length === 1 ? "date has" : "dates have"} already passed for people this team can see.
      </>,
    );
  }
  return attentionItems;
}

/** The same prompts for the phone and the desktop rail, naming the person by name and UMRN. */
export function communityPhoneAttentionItems(view: CommunityScreenView) {
  const {
    now,
    lists,
    waitingReferrals,
    pastPlannedDateCount,
    admittedWhileAlreadyWithTeam,
    shortestAcceptanceToAdmissionGap,
    phonePerson,
    phoneName,
  } = view;
  // Phone attention rows: the same four conditions as desktop, naming the person (UMRN) rather than
  // a referral or admission id, as one bold line and one quiet line.
  const phoneAttentionItems: ReactNode[] = [];
  if (waitingReferrals.length > 0) {
    const oldest = waitingReferrals[0];
    const person = phonePerson(oldest.patientId);
    phoneAttentionItems.push(
      <>
        <strong>Waiting {referralWaitLine(oldest, now)} for an answer</strong>
        <span className={phoneCss.attentionMeta}>
          {phoneName(person, "No person on file")} · longest of {waitingReferrals.length} waiting
        </span>
      </>,
    );
  }
  if (shortestAcceptanceToAdmissionGap) {
    const { admission, acceptedAt, arrivedAt } = shortestAcceptanceToAdmissionGap;
    const person = phonePerson(admission.patientId);
    phoneAttentionItems.push(
      <>
        <strong>Admitted {elapsedSinceOrUnderADay(daysBetween(acceptedAt, arrivedAt))} after this team accepted</strong>
        <span className={phoneCss.attentionMeta}>
          {phoneName(person, "No person on file")} · {person?.umrn ?? "No UMRN"} · shortest of{" "}
          {admittedWhileAlreadyWithTeam.length}
        </span>
      </>,
    );
  }
  if (pastPlannedDateCount > 0) {
    phoneAttentionItems.push(
      <>
        <strong>
          {pastPlannedDateCount} planned discharge {pastPlannedDateCount === 1 ? "date has" : "dates have"} passed
        </strong>
        <span className={phoneCss.attentionMeta}>Of {lists.expectedBack.length} expected back</span>
      </>,
    );
  }
  return phoneAttentionItems;
}

/** The sample-patient search, as a render function its popover or phone sheet calls with close. */
export function communitySearchRenderer(view: CommunityScreenView) {
  const { setActiveDrawer, setSelectedPatientId, searchQuery, setSearchQuery, searchResults } = view;
  const renderSearch = (close: () => void) => (
    <div className={v6.search}>
      <TextInput
        type="search"
        id="q"
        icon={Search}
        aria-label="Search sample patients"
        placeholder="Type UMRN or name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClear={() => setSearchQuery("")}
      />
      {searchQuery.trim() === "" ? (
        <p className={v6.searchNote} data-testid="ward-community-search-hint">
          Type a name or UMRN to search the sample patients.
        </p>
      ) : searchResults.length === 0 ? (
        <p className={v6.searchNote} data-testid="ward-community-search-empty">
          No sample patient matches &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <ul className={v6.searchList}>
          {searchResults.slice(0, SEARCH_RESULT_LIMIT).map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                className={v6.searchHit}
                data-testid={`ward-community-search-hit-${patient.id}`}
                onClick={() => {
                  setSelectedPatientId(patient.id);
                  setActiveDrawer("pxDrawer");
                  close();
                }}
              >
                <span className={v6.searchHitTop}>
                  <strong>
                    {patientDisplayName(patient)} · {patient.umrn}
                  </strong>
                  <Badge size="sm">{patient.legalStatus ?? "Legal status not recorded"}</Badge>
                </span>
                <span className={v6.searchHitMeta}>
                  {patient.catchmentCommunityTeam ?? "Community team not recorded"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return renderSearch;
}

/** This team's notices, newest first, or null when there are none. */
export function communityNoticesSection(view: CommunityScreenView) {
  const { now, umrnLookup, teamNotices, unreadTeamNoticeCount, markTeamNoticeRead } = view;
  const noticesSection =
    teamNotices.length > 0 ? (
      <section aria-label="Notices for this team" data-testid="ward-community-notices">
        <p className={styles.teamNoticesHead}>
          Notices <span>· {unreadTeamNoticeCount} unread</span>
        </p>
        <ol className={styles.teamNoticesFeed}>
          {teamNotices.map((notice) => {
            const isRead = notice.readAt !== undefined;
            return (
              <li key={notice.id} data-notice-read={isRead}>
                <time>{formatInstantWithDay(notice.raisedAt, now)}</time>
                <div className={styles.teamNoticeContent}>
                  <span>{withUmrnInPlaceOfMovementIds(notice.sentence, umrnLookup)}</span>
                  {isRead ? (
                    <span className={styles.teamNoticeReadLabel}>
                      <span className={styles.readDot} aria-hidden="true" />
                      Read
                    </span>
                  ) : (
                    <div className={styles.noticeStatusActionRow}>
                      <span className={styles.alertBadge}>
                        <span className={styles.alertDot} aria-hidden="true" />
                        Unread
                      </span>
                      <button
                        type="button"
                        className={styles.teamNoticeMarkRead}
                        onClick={() => markTeamNoticeRead(notice.id)}
                      >
                        Mark as read
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    ) : null;
  return noticesSection;
}

/** Since the start of this shift, folded to one quiet line when nothing changed. */
export function communitySinceElement(view: CommunityScreenView) {
  const { now, team, toast, sourceReferrals, waitingReferrals } = view;
  // Device audit option A: a digest of all zeros folds to one quiet line.
  const sinceQuiet = teamSinceItems(
    sourceReferrals,
    [team.name, ...ratifiedSameServiceNames(team.name)],
    currentShiftStartInstant(now),
    now,
    waitingReferrals.length,
  ).every((item) => item.value === 0);
  const sinceElement = sinceQuiet ? (
    <p className={phoneCss.quietLine} id="ward-community-since" data-testid="ward-community-since-quiet">
      <StatusGlyph tone="neutral" size={9} /> No changes since the start of this shift.
    </p>
  ) : (
    <SinceYouLooked
      id="ward-community-since"
      className={v6.since}
      // This page renders elapsed time, never a clock face (owner ruling), so the window is named.
      since="the start of this shift"
      items={teamSinceItems(
        sourceReferrals,
        [team.name, ...ratifiedSameServiceNames(team.name)],
        currentShiftStartInstant(now),
        now,
        waitingReferrals.length,
      )}
      onCopy={() => {
        const lines = teamSinceItems(
          sourceReferrals,
          [team.name, ...ratifiedSameServiceNames(team.name)],
          currentShiftStartInstant(now),
          now,
          waitingReferrals.length,
        ).map((item) => `${item.value} ${item.word}`);
        const text = `${team.name}, since the start of this shift (synthetic prototype): ${lines.join(", ")}.`;
        void navigator.clipboard?.writeText(text).then(
          () => toast?.push({ tone: "success", title: "Copied as handover text" }),
          () => toast?.push({ tone: "warning", title: "Could not copy", body: text }),
        );
      }}
    />
  );
  return sinceElement;
}

/** How to reach this team, from the published contact register only. */
export function communityHowToReachPanel(view: CommunityScreenView) {
  const { team, isDemoMode } = view;
  const howToReachPanel = (
    <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
      {(() => {
        const contact = contactForTeam(team.name);
        const decision = contactDecisionFor(team.name);
        return (
          <section className={v6.sideCard} aria-label="How to reach this team" data-testid="ward-community-contact">
            <div className={v6.sideHead}>
              <h3 className={v6.sideTitle}>How to reach</h3>
              {contact === null ? null : <span className={v6.sideMeta}>Published, not call-tested</span>}
            </div>
            <div className={v6.sideBody} role="region" aria-label="How to reach this team details">
              {contact === null ? (
                <p className={v6.sideNote}>
                  Nobody has yet recorded which real service this name refers to, so no contact detail is shown. That is
                  not a statement that this team has no phone number.
                </p>
              ) : (
                <>
                  <dl className={v6.keyValues} data-testid="ward-community-contact-detail">
                    {contact.publishedPhone === null ? null : (
                      <div>
                        <dt>Phone</dt>
                        <dd className={v6.mono}>
                          <a href={`tel:${contact.publishedPhone.replace(/[^\d+]/g, "")}`}>{contact.publishedPhone}</a>
                        </dd>
                      </div>
                    )}
                    {contact.publishedHours === null ? null : (
                      <div>
                        <dt>Hours</dt>
                        <dd>{contact.publishedHours}</dd>
                      </div>
                    )}
                    {contact.referralEmail === null ? null : (
                      <div>
                        <dt>Referrals</dt>
                        <dd>
                          <a href={`mailto:${contact.referralEmail}`}>{contact.referralEmail}</a>
                        </dd>
                      </div>
                    )}
                    {contact.address === null ? null : (
                      <div>
                        <dt>Address</dt>
                        <dd>{contact.address}</dd>
                      </div>
                    )}
                  </dl>
                  <p className={v6.sideNote}>{REFERENCE_TEAM_CAVEAT}</p>
                  <p className={v6.sideNote}>
                    Recorded {contact.recordedOn ?? "on a date the register does not give"}
                    {decision === null
                      ? null
                      : `. Paired with ${decision.serviceName} by ${decision.decidedBy} on ${decision.decidedOn}.`}
                  </p>
                </>
              )}
            </div>
          </section>
        );
      })()}
    </div>
  );
  return howToReachPanel;
}

/** The illustrative roster, rooms and vehicles. Sample content, never a record. */
export function communityOnDutyPanel(view: CommunityScreenView) {
  const { team, isDemoMode, teamConfig } = view;
  const onDutyPanel = isDemoMode ? (
    <>
      <div className={styles.cardPanel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM11.5 8a2 2 0 100-4 2 2 0 000 4zM1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M10.5 10.5c2 .3 3.5 1.6 3.5 3.5" />
            </svg>
            <span>Catchment Multidisciplinary Team Roster &amp; Duty Allocations</span>
          </h2>
          <span className={styles.badgePill} id="teamStaffCountBadge">
            {teamConfig.staff} Key Clinicians Active
          </span>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.teamRosterGrid}>
            {DEMO_COMMUNITY_STAFF.map((staff) => (
              <div key={staff.name} className={styles.staffCard}>
                <div className={styles.staffHead}>
                  <div>
                    <div
                      className={styles.staffName}
                      id={staff.name === "Dr A. Nair" ? "leadConsultantName" : undefined}
                    >
                      {staff.name === "Dr A. Nair" ? teamConfig.consultant : staff.name}
                    </div>
                    <div className={styles.staffRole}>{staff.role}</div>
                  </div>
                  <span className={`${styles.statusPillBadge} ${styles[staff.statusTone]}`}>{staff.status}</span>
                </div>
                <div className={styles.staffMetrics}>
                  <span>
                    Caseload: <b>{staff.caseload}</b>
                  </span>
                  <span>
                    Ext: <b>{staff.ext}</b>
                  </span>
                  <span>{staff.assignment}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.clinicFleetGrid}>
        <div className={styles.cardPanel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
              Clinic Room Utilization
            </h3>
            <span className={styles.badgePill}>3 Rooms Active</span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.clinicRoomItem}>
              <div className={styles.clinicRoomTop}>
                <span className={styles.clinicRoomTitle}>Room 1 · Consultant Clinic</span>
                <span className={`${styles.statusPillBadge} ${styles.good}`}>9am – 1pm</span>
              </div>
              <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                Dr K. Rao · Urgent Intakes &amp; Medication Reviews
              </span>
            </div>
            <div className={styles.clinicRoomItem}>
              <div className={styles.clinicRoomTop}>
                <span className={styles.clinicRoomTitle}>Room 2 · Depot &amp; Physical Health</span>
                <span className={`${styles.statusPillBadge} ${styles.good}`}>9am – 5pm</span>
              </div>
              <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                RN C. Davis · Long-acting injections, ECG, metabolic monitoring
              </span>
            </div>
            <div className={styles.clinicRoomItem}>
              <div className={styles.clinicRoomTop}>
                <span className={styles.clinicRoomTitle}>Room 3 · Crisis Walk-in &amp; Triage</span>
                <span className={`${styles.statusPillBadge} ${styles.warn}`}>Active Standby</span>
              </div>
              <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                Dr J. Lim · Urgent walk-in community assessments
              </span>
            </div>
          </div>
        </div>

        <div className={styles.cardPanel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle} style={{ fontSize: "var(--t-2)" }}>
              Mobile Outreach Vehicles
            </h3>
            <span className={styles.badgePill}>2 Vehicles</span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.clinicRoomItem}>
              <div className={styles.clinicRoomTop}>
                <span className={styles.clinicRoomTitle} id="fleetVehicle1Title">
                  {teamConfig.fleet1}
                </span>
                <span className={`${styles.statusPillBadge} ${styles.warn}`}>In Field</span>
              </div>
              <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                Staff: T. Bradley RN &amp; Dr J. Lim · Scheduled Home Visits
              </span>
            </div>
            <div className={styles.clinicRoomItem}>
              <div className={styles.clinicRoomTop}>
                <span className={styles.clinicRoomTitle} id="fleetVehicle2Title">
                  {teamConfig.fleet2}
                </span>
                <span className={`${styles.statusPillBadge} ${styles.good}`}>At Base</span>
              </div>
              <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                Staff: M. Davies SW · Available for Urgent Dispatch
              </span>
            </div>
            <div className={styles.clinicRoomItem}>
              <div className={styles.clinicRoomTop}>
                <span className={styles.clinicRoomTitle}>Morning MDT Huddle Log</span>
                <span className={`${styles.statusPillBadge} ${styles.neutral}`}>10am Completed</span>
              </div>
              <span style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>
                14 Catchment cases reviewed · 2 Inpatient transfers coordinated
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  ) : (
    <section
      className={v6.sideCard}
      id="section-team-workspace"
      aria-labelledby="ward-community-roster-title"
      data-testid="ward-community-roster"
    >
      <div className={v6.sideHead}>
        <h3 id="ward-community-roster-title" className={v6.sideTitle}>
          On duty today
        </h3>
        <span id="teamStaffCountBadge" className={v6.sideMeta}>
          Sample roster
        </span>
      </div>
      <p className={v6.sampleNote} role="note">
        Illustrative staffing and logistics only. These are not roster, huddle, room or vehicle records for
        {` ${team.name}`}.
      </p>
      <ul className={v6.roster} aria-label="Sample roster, illustrative">
        {SAMPLE_ROSTER.map((member) => (
          <li key={member.role} className={v6.rosterRow}>
            <span className={v6.initials} aria-hidden="true">
              {member.initials}
            </span>
            <span className={v6.rosterWho}>
              <span className={v6.rosterRole} id={member.lead ? "leadConsultantName" : undefined}>
                {member.role}
              </span>
              <span className={v6.rosterDetail}>{member.detail}</span>
            </span>
            <span className={v6.rosterStatus}>
              <StatusGlyph tone={ROSTER_TONE[member.status]} size={9} />
              {member.status}
            </span>
          </li>
        ))}
      </ul>
      <details className={v6.sampleMore}>
        <summary>Sample rooms and vehicles</summary>
        <ul className={v6.sampleList} aria-label="Sample clinic rooms and vehicles, illustrative">
          <li>
            <span>Clinic room 1 · depot clinic</span>
            <span className={v6.rosterDetail}>Active</span>
          </li>
          <li>
            <span>Clinic room 2 · consultant reviews</span>
            <span className={v6.rosterDetail}>Active</span>
          </li>
          <li>
            <span>Clinic room 3 · urgent intake</span>
            <span className={v6.rosterDetail}>Standby</span>
          </li>
          <li>
            <span id="fleetVehicle1Title">Outreach vehicle 1 (dual crew)</span>
            <span className={v6.rosterDetail}>In field</span>
          </li>
          <li>
            <span id="fleetVehicle2Title">Outreach vehicle 2 (secondary)</span>
            <span className={v6.rosterDetail}>At base</span>
          </li>
        </ul>
      </details>
    </section>
  );
  return onDutyPanel;
}

/** Provenance, coverage limits and team facts: what this page can and cannot tell you. */
export function communityCoveragePanel(view: CommunityScreenView) {
  const {
    limitsDisclosureRef,
    team,
    isDemoMode,
    unattributable,
    nearDuplicates,
    sameService,
    ratifiedBy,
    waitlistedForTeam,
    suburbsNamingTeam,
  } = view;
  const coveragePanel = (
    <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
      <details ref={limitsDisclosureRef} className={styles.governanceSection} data-testid="ward-community-limits" open>
        <summary className={styles.governanceSummary}>Provenance, coverage limits and team facts</summary>
        <div className={styles.governanceBody}>
          {/* Coverage limits */}
          <div className={styles.cardPanel}>
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>
                <span>Coverage limits</span>
              </h3>
            </div>
            <div className={styles.panelBody} role="region" aria-label="Coverage limits details" tabIndex={0}>
              <ul className={styles.limitsList}>
                <li>
                  <strong>Completeness.</strong> Only admissions linked to a referral this page can find are shown;{" "}
                  <span>{unattributable.length}</span> {unattributable.length === 1 ? "admission is" : "admissions are"}{" "}
                  counted rather than shown.
                </li>
                <li>
                  <strong>Current care.</strong> No community-team closure is recorded, so prior acceptance does not
                  establish current care.
                </li>
                <li>
                  <strong>Follow-up.</strong> Follow-up arrangements and contact outcomes can be recorded for this team
                  on the Back in the community tab.
                </li>
                <li>
                  <strong>Referrals raised.</strong> Community sources carry no team name.
                </li>
                <li>
                  <strong>Population.</strong> This is a destination-team view, not a geographic population view.
                </li>
                <li>
                  <strong>Dates.</strong> Elapsed time is shown instead of synthetic calendar dates.
                </li>
              </ul>
            </div>
          </div>

          {/* This team facts */}
          <div className={styles.cardPanel} data-testid="ward-community-facts">
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>
                <span>This team facts</span>
              </h3>
            </div>
            <div className={styles.panelBody} role="region" aria-label="This team details" tabIndex={0}>
              <dl className={styles.factsList}>
                <div className={styles.factsRow}>
                  <dt>Name recorded as</dt>
                  <dd>{team.name}</dd>
                </div>
                <div className={styles.factsRow}>
                  <dt>Suburbs naming it</dt>
                  <dd data-testid="ward-community-suburb-count">
                    {suburbsNamingTeam === undefined ? "Not derivable from the catchment table" : suburbsNamingTeam}
                  </dd>
                </div>
                <div className={styles.factsRow}>
                  <dt>Entries that read alike</dt>
                  <dd>{nearDuplicates.length}</dd>
                </div>
                <div className={styles.factsRow}>
                  <dt>Hours, contacts, staffing</dt>
                  <dd>Published contacts held; roster not held</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Quick links */}
          <div className={styles.cardPanel} data-testid="ward-community-links">
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>
                <span>Go to</span>
              </h3>
            </div>
            <div className={styles.panelBody} role="region" aria-label="Go to links" tabIndex={0}>
              <ul className={styles.linksList}>
                <li>
                  <Link className={styles.linksItem} href="/mockups/ward-flow/community">
                    All community teams
                  </Link>
                </li>
                <li>
                  <Link className={styles.linksItem} href={WARD_REFERRAL_INTAKE_HREF}>
                    New referral
                  </Link>
                </li>
                <li>
                  <Link className={styles.linksItem} href="/mockups/ward-flow/referrals">
                    Referrals
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Provenance and matching limits */}
          <div
            className={styles.aboutPage}
            data-testid="ward-community-about"
            aria-label="Community data provenance and matching limits"
          >
            <div className={styles.noticeGroup}>
              <p className={styles.notice} data-testid="ward-community-placeholder-notice">
                <strong>This team name comes from the S2015 catchment table.</strong> It is referral vocabulary, not a
                current roster of Western Australian community services. No team has agreed to be represented and this
                page does not identify who currently provides care.{" "}
                {nearDuplicates.length > 0 ? (
                  <strong data-testid="ward-community-near-duplicate-warning">
                    {" "}
                    That document also spells some teams more than one way, and this is one of them: it also contains{" "}
                    {nearDuplicates.map((name, index) => (
                      <span key={name}>
                        {index > 0 ? (index === nearDuplicates.length - 1 ? " and " : ", ") : ""}
                        <span className={styles.fieldName}>{name}</span>
                      </span>
                    ))}
                    {nearDuplicates[nearDuplicates.length - 1].endsWith(".") ? "" : "."} Those are separate pages here,
                    and each reports only the people whose referral was typed its way — so somebody referred to this
                    team under another spelling is on that page and not on this one.
                  </strong>
                ) : null}
              </p>

              {sameService.length > 0 && ratifiedBy !== undefined ? (
                <p className={styles.ratifiedNotice} data-testid="ward-community-ratified-alias">
                  <strong>
                    {ratifiedBy.decidedByKind === "person"
                      ? "A person has ruled that this team and "
                      : "This team has been recorded as the same service as "}
                    {sameService.map((name, index) => (
                      <span key={name}>
                        {index > 0 ? (index === sameService.length - 1 ? " and " : ", ") : ""}
                        <span className={styles.fieldName}>{name}</span>
                      </span>
                    ))}
                    {ratifiedBy.decidedByKind === "person" ? " are one service." : ", pending review."}
                  </strong>{" "}
                  This is a judgement about the real clinic, not an observation that the names look alike. No rule here
                  could have reached it and none did. Referrals typed under each spelling are still listed on that
                  spelling&apos;s own page: the decision is recorded, and nobody has been moved.
                  <span className={styles.ratifiedProvenance} data-testid="ward-community-ratified-provenance">
                    {ratifiedBy.decidedByKind === "person" ? (
                      <>
                        Decided by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}, after being shown each spelling and
                        the suburbs it routes.
                      </>
                    ) : (
                      <>
                        Recorded by {ratifiedBy.decidedBy} on {ratifiedBy.decidedOn}. No person has seen these spellings
                        or the suburbs they route, and this entry is waiting to be reviewed. Treat it as a working note,
                        not as a decision anyone has signed.
                      </>
                    )}
                  </span>
                </p>
              ) : null}

              <p className={styles.notice} data-testid="ward-community-unattributable">
                <strong>
                  {unattributable.length}{" "}
                  {unattributable.length === 1
                    ? "admission is on no community team's page"
                    : "admissions are on no community team's page"}
                  .
                </strong>{" "}
                Only admissions linked to a referral naming this team appear here. Admissions without a matching
                referral, or whose referral asked only for a bed or emergency department, appear on no team page. This
                is not a geographic or complete population view.
              </p>
            </div>

            <p className={styles.provenance} data-testid="ward-community-association">
              Matches use the destination team written on the referral, never home region. A later decline or
              cancellation does not remove that association.{" "}
              <strong>
                {waitlistedForTeam.length}{" "}
                {waitlistedForTeam.length === 1
                  ? "admission is matched to this team and still waitlisted"
                  : "admissions are matched to this team and still waitlisted"}
                .
              </strong>{" "}
              {waitlistedForTeam.length === 1 ? "That person has" : "Those people have"} no pulled bed, so they appear
              in neither admitted list nor the unmatched count. A waitlisted match is still a match.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
  return coveragePanel;
}
