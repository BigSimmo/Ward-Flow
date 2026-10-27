/*
 * The community team screen's first desktop list: referrals waiting for this team's answer, with
 * accept and decline, and Worth attention.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { ReferralIntakeSummary } from "../referrals/referral-intake-summary";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { communityDeclineBlockedReason } from "@/components/ward-management/community/community-blocked-reasons";
import { COMMUNITY_DECLINE_REASONS, type CommunityDeclineReason } from "@/components/ward-management/ward-model";
import { COMMUNITY_DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { DisabledReason } from "@/components/wf";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import styles from "./community.module.css";
import { referralOriginLabel } from "./community-screen-helpers";
import { communityAttentionItems } from "./community-screen-panels";
import type { CommunityScreenView } from "./community-screen";

/** Tab 1: the team's own queue of referrals waiting for its answer. */
export function CommunityScreenWaitingTab({ view }: { view: CommunityScreenView }) {
  const {
    patients,
    now,
    identityOf,
    demoUmrnOf,
    declineOpenFor,
    declineDraft,
    setDeclineDraft,
    setToastMessage,
    setActiveDrawer,
    setSelectedPatientId,
    setSelectedReferralId,
    setPendingAcceptance,
    setAcceptanceError,
    triageFilter,
    setTriageFilter,
    isDemoMode,
    demoTeamReferrals,
    demoVisibleReferrals,
    handleActionClick,
    handleToggleDecline,
    handleConfirmDecline,
    handleConfirmAccept,
    declineSave,
    waitingReferrals,
    p1ReferralsCount,
    p2ReferralsCount,
    p3ReferralsCount,
    edReferralsCount,
    visibleWaitingReferrals,
    hasAnyReferralsForTeam,
    activeTab,
  } = view;
  const attentionItems = communityAttentionItems(view);
  return (
    <div
      className={activeTab === "tab-triage" ? styles.tabPanelActive : styles.tabPanelHidden}
      id="tab-triage"
      role="tabpanel"
      aria-labelledby="tabBtn-triage"
    >
      {/* ── Referrals addressed to this team, not yet answered — the team's own queue ── */}
      <section
        className={isDemoMode ? styles.workspaceSection : styles.cardPanel}
        aria-label="Waiting for the team's answer"
        data-testid="ward-community-waiting"
      >
        {!isDemoMode && (
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>
              <span>Waiting for the team&apos;s answer</span>
            </h2>
            <span className={styles.badgePill} data-ward-panel-count>
              {waitingReferrals.length}
            </span>
          </div>
        )}
        <div
          className={isDemoMode ? styles.workspaceBody : styles.panelBody}
          role="region"
          aria-label="Waiting for the team's answer details"
          tabIndex={0}
        >
          {waitingReferrals.length === 0 && isDemoMode && demoTeamReferrals.length > 0 && !hasAnyReferralsForTeam ? (
            <>
              <div className={styles.filterToolbar}>
                <div className={styles.filterChipsGroup}>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={triageFilter === "all"}
                    onClick={() => setTriageFilter("all")}
                  >
                    <span>All referrals</span>
                    <span className={styles.badgePill} id="chipAllRefBadge">
                      {demoTeamReferrals.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={triageFilter === "p1"}
                    onClick={() => setTriageFilter("p1")}
                  >
                    <span>Priority 1 immediate</span>
                    <span className={`${styles.badgePill} ${styles.inkDanger}`} id="chipP1Badge">
                      {demoTeamReferrals.filter((r) => r.urgency === 1).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={triageFilter === "p2"}
                    onClick={() => setTriageFilter("p2")}
                  >
                    <span>Priority 2 urgent</span>
                    <span className={styles.badgePill} id="chipP2Badge">
                      {demoTeamReferrals.filter((r) => r.urgency === 2).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={triageFilter === "p3"}
                    onClick={() => setTriageFilter("p3")}
                  >
                    <span>Priority 3 routine</span>
                    <span className={styles.badgePill} id="chipP3Badge">
                      {demoTeamReferrals.filter((r) => r.urgency === 3).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.chipFilterBtn}
                    aria-pressed={triageFilter === "ed"}
                    onClick={() => setTriageFilter("ed")}
                  >
                    <span>ED Liaison &amp; Crisis</span>
                    <span className={styles.badgePill} id="chipEdBadge">
                      {
                        demoTeamReferrals.filter(
                          (r) =>
                            r.origin.toLowerCase().includes("ed") ||
                            r.origin.toLowerCase().includes("crisis") ||
                            r.origin.toLowerCase().includes("resus"),
                        ).length
                      }
                    </span>
                  </button>
                </div>
              </div>
              {demoVisibleReferrals.length === 0 ? (
                <p className={styles.emptyNote} data-testid="ward-community-waiting-empty">
                  No referral matching the selected triage priority is waiting for an answer.
                </p>
              ) : (
                <ul id="triageGrid" className={styles.triageQueueGrid} data-testid="ward-community-waiting-list">
                  {demoVisibleReferrals.map((referral) => (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
                    <li
                      key={referral.id}
                      className={`${styles.refCard} ${styles.clickable}`}
                      data-testid={`ward-community-waiting-${referral.id}`}
                      data-ref-id={referral.id}
                      data-prio={`p${referral.urgency}`}
                      onClick={() => {
                        setSelectedPatientId(referral.patientId);
                        setActiveDrawer("pxDrawer");
                      }}
                    >
                      <div className={styles.refCardHead}>
                        <span className={styles.refId}>Referral · {referral.priorityLabel}</span>
                        <span className={styles.refWait} data-breach={referral.isBreach ? "true" : undefined}>
                          {referral.waitLabel}
                        </span>
                      </div>
                      <div className={styles.refPatientRow}>
                        {/* The card click is a pointer shortcut. This button is the keyboard route. */}
                        <button
                          type="button"
                          className={styles.refOpen}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPatientId(referral.patientId);
                            setActiveDrawer("pxDrawer");
                          }}
                        >
                          <b className={styles.patientIdWrap}>
                            {demoUmrnOf(referral.patientId)} ({referral.patientDetails})
                          </b>
                        </button>
                        <span className={`${styles.statusPillBadge} ${styles[referral.legalStatusTone]}`}>
                          {referral.legalStatus}
                        </span>
                      </div>
                      <p className={styles.refSummaryText}>{referral.clinicalSummary}</p>
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
                      <div className={styles.refActionsRow} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.btnSmPrimary}
                          onClick={() => {
                            setToastMessage(
                              `Accepted the referral for ${demoUmrnOf(referral.patientId)} into community triage.`,
                            );
                          }}
                        >
                          {referral.primaryActionLabel}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => {
                            setSelectedPatientId(referral.patientId);
                            setActiveDrawer("pxDrawer");
                          }}
                        >
                          {referral.secActionLabel}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSmSec}
                          onClick={() => {
                            setToastMessage(
                              `Decline option for the referral for ${demoUmrnOf(referral.patientId)} recorded.`,
                            );
                          }}
                        >
                          {referral.declineActionLabel}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : waitingReferrals.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-community-waiting-empty">
              No referral naming this team is currently waiting for an answer.
            </p>
          ) : (
            <>
              <div className={`${styles.filterChipsGroup} ${styles.chipsSpaced}`}>
                <button
                  type="button"
                  className={styles.chipFilterBtn}
                  aria-pressed={triageFilter === "all"}
                  onClick={() => setTriageFilter("all")}
                >
                  <span>All referrals</span>
                  <span className={styles.badgePill} id="chipAllRefBadge">
                    {waitingReferrals.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.chipFilterBtn}
                  aria-pressed={triageFilter === "p1"}
                  onClick={() => setTriageFilter("p1")}
                >
                  <span>Priority 1 immediate</span>
                  <span className={`${styles.badgePill} ${styles.inkDanger}`} id="chipP1Badge">
                    {p1ReferralsCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.chipFilterBtn}
                  aria-pressed={triageFilter === "p2"}
                  onClick={() => setTriageFilter("p2")}
                >
                  <span>Priority 2 urgent</span>
                  <span className={styles.badgePill} id="chipP2Badge">
                    {p2ReferralsCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.chipFilterBtn}
                  aria-pressed={triageFilter === "p3"}
                  onClick={() => setTriageFilter("p3")}
                >
                  <span>Priority 3 routine</span>
                  <span className={styles.badgePill} id="chipP3Badge">
                    {p3ReferralsCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.chipFilterBtn}
                  aria-pressed={triageFilter === "ed"}
                  onClick={() => setTriageFilter("ed")}
                >
                  <span>ED Liaison &amp; Crisis</span>
                  <span className={styles.badgePill} id="chipEdBadge">
                    {edReferralsCount}
                  </span>
                </button>
              </div>
              {/* The list is sorted by raisedAt, oldest first (community-screen.tsx), so it says so. */}
              <div className={styles.filterMeta} data-testid="ward-community-waiting-order">
                Longest wait first
              </div>
              {visibleWaitingReferrals.length === 0 ? (
                <p className={styles.emptyNote}>
                  No referral matching the selected triage priority is waiting for an answer.
                </p>
              ) : (
                <ul
                  id="triageGrid"
                  className={`${styles.cardList} ${styles.triageQueueGrid}`}
                  data-testid="ward-community-waiting-list"
                >
                  {visibleWaitingReferrals.map((referral) => {
                    const declineOpen = declineOpenFor === referral.id;
                    // Blocked only until a reason is chosen — the same "state a reason before
                    // declining" rule `referral-match.tsx`'s own ward and ED controls hold to.
                    const declineBlocked = communityDeclineBlockedReason(declineDraft);
                    return (
                      <li
                        key={referral.id}
                        className={`${styles.card} ${styles.refCard} refCard`}
                        data-testid={`ward-community-waiting-${referral.id}`}
                        data-ref-id={referral.id}
                        data-held-form={`referral:${referral.id}`}
                        data-prio={`p${referral.urgency}${referral.source === "ed_medical" ? " ed" : ""}`}
                      >
                        <div className={styles.refCardHead}>
                          <span className={styles.refId}>Referral · {urgencyTierLabel(referral.urgency)}</span>
                          <span className={styles.refWait} data-breach={referral.urgency === 1 ? "true" : undefined}>
                            Wait: {referralWaitLine(referral, now)}
                          </span>
                        </div>
                        {(() => {
                          const pt = patients.find((p) => p.id === referral.patientId);
                          // The recorded sex as recorded: M or F only for Male or Female, the
                          // other recorded term in full, and nothing when none is recorded.
                          const sexShown =
                            pt === undefined || pt.sex === "Not recorded"
                              ? ""
                              : pt.sex === "Male"
                                ? "(M)"
                                : pt.sex === "Female"
                                  ? "(F)"
                                  : `(${pt.sex})`;
                          // The referral's own intake answer first, as the drawer and ED read it,
                          // then the person's record.
                          const intakeLegalStatus = referral.intake?.legalStatus?.trim();
                          return (
                            <div className={styles.refPatientRow}>
                              <b className={styles.patientIdWrap}>
                                {identityOf(referral)} {sexShown}
                              </b>
                              <span
                                className={`${styles.statusPillBadge} ${referral.urgency === 1 ? styles.danger : styles.neutral}`}
                              >
                                {(intakeLegalStatus && intakeLegalStatus !== "Not recorded"
                                  ? intakeLegalStatus
                                  : undefined) ??
                                  pt?.legalStatus ??
                                  "Legal status not recorded"}
                              </span>
                            </div>
                          );
                        })()}
                        <div className={styles.refClinicalSummary}>
                          Origin: {referralOriginLabel(referral)}.{" "}
                          {referral.history ||
                            `${referral.ageBand} · ${referral.homeRegion}. ${referral.transportNeeded ? "Transport needed." : "No transport recorded."}`}
                        </div>
                        <ReferralIntakeSummary intake={referral.intake} />
                        <p className={`${styles.cardDetail} ${styles.displayNone}`}>
                          {referralWaitLine(referral, now)}
                        </p>
                        <p className={`${styles.cardDetail} ${styles.displayNone}`}>
                          {referral.ageBand} · {referral.homeRegion} · {referralOriginLabel(referral)}
                        </p>
                        <p className={`${styles.cardDetail} ${styles.displayNone}`}>
                          {referral.transportNeeded ? "Transport needed" : "No transport recorded"}
                        </p>
                        <div className={styles.cardActionsGroup}>
                          <div className={styles.cardWorkflowActions}>
                            <button
                              type="button"
                              className={styles.cardActionButton}
                              onClick={() => handleActionClick("Contacted", referral)}
                            >
                              Log team contact
                            </button>
                            <button
                              type="button"
                              className={styles.cardActionButton}
                              onClick={() => handleActionClick("Review", referral)}
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              className={styles.cardActionButton}
                              onClick={() => handleActionClick("Assign", referral)}
                            >
                              Assign
                            </button>
                            <button
                              type="button"
                              className={styles.cardActionButton}
                              onClick={() => {
                                setSelectedReferralId(referral.id);
                                setPendingAcceptance(null);
                                setAcceptanceError(null);
                                setActiveDrawer("referralDrawer");
                              }}
                              title="Open full referral triage assessment"
                            >
                              Triage record
                            </button>
                          </div>
                          <div className={styles.declineActions}>
                            {/* RB5 (item 16, 2026-09-17) — "a community team may accept, for
                                  follow-up only". Same row as the decline toggle beside it; no
                                  reason to gate on, so this dispatches directly. */}
                            <button
                              type="button"
                              className={styles.acceptConfirmButton}
                              data-testid={`ward-community-accept-${referral.id}`}
                              onClick={() => handleConfirmAccept(referral.id)}
                            >
                              Accept referral
                            </button>
                            <button
                              type="button"
                              className={styles.declineButton}
                              data-testid={`ward-community-decline-toggle-${referral.id}`}
                              aria-expanded={declineOpen}
                              onClick={() => handleToggleDecline(referral.id)}
                            >
                              Decline referral
                            </button>
                            {declineOpen ? (
                              <div
                                className={styles.declineForm}
                                data-testid={`ward-community-decline-panel-${referral.id}`}
                              >
                                <label
                                  className={styles.declineLabel}
                                  htmlFor={`ward-community-decline-reason-${referral.id}`}
                                >
                                  Decline reason
                                  <select
                                    id={`ward-community-decline-reason-${referral.id}`}
                                    className={styles.declineSelect}
                                    data-testid={`ward-community-decline-reason-${referral.id}`}
                                    value={declineDraft ?? ""}
                                    onChange={(e) => {
                                      const chosen = e.target.value;
                                      // Membership, never truthiness — the blank option must
                                      // resolve to "no answer yet", never to a reason that merely
                                      // sorts first (same discipline as `referral-match.tsx`'s own
                                      // decline selects).
                                      setDeclineDraft(
                                        (COMMUNITY_DECLINE_REASONS as readonly string[]).includes(chosen)
                                          ? (chosen as CommunityDeclineReason)
                                          : undefined,
                                      );
                                    }}
                                  >
                                    <option value="">Select a reason...</option>
                                    {COMMUNITY_DECLINE_REASONS.map((reason) => (
                                      <option key={reason} value={reason}>
                                        {COMMUNITY_DECLINE_REASON_LABELS[reason]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className={styles.declineConfirmButton}
                                  data-testid={`ward-community-decline-confirm-${referral.id}`}
                                  aria-disabled={declineBlocked === undefined ? undefined : "true"}
                                  aria-describedby={
                                    declineBlocked === undefined
                                      ? undefined
                                      : `ward-community-decline-blocked-${referral.id}`
                                  }
                                  title={declineBlocked}
                                  onClick={
                                    declineBlocked === undefined
                                      ? () => handleConfirmDecline(referral.id)
                                      : ignoreUnavailableActivation
                                  }
                                >
                                  Confirm decline
                                </button>
                                {declineBlocked === undefined ? null : (
                                  <DisabledReason id={`ward-community-decline-blocked-${referral.id}`}>
                                    {declineBlocked}
                                  </DisabledReason>
                                )}
                                {declineSave.error ? (
                                  <p role="alert" data-testid={`ward-community-decline-failure-${referral.id}`}>
                                    {declineSave.error}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          {/*
           * 🔴 RB5 (item 16, 2026-09-17) CLOSED THE GAP THIS COMMENT ONCE DESCRIBED. Community
           * teams can now accept their own community_team destination, for follow-up only —
           * `EVENT_ROLE.ACCEPT_REFERRAL` permits "community", scoped by the reducer's own
           * `answerableBy` map to that destination kind alone. What is still true, and still
           * the reason this footnote exists: accepting an INPATIENT admission (a ward's bed)
           * requires a ward or coordinator role and a bed allocation this team never holds.
           */}
          <p className={styles.footnote} data-testid="ward-community-waiting-not-actionable">
            Community-team roles can accept or decline referrals addressed to their own team, for follow-up only.
            Inpatient admission acceptance is not recordable from this page.
          </p>
        </div>
      </section>

      <div style={{ display: isDemoMode ? "none" : "block" }} aria-hidden={isDemoMode ? "true" : undefined}>
        <section className={styles.cardPanel} aria-label="Worth attention" data-testid="ward-community-attention">
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <span>Worth attention</span>
            </h3>
          </div>
          <div className={styles.panelBody} role="region" aria-label="Worth attention details" tabIndex={0}>
            {attentionItems.length === 0 ? (
              <p className={styles.emptyNote} data-testid="ward-community-attention-empty">
                Nothing on this page currently stands out beyond what the lists above already show.
              </p>
            ) : (
              <ul className={styles.attentionList} data-testid="ward-community-attention-list">
                {attentionItems.map((item, index) => (
                  <li key={index} className={styles.attentionItem}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
