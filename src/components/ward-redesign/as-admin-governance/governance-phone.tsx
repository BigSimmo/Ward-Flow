"use client"; // Source: src/components/ward-management/governance-phone.tsx (role view: access admin)

// The governance workbench's phone tree (v10), split out of `governance-registers.tsx`
// (18 October 2026) to keep that file under the line cap.

import { ChevronRight, ClipboardList, FileText, History, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { allOverrides } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import { deskRoleLabel } from "@/components/ward-management/settings/workstation-desks";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import {
  DOWNTIME_PACK_HREF,
  PATIENT_CHRONOLOGY_HREF,
  WEEKLY_REPORT_HREF,
} from "@/components/ward-management/reports/report-routes";
import {
  Badge,
  Button,
  Card,
  FactGrid,
  GroupHead,
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StatusGlyph,
  buttonClass,
  cx,
  durMinutes,
  type WfTone,
} from "@/components/wf";
import thirdEdition from "@/components/ward-management/governance-third-edition.module.css";
import accessLink from "./governance-link.module.css";
import wardPin from "@/components/ward-management/ward-pinned-switch.module.css";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { EventFacts } from "@/components/ward-management/governance-event-facts";
import {
  PATTERN_HOURS,
  PATTERN_LIMIT,
  isPattern,
  reasonLabel,
  shortDeskLabel,
} from "@/components/ward-management/governance-access-review";
import {
  OUTCOME_TONE,
  actionLabels,
  categoryLabels,
  outcomeLabels,
  reasonLabels,
  reviewLabels,
  sessionOverrideSentence,
  type GovernanceTab,
  type ReviewChip,
  when,
} from "@/components/ward-management/governance-shared";
import { type SiteGap } from "@/components/ward-management/governance-site-gaps";

/**
 * The phone tree of `GovernanceSession`, drawn from the session's own state, which it passes in
 * whole. It holds no state of its own, so the session reads exactly as before.
 */
type GovernancePhoneInputs = {
  accessCount: number;
  allowed: boolean;
  announcement: string;
  canReview: boolean;
  changeTab: (next: GovernanceTab) => void;
  chip: ReviewChip | null;
  chipMatches: (event: AuditEvent) => boolean;
  choose: (event: AuditEvent | null) => void;
  followUp: number;
  history: AuditReview[];
  movements: Movement[];
  nameFor: (name: string, umrn: string | undefined | null) => string;
  now: Instant;
  overrideCount: number;
  phoneMore: "registers" | "reports" | null;
  phoneSheet: boolean;
  phoneSubjectLabel: (event: AuditEvent) => string;
  /** D-80 item 14: who opened the chosen row's record, for the sheet. */
  recordViews?: ReactNode;
  recordReview: (
    decision: AuditReview["decision"],
    onSettled?: (accepted: boolean) => void,
    onStart?: () => void,
  ) => boolean;
  refusedCount: number;
  reviewGate: RoleGate;
  reviewState: (event: AuditEvent) => AuditReview["decision"] | "unreviewed";
  reviewTitle: string;
  reviewable: AuditEvent[];
  reviewedCount: number;
  reviewedOf: number;
  selected: AuditEvent | null;
  setAnnouncement: Dispatch<SetStateAction<string>>;
  setPhoneAdvance: Dispatch<SetStateAction<boolean>>;
  setPhoneMore: Dispatch<SetStateAction<"registers" | "reports" | null>>;
  setPhoneSheet: Dispatch<SetStateAction<boolean>>;
  setSiteId: Dispatch<SetStateAction<string | null>>;
  site: SiteGap | null;
  sites: SiteGap[];
  tab: GovernanceTab;
  toReview: AuditEvent[];
  toggleChip: (next: ReviewChip) => void;
  totalGaps: number;
  units: Unit[];
};

export function GovernancePhone({
  accessCount,
  allowed,
  announcement,
  canReview,
  changeTab,
  chip,
  chipMatches,
  choose,
  followUp,
  history,
  movements,
  nameFor,
  now,
  overrideCount,
  phoneMore,
  phoneSheet,
  phoneSubjectLabel,
  recordReview,
  recordViews,
  refusedCount,
  reviewGate,
  reviewState,
  reviewTitle,
  reviewable,
  reviewedCount,
  reviewedOf,
  selected,
  setAnnouncement,
  setPhoneAdvance,
  setPhoneMore,
  setPhoneSheet,
  setSiteId,
  site,
  sites,
  tab,
  toReview,
  toggleChip,
  totalGaps,
  units,
}: GovernancePhoneInputs) {
  // Phone (v10): its own tree at 390. A compact hero with three figures, Review, Gaps and Audit as a
  // 44px segmented control, events as list rows, and a bottom sheet that records the review with
  // the button pinned at its foot. Registers and Reports sit behind two cards.
  // Role view (access admin): no Gaps (operational bed work), Registers (seclusion, restraint,
  // incidents) or Reports (a patient's chronology): this desk sees no patients or clinical content.
  const adminDesk = useEffectiveWardAccess().role === "admin";
  const phoneTab: "review" | "gaps" | "audit" = tab === "audit" || (tab === "gaps" && !adminDesk) ? tab : "review";
  // Phone shows the three sites with the most gaps; the full site matrix is a desk job.
  const phoneSites = [...sites].sort((a, b) => b.gaps - a.gaps).slice(0, 3);
  const openPhoneEvent = (event: AuditEvent) => {
    choose(event);
    setPhoneSheet(true);
  };
  const phoneReviewReason = !reviewGate.allowed ? reviewGate.reason : !canReview ? "Recording review…" : undefined;
  const recordPhoneReview = (decision: AuditReview["decision"]) => {
    if (!recordReview(decision)) return;
    setPhoneAdvance(true);
    setAnnouncement("Recording review…");
  };
  // v10 phone row: the action, the person, then the outcome and who; the clock time and how long
  // ago at the end. The whole row opens the review sheet, so it carries no separate button.
  const phoneEventRow = (event: AuditEvent) => {
    const state = reviewState(event);
    const tone: WfTone =
      state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : OUTCOME_TONE[event.outcome];
    return (
      <PhoneListRow
        key={`${event.generation}-${event.id}`}
        as="li"
        data-dim={!chipMatches(event) ? "true" : undefined}
        className={thirdEdition.phoneRow}
        name={actionLabels[event.action]}
        meta={
          <>
            <span className={thirdEdition.phoneMetaLine}>{phoneSubjectLabel(event)}</span>
            <span className={thirdEdition.phoneMetaLine}>
              <StatusGlyph tone={tone} size={9} />
              {event.action === "BREAK_GLASS" && event.details.desk
                ? `${reasonLabel(event.details.reason)} · ${shortDeskLabel(event.details.desk)}, ${event.details.place}`
                : `${categoryLabels[event.category]} · ${outcomeLabels[event.outcome]}${event.actor.role ? ` · ${deskRoleLabel(event.actor.role)}` : ""}`}
            </span>
            {isPattern(event) ? (
              <span className={thirdEdition.phoneMetaLine}>
                <Badge tone="warning" size="sm">
                  More than {PATTERN_LIMIT} in {PATTERN_HOURS} hours
                </Badge>
              </span>
            ) : null}
          </>
        }
        value={event.at === null ? "–" : formatInstantWithDay(event.at, now)}
        time={event.at === null ? undefined : `${durMinutes(Math.max(0, now - event.at))} ago`}
        onSelect={() => openPhoneEvent(event)}
      />
    );
  };
  const savedOverrideCount = allOverrides(movements).length;
  const phoneReviewed = [...reviewable].filter((event) => reviewState(event) === "reviewed").reverse();
  const phoneSubject = selected?.subject;
  const phoneMovementId =
    phoneSubject?.kind === "movement" && movements.some((entry) => entry.id === phoneSubject.movementId)
      ? phoneSubject.movementId
      : null;
  const phoneTree = (
    <div className={thirdEdition.phoneScreen} data-testid="ward-governance-phone">
      <PhoneHero
        eyebrow="Governance · This session"
        // F-08 (phone review, Oct 2026): real-looking names sit beside "Change legal status" here, so
        // the hero carries the Demo pill and says the records are invented.
        chip={<LiveChip state="live" onHero />}
        title={reviewTitle}
        // Polish r2: no "0 of 0 reviewed" while the session holds nothing to review.
        sub={
          reviewedOf === 0
            ? "Invented records"
            : `Invented records · ${reviewedCount} of ${reviewedOf} reviewed · ${followUp} for follow-up`
        }
        // Polish r2 (admin): no row of zero figures while nothing waits, as on the desktop.
        figures={
          adminDesk && toReview.length === 0
            ? undefined
            : [
                {
                  id: "override",
                  value: overrideCount,
                  label: "Overrides",
                  onPress: () => toggleChip("override"),
                  pressed: chip === "override",
                },
                {
                  id: "refused",
                  value: refusedCount,
                  label: "Refused",
                  onPress: () => toggleChip("refused"),
                  pressed: chip === "refused",
                },
                {
                  id: "access",
                  value: accessCount,
                  label: "Record access",
                  onPress: () => toggleChip("access"),
                  pressed: chip === "access",
                },
              ]
        }
        // Polish r2: no Review next while nothing waits (the hero's only button would do nothing).
        actions={
          toReview.length === 0 ? undefined : (
            <Button
              variant="onHero"
              icon={ShieldCheck}
              className={thirdEdition.phoneHeroAction}
              disabledReason={toReview.length === 0 ? "Nothing waits for review" : undefined}
              reasonDisplay="tooltip"
              onClick={() => {
                const first = toReview[0];
                if (first) openPhoneEvent(first);
              }}
            >
              Review next
            </Button>
          )
        }
      />
      <Segmented<"review" | "gaps" | "audit">
        className={`${thirdEdition.phoneTabs} ${wardPin.pinnedSwitch}`}
        label="Governance views"
        value={phoneTab}
        onChange={(next) => changeTab(next)}
        items={[
          { id: "review", label: "Review" },
          ...(adminDesk ? [] : [{ id: "gaps" as const, label: "Gaps", count: totalGaps }]),
          { id: "audit", label: "Reviewed", count: reviewedCount },
        ]}
      />
      {phoneTab === "review" ? (
        <Card aria-label="Waiting for review">
          {toReview.length > 0 ? (
            <>
              {toReview.some((event) => reviewState(event) === "unreviewed") ? (
                <>
                  <GroupHead
                    title="Waiting"
                    count={toReview.filter((event) => reviewState(event) === "unreviewed").length}
                    aside="newest first"
                  />
                  <ul className={thirdEdition.phoneList}>
                    {toReview.filter((event) => reviewState(event) === "unreviewed").map(phoneEventRow)}
                  </ul>
                </>
              ) : null}
              {followUp > 0 ? (
                <>
                  <GroupHead title="Follow-up required" count={followUp} />
                  <ul className={thirdEdition.phoneList}>
                    {toReview.filter((event) => reviewState(event) === "follow-up-required").map(phoneEventRow)}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <div className={thirdEdition.emptyBlock}>
              <ClipboardList aria-hidden="true" size={16} />
              <h3>Nothing waiting for review</h3>
              <p>
                {reviewable.length > 0
                  ? "Every recorded event has been reviewed."
                  : adminDesk
                    ? "No override, refused action or record access this session."
                    : "No override audit is recorded in this session."}
                {/* Role view (access admin): who opened which record lives in Settings, so point there. */}
                {adminDesk ? (
                  <>
                    {" "}
                    <Link href="/ward-flow/settings#access" className={accessLink.lnk}>
                      Open the Access log
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </Card>
      ) : null}
      {phoneTab === "gaps" ? (
        <Card aria-label="Gaps by site">
          <p className={thirdEdition.phoneCardNote}>
            A gap is a form step, examination or carer, PSP or MHAS notice not yet recorded.
          </p>
          {sites.length === 0 ? (
            <p className={thirdEdition.emptyCell}>No open form or recent move to check.</p>
          ) : (
            <ul className={thirdEdition.phoneList}>
              {phoneSites.map((entry) => (
                <PhoneListRow
                  key={entry.id}
                  as="li"
                  name={entry.name}
                  meta={entry.kind === "ed" ? "Emergency department" : "Ward"}
                  value={entry.gaps}
                  time={entry.gaps === 1 ? "gap" : "gaps"}
                  onSelect={() => setSiteId(entry.id)}
                />
              ))}
            </ul>
          )}
          {sites.length > phoneSites.length ? (
            <p className={thirdEdition.phoneCardNote}>
              {sites.length - phoneSites.length} more sites. Open on a tablet or computer for every site.
            </p>
          ) : null}
        </Card>
      ) : null}
      {/* Audit settings-8: a site row opens its gaps in a sheet, so the tap visibly does something. */}
      <PhoneSheet
        open={phoneTab === "gaps" && site !== null}
        onClose={() => setSiteId(null)}
        title={site ? site.name : "Site"}
        description="Patients with a gap"
        height="content"
      >
        {site ? (
          <div className={thirdEdition.stackGap}>
            {site.people.length > 0 ? (
              <ul className={thirdEdition.phoneList}>
                {site.people.map((person) => {
                  const shown = nameFor(person.name, person.umrn);
                  const missing = person.missing.join(", ");
                  return (
                    <PhoneListRow
                      key={person.key}
                      as="li"
                      name={shown}
                      meta={shown.includes(person.umrn) ? missing : `${person.umrn} · ${missing}`}
                      href={person.href}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className={thirdEdition.quiet}>Everything that applies here is recorded.</p>
            )}
          </div>
        ) : null}
      </PhoneSheet>
      {/* Audit settings-6: Review already lists what waits, so the phone's third view lists only
          what has been reviewed, newest first. The full captured trail is on a tablet or computer. */}
      {phoneTab === "audit" ? (
        <Card aria-label="Reviewed this session">
          {allowed && phoneReviewed.length > 0 ? (
            <ul className={thirdEdition.phoneList}>{phoneReviewed.map(phoneEventRow)}</ul>
          ) : (
            <p className={thirdEdition.emptyCell}>
              {allowed ? "No event has been reviewed yet." : "Record access unavailable"}
            </p>
          )}
        </Card>
      ) : null}
      {adminDesk ? null : (
        <div className={thirdEdition.phoneMore}>
          <button type="button" className={thirdEdition.phoneMoreCard} onClick={() => setPhoneMore("registers")}>
            <FileText size={18} aria-hidden="true" className={thirdEdition.phoneMoreIcon} />
            <span className={thirdEdition.stack}>
              <strong>Registers</strong>
              <span className={cx(thirdEdition.quietText, thirdEdition.clip)}>
                Overrides and access here · seclusion, restraint and incidents Preview
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className={thirdEdition.phoneMoreCard} onClick={() => setPhoneMore("reports")}>
            <History size={18} aria-hidden="true" className={thirdEdition.phoneMoreIcon} />
            <span className={thirdEdition.stack}>
              <strong>Reports</strong>
              <span className={cx(thirdEdition.quietText, thirdEdition.clip)}>
                Weekly report, PIR chronology, downtime pack
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className={thirdEdition.phoneNotice}>
        <Badge variant="plain" tone="neutral">
          Safety incidents not recorded here
        </Badge>
      </p>

      <PhoneSheet
        open={phoneSheet && selected !== null}
        onClose={() => setPhoneSheet(false)}
        title={selected ? actionLabels[selected.action] : "Review"}
        description={selected ? phoneSubjectLabel(selected) : undefined}
        height="content"
        // Audit settings-4 and settings-10: Reviewed and Follow-up record the review in one tap (the
        // toast offers Undo), then the next waiting event loads in the same sheet. No greyed button.
        primary={
          selected && selected.category !== "review"
            ? {
                label: "Reviewed",
                disabledReason: phoneReviewReason,
                onAction: () => recordPhoneReview("reviewed"),
              }
            : undefined
        }
        secondary={
          selected && selected.category !== "review"
            ? {
                label: "Follow-up",
                disabledReason: phoneReviewReason,
                onAction: () => recordPhoneReview("follow-up-required"),
              }
            : undefined
        }
      >
        {selected ? (
          <div className={thirdEdition.stackGap}>
            {/* v10 phone: the event's facts two by two, the outcome glyph carrying its tone. */}
            <FactGrid
              facts={[
                {
                  id: "outcome",
                  label: "Outcome",
                  value: (
                    <span className={thirdEdition.statusText}>
                      <StatusGlyph tone={OUTCOME_TONE[selected.outcome]} size={9} />
                      {outcomeLabels[selected.outcome]}
                    </span>
                  ),
                },
                {
                  id: "role",
                  label: "Role recorded",
                  value: selected.actor.role ? deskRoleLabel(selected.actor.role) : "Not recorded",
                },
                { id: "when", label: "Recorded", value: when(selected.at, now) },
                {
                  id: "reason",
                  label: "Reason",
                  // D-80 item 14: a break glass opening carries its own reason.
                  value:
                    selected.action === "BREAK_GLASS"
                      ? reasonLabel(selected.details.reason)
                      : selected.reasonCode !== "none"
                        ? reasonLabels[selected.reasonCode]
                        : "None recorded",
                },
              ]}
            />
            {/* The same recorded facts the desktop detail shows (before, requested, after for a legal
                status change), so a phone review is never signed off blind. */}
            <div className={thirdEdition.operationFacts} data-testid="ward-governance-phone-facts">
              <h3 className={thirdEdition.subheading}>Recorded facts</h3>
              <EventFacts event={selected} units={units} now={now} />
            </div>
            {recordViews}
            {phoneMovementId ? (
              <div className={thirdEdition.entityLinks}>
                <Link href={movementHref(phoneMovementId)} className={buttonClass({ size: "sm" })}>
                  Open movement <ChevronRight aria-hidden="true" size={14} />
                </Link>
              </div>
            ) : null}
            {selected.category !== "review" ? (
              <div className={thirdEdition.stackGap}>
                <h3 className={thirdEdition.phoneDecisionHead}>Your review</h3>
                <p className={thirdEdition.quiet}>
                  Reviewed or Follow-up records it now and opens the next event. You can undo it.
                </p>
              </div>
            ) : (
              <p className={thirdEdition.quiet}>Review attempts cannot be reviewed.</p>
            )}
            <p className={thirdEdition.quiet}>
              {history.length === 0
                ? "No review recorded for this event."
                : `${history.length} recorded ${history.length === 1 ? "review" : "reviews"}, last ${reviewLabels[history.at(-1)!.decision]}.`}
            </p>
          </div>
        ) : null}
      </PhoneSheet>

      <PhoneSheet
        open={phoneMore !== null}
        onClose={() => setPhoneMore(null)}
        title={phoneMore === "reports" ? "Reports" : "Registers"}
        description="The full registers and reports are laid out for a tablet or computer."
        height="content"
      >
        {phoneMore === "registers" ? (
          // Audit settings-11: one plain line per register; the full registers are a desk job.
          <ul className={thirdEdition.phoneList}>
            <PhoneListRow
              as="li"
              name="Overrides"
              meta={
                <span data-testid="ward-governance-overrides-session">
                  {sessionOverrideSentence(overrideCount)} Saved on a referral: {savedOverrideCount}.
                </span>
              }
            />
            <PhoneListRow
              as="li"
              name="Access record"
              meta={
                <span data-testid="ward-governance-access-session">
                  Searches this session only.{" "}
                  {accessCount === 1
                    ? "1 record opening waits in Review."
                    : `${accessCount} record openings wait in Review.`}
                </span>
              }
            />
            <PhoneListRow
              as="li"
              name="Seclusion, restraint and incidents"
              meta="Preview. Not recorded in Ward Flow yet."
            />
          </ul>
        ) : (
          <ul className={thirdEdition.phoneList}>
            <PhoneListRow
              as="li"
              name="Weekly operations report"
              meta="Flow, delays, overrides and reviews"
              href={WEEKLY_REPORT_HREF}
            />
            <PhoneListRow
              as="li"
              name="PIR chronology"
              meta="One patient's events in time order"
              href={PATIENT_CHRONOLOGY_HREF}
            />
            <PhoneListRow
              as="li"
              name="Downtime pack"
              meta="Printable board for when the system is down"
              href={DOWNTIME_PACK_HREF}
            />
          </ul>
        )}
      </PhoneSheet>
      <p className={thirdEdition.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
  return phoneTree;
}
