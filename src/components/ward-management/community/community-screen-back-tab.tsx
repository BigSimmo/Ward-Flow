/*
 * The community team screen's third desktop list: expected back, discharged into the catchment,
 * and left another way. The referrals this team made are on the Sent tab
 * (`community-screen-sent-tab.tsx`, D-77 group A).
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { currentCareContact, currentCareContactCompleted } from "../ward-care-journey";
import { Field, Select, StatusGlyph } from "@/components/wf";
import { CommunityFollowUp } from "./community-follow-up";
import styles from "./community.module.css";
import { DEMO_COMMUNITY_EGRESS } from "./community-demo-cohort";
import { unitName, expectedBackLabel, departureLabel, otherDepartureDestinations } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** Tab 3: expected back, discharged into the catchment, and other departures. */
export function CommunityScreenBackTab({ view }: { view: CommunityScreenView }) {
  const {
    liveAdmissions,
    units,
    now,
    demoUmrnOf,
    team,
    followUpFilter,
    setFollowUpFilter,
    setActiveDrawer,
    setSelectedPatientId,
    egressFilter,
    setEgressFilter,
    isDemoMode,
    demoVisibleEgress,
    handleCompleteContact,
    lists,
    filteredDepartures,
    cannotResolve,
    activeTab,
  } = view;
  return (
    <div
      className={
        activeTab === "tab-egress" || activeTab === "tab-expected" ? styles.tabPanelActive : styles.tabPanelHidden
      }
      id="tab-egress"
      role="tabpanel"
      aria-labelledby="tabBtn-egress"
    >
      {/* ── Sovereign 7-Day Post-Discharge Register ── */}
      {isDemoMode && (
        <>
          <div className={styles.filterToolbar}>
            <div className={styles.filterChipsGroup}>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={egressFilter === "all"}
                onClick={() => setEgressFilter("all")}
              >
                <span>All egress</span>
                <span className={styles.badgePill}>{DEMO_COMMUNITY_EGRESS.length}</span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={egressFilter === "overdue"}
                onClick={() => setEgressFilter("overdue")}
              >
                <span>Overdue (priority follow-up)</span>
                <span className={`${styles.badgePill} ${styles.inkDanger}`}>
                  {DEMO_COMMUNITY_EGRESS.filter((e) => e.status === "overdue").length}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={egressFilter === "today"}
                onClick={() => setEgressFilter("today")}
              >
                <span>Due today</span>
                <span className={styles.badgePill}>
                  {DEMO_COMMUNITY_EGRESS.filter((e) => e.status === "today").length}
                </span>
              </button>
              <button
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={egressFilter === "upcoming"}
                onClick={() => setEgressFilter("upcoming")}
              >
                <span>Upcoming discharges</span>
                <span className={styles.badgePill}>
                  {DEMO_COMMUNITY_EGRESS.filter((e) => e.status === "upcoming").length}
                </span>
              </button>
            </div>
            <div className={styles.filterMeta}>7-day follow-up after discharge (example measure)</div>
          </div>

          <div className={styles.cardPanel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 3l4 5-4 5M13 8H3" />
                </svg>
                <span>7-day post-discharge follow-up register</span>
              </h2>
              <span className={styles.badgePill} id="egressHeadBadge">
                {demoVisibleEgress.length} Patients in 7-day window
              </span>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table} id="egressTable">
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Discharging unit</th>
                    <th scope="col">Discharge Date / Plan</th>
                    <th scope="col">Destination</th>
                    <th scope="col">7-Day KPI Window Status</th>
                    <th scope="col">Assigned coordinator</th>
                    <th scope="col" className={styles.cellEnd}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {demoVisibleEgress.map((egr) => {
                    const isContacted = liveAdmissions.some(
                      (admission) =>
                        admission.patientId === egr.patientId && currentCareContactCompleted(admission.careJourney),
                    );
                    return (
                      <tr
                        key={egr.id}
                        data-status={isContacted ? "completed" : egr.status}
                        data-pt-id={egr.patientId}
                        tabIndex={0}
                        onClick={() => {
                          setSelectedPatientId(egr.patientId);
                          setActiveDrawer("pxDrawer");
                        }}
                        onKeyDown={(event) => {
                          // Keys from the contact button inside the row stay with that button.
                          if (event.target !== event.currentTarget) return;
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          setSelectedPatientId(egr.patientId);
                          setActiveDrawer("pxDrawer");
                        }}
                        className={styles.clickable}
                      >
                        <td className={styles.cellNowrap}>
                          <b className={styles.patientIdWrap}>{demoUmrnOf(egr.patientId)}</b> ({egr.patientDetails})
                        </td>
                        <td>{egr.dischargingUnit}</td>
                        <td>{egr.dischargeDatePlan}</td>
                        <td>{egr.destination}</td>
                        <td>
                          <span
                            className={`${styles.statusPillBadge} ${isContacted ? styles.good : styles[egr.kpiTone]}`}
                          >
                            {isContacted ? "Completed" : egr.kpiStatusLabel}
                          </span>
                        </td>
                        <td>{egr.assignedCoordinator}</td>
                        <td className={styles.cellEnd} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={egr.isPrimaryAction ? styles.btnSmPrimary : styles.btnSmSec}
                            onClick={() => {
                              handleCompleteContact(egr.patientId);
                              if (!egr.isPrimaryAction) {
                                setSelectedPatientId(egr.patientId);
                                setActiveDrawer("pxDrawer");
                              }
                            }}
                          >
                            {isContacted ? "Contact logged" : egr.actionLabel}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── List 4, moved — of those, who the ward expects back ──────────────────────── */}
      <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
        <section className={styles.cardPanel} aria-label="Expected back" data-testid="ward-community-expected">
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <span>Expected back</span>
            </h3>
            <span className={styles.badgePill} data-ward-panel-count>
              {lists.expectedBack.length} of {lists.currentlyAdmitted.length}
            </span>
          </div>
          <div className={styles.panelBody} role="region" aria-label="Expected back details" tabIndex={0}>
            <p className={styles.count} data-testid="ward-community-expected-count">
              {lists.expectedBack.length} of the {lists.currentlyAdmitted.length}{" "}
              {lists.currentlyAdmitted.length === 1 ? "person" : "people"} above{" "}
              {lists.expectedBack.length === 1 ? "has" : "have"} a discharge date the ward has written down.
            </p>
            {/*
             * ⚠️ THE WORDING IS STILL CONSTRAINED BY ITS OWN GUARD, and deliberately. The natural
             * sentence here is "not a deadline, not a target, and a passed date is not overdue" —
             * words `tests/ward-community-hub.dom.test.tsx` refuses on sight, because a screen that
             * names a threshold in order to disclaim it has still put the word in front of a reader
             * who will remember the word. That guard did not go away when the date itself started
             * rendering: `expectedBackLabel` below says how long until the plan, or how long since it
             * passed, without ever spending the word "overdue" to do it. Saying what the elapsed time
             * IS, in either direction, carries the same meaning as naming a threshold and leaves
             * nothing to quote back.
             */}
            {/*
             * ⚠️ Corrected 2026-09-01, then acted on the same day: this justified the withheld date
             * first with a demonstration-clock defect and then with an unresolved product question.
             * Both are closed. `ward-reanchor.ts` shifts `expectedDischargeAt` with `now` (see this
             * file's header block), and the owner has since ruled that elapsed time should be shown.
             * A calendar date is still never printed — see the reason below.
             */}
            <p className={styles.footnote} data-testid="ward-community-expected-elapsed">
              Ward-reported plan; elapsed time only. No target is applied.
            </p>
            {lists.expectedBack.length === 0 ? (
              <p className={styles.emptyNote} data-testid="ward-community-expected-empty">
                {cannotResolve ? (
                  <>
                    A bed carries no link back to the referral that named this team, so this list cannot be built for{" "}
                    {team.name}.
                  </>
                ) : (
                  <>
                    No one referred to this team who is currently in a bed or has one pulled has a discharge date the
                    ward has written down.
                  </>
                )}
              </p>
            ) : (
              <ul className={styles.cardList} data-testid="ward-community-expected-list">
                {lists.expectedBack.map((admission) => (
                  <li
                    key={admission.id}
                    className={styles.card}
                    data-testid={`ward-community-expected-${admission.id}`}
                  >
                    <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                    <p className={styles.cardDetail}>{expectedBackLabel(admission, now)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── List 1, moved and renamed to the owner's wording — discharged into the area ── */}
        <section
          className={styles.cardPanel}
          aria-label="Discharged into the catchment"
          data-testid="ward-community-discharged"
        >
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <span>Discharged into the catchment</span>
            </h3>
            <span className={styles.badgePill} data-ward-panel-count>
              {lists.dischargedIntoTheArea.length}
            </span>
          </div>
          <div
            className={styles.panelBody}
            role="region"
            aria-label="Discharged into the catchment details"
            tabIndex={0}
          >
            {/*
             * Point 1. INSIDE the section and ABOVE the list, so it cannot be read past on the way to
             * an empty list, and worded as a statement about the record rather than as a caveat.
             *
             * Arrangements are recorded on the discharge board; this list remains all community
             * departures rather than a follow-up completion measure.
             */}
            <p className={styles.absenceNotice} data-testid="ward-community-follow-up-not-recorded">
              <StatusGlyph tone="warning" className={styles.noticeGlyph} />
              Follow-up arrangements and contact outcomes can be recorded for this team. An arrangement does not
              establish that contact occurred. All community departures shows recorded discharges into the community; an
              empty list does not establish that everybody is being followed up.
            </p>

            {/* Layout sweep MEET-15: the design-system field and select, as every other control here. */}
            <Field label="Community follow-up filter" className={styles.followUpFilter}>
              <Select value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value)}>
                <option value="all">All community departures</option>
                <option value="missing_arrangement">Missing arrangements</option>
                <option value="missing_contact">No completed contact recorded</option>
              </Select>
            </Field>
            {filteredDepartures.length === 0 ? (
              <p className={styles.emptyNote} data-testid="ward-community-discharged-empty">
                {lists.dischargedIntoTheArea.length > 0 ? (
                  <>No community departures match this follow-up filter.</>
                ) : cannotResolve ? (
                  <>
                    A bed carries no link back to the referral that named this team, so this list cannot be built for{" "}
                    {team.name}.
                  </>
                ) : (
                  <>No admission referred to this team is recorded as discharged to the community.</>
                )}
              </p>
            ) : (
              <ul className={styles.cardList} data-testid="ward-community-discharged-list">
                {filteredDepartures.map((admission) => (
                  <li
                    key={admission.id}
                    className={styles.card}
                    data-testid={`ward-community-discharged-${admission.id}`}
                  >
                    <p className={styles.cardUnit}>{unitName(admission.unitId, units)}</p>
                    <p className={styles.cardDetail}>{departureLabel(admission, now)}</p>
                    <p>
                      Follow-up: {admission.followUp?.state?.replaceAll("_", " ") ?? "Not recorded"} · Contact:{" "}
                      {currentCareContact(admission.careJourney)?.outcome?.replaceAll("_", " ") ?? "Not recorded"}
                    </p>
                    <CommunityFollowUp admissionId={admission.id} teamId={team.id} />
                  </li>
                ))}
              </ul>
            )}

            {/* Why the row above says HOW LONG AGO somebody left rather than a date — said here as
                    well as in the expected-back section, because a reader who scrolls straight to this
                    list would otherwise wonder why no calendar date appears.

                    ⚠️ Corrected 2026-09-01, then acted on the same day. This footnote used to justify
                    withholding the date, first with a demonstration-clock defect and then with an
                    unresolved product question. Both are closed: `ward-reanchor.ts` shifts `leftAt` with
                    `now` (see this file's header block), and the owner has since ruled that elapsed time
                    should be shown. A calendar date is still never printed — see the reason below. */}
            <p className={styles.footnote} data-testid="ward-community-departure-elapsed">
              Departure is shown as elapsed time; no calendar date is displayed.
            </p>
          </div>
        </section>

        {/* ── Left the ward another way — the owner's order asks for this as its own numbered
                 item. The paragraph below is the same one that used to sit as a footnote inside the
                 discharged panel above, word for word: it moved panel, not wording, and "the list
                 above" in its own text is still true because the discharged list still renders above
                 this panel on the page. ─────────────────────────────────────────────────────── */}
        <section
          className={styles.cardPanel}
          aria-label="Left the ward another way"
          data-testid="ward-community-other-departures-panel"
        >
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <span>Left the ward another way</span>
            </h3>
            <span className={styles.badgePill} data-ward-panel-count>
              {lists.otherDepartures.length}
            </span>
          </div>
          <div className={styles.panelBody} role="region" aria-label="Left the ward another way details" tabIndex={0}>
            {/*
             * 🔴 **THIS SENTENCE CONTRADICTED THE ONE ABOVE IT, ON EVERY TEAM BUT ONE.** The empty
             * state says the list CANNOT BE BUILT because a bed carries no link back to the
             * referral; this footnote then said "No other admission referred to this team has
             * ended" — **a conclusion drawn from the very data the sentence above says cannot be
             * assembled.** If the list cannot be built, the page cannot know that no other
             * admission has ended, and "no other has ended" is exactly the reassuring reading the
             * first sentence exists to prevent.
             *
             * ⚠️ **AND IT IS INVISIBLE FROM THE ONE TEAM WHERE IT IS CORRECT.** On Inner City
             * Clinic the join resolves, the list builds, and "no other" legitimately means "that is
             * all of them". The sentence is true in one arm and false in the other, **and which arm
             * a team is in differs per team** — which is why reading one team's page proves nothing
             * about another's, and why it took a second reader opening both.
             *
             * So it renders only where the list could be built. Found by Ward Builder Three.
             */}
            <p className={styles.absenceNotice} data-testid="ward-community-other-departures">
              <StatusGlyph tone="warning" className={styles.noticeGlyph} />
              {cannotResolve
                ? "Whether any other admission referred to this team has ended cannot be told from the record either, for the same reason."
                : lists.otherDepartures.length === 0
                  ? "No other admission referred to this team has ended."
                  : `${lists.otherDepartures.length} other ${
                      lists.otherDepartures.length === 1 ? "admission" : "admissions"
                    } referred to this team ${lists.otherDepartures.length === 1 ? "has" : "have"} ended, recorded as: ${otherDepartureDestinations(lists.otherDepartures)}. None of those records says the person came back into the community, so none is on the list above.`}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
