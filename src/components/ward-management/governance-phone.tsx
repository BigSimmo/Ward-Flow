"use client";

// The governance workbench's phone tree (v10), split out of `governance-registers.tsx`
// (18 October 2026) to keep that file under the line cap.

import { Check, ChevronRight, ClipboardList, Clock, Ellipsis } from "lucide-react";
import Link from "next/link";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { allOverrides } from "@/components/ward-management/ward-derivations";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import type { AuditEvent, AuditReview } from "./ward-audit";
import { deskRoleLabel } from "./settings/workstation-desks";
import { movementHref } from "./shell/ward-facade";
import { DOWNTIME_PACK_HREF, PATIENT_CHRONOLOGY_HREF, WEEKLY_REPORT_HREF } from "./reports/report-routes";
import {
  Badge,
  Button,
  Card,
  FactGrid,
  GroupHead,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  Menu,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StatusGlyph,
  buttonClass,
  cx,
  durMinutes,
  folderTabClasses,
  type WfTone,
} from "@/components/wf";
import { GovernanceRestrictiveRegister } from "./governance-restrictive-register";
import thirdEdition from "./governance-third-edition.module.css";
import pageTop from "./page-top-title.module.css";
import eventList from "./governance-event-list.module.css";
import { EventFacts } from "./governance-event-facts";
import { PATTERN_HOURS, PATTERN_LIMIT, isPattern, reasonLabel, shortDeskLabel } from "./governance-access-review";
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
} from "./governance-shared";
import { type SiteGap } from "./governance-site-gaps";

/**
 * The phone tree of `GovernanceSession`, drawn from the session's own state, which it passes in
 * whole. It holds no state of its own, so the session reads exactly as before.
 */
type GovernancePhoneInputs = {
  /** The access admin desk: Review and Reviewed only, with no clinical content. */
  adminDesk: boolean;
  accessCount: number;
  allowed: boolean;
  announcement: string;
  canReview: boolean;
  changeTab: (next: GovernanceTab) => void;
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
  /** The figure the waiting list is highlighted by, and its toggle (tap a figure again to clear). */
  chip: ReviewChip | null;
  toggleChip: (next: ReviewChip) => void;
  reviewState: (event: AuditEvent) => AuditReview["decision"] | "unreviewed";
  reviewable: AuditEvent[];
  reviewedCount: number;
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
  totalGaps: number;
  units: Unit[];
};

export function GovernancePhone({
  accessCount,
  adminDesk,
  allowed,
  announcement,
  canReview,
  changeTab,
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
  chip,
  toggleChip,
  reviewState,
  reviewable,
  reviewedCount,
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
  totalGaps,
  units,
}: GovernancePhoneInputs) {
  // Phone (v10): its own tree at 390. A compact hero with three figures, Review, Gaps and Audit as a
  // 44px segmented control, events as list rows, and a bottom sheet that records the review with
  // the button pinned at its foot. Registers and Reports sit behind two cards.
  // Role (access admin): no Gaps (operational bed work), Registers (seclusion, restraint, incidents) or
  // Reports (a patient's chronology): this desk sees no patients or clinical content.
  const phoneTab: "review" | "gaps" | "audit" = tab === "audit" || (tab === "gaps" && !adminDesk) ? tab : "review";
  const adminEmpty = adminDesk && toReview.length === 0;
  // Phone shows the three sites with the most gaps; the full site matrix is a desk job.
  const phoneSites = [...sites].sort((a, b) => b.gaps - a.gaps).slice(0, 3);
  const openPhoneEvent = (event: AuditEvent) => {
    choose(event);
    setPhoneSheet(true);
  };
  // Page tops (Josh, 9 Nov 2026): the newest event still waiting, named in the act row.
  const newest = toReview.find((event) => reviewState(event) === "unreviewed") ?? toReview[0] ?? null;
  const newestTitle = newest
    ? `Newest ${newest.at === null ? "time unavailable" : formatInstantWithDay(newest.at, now)} · ${actionLabels[newest.action]}`
    : "Nothing waiting for review";
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
      <Hero
        className={cx(pageTop.hero, folderTabClasses.hero)}
        title={
          <>
            Review <span className={pageTop.soft}>this session</span>
          </>
        }
        // F-08 (phone review, Oct 2026): real-looking names sit beside "Change legal status" here, so
        // the hero carries the Demo pill and says the records are invented.
        aside={<LiveChip state="live" onHero age={formatInstant(now)} />}
      >
        <HeroTop
          // Role (access admin): no row of zero figures and no Review next while nothing waits.
          figures={
            adminEmpty ? undefined : (
              <HeroFigures
                items={[
                  // Each figure highlights its events in the waiting list; tap again to clear.
                  ...(
                    [
                      ["override", overrideCount, "overrides"],
                      ["refused", refusedCount, "refused or stale"],
                      ["access", accessCount, "record access"],
                    ] as const
                  ).map(([id, value, label]) => ({
                    id,
                    value,
                    label,
                    onClick: () => toggleChip(id),
                    pressed: chip === id,
                    linkTestId: `wf-phone-hero-figure-${id}`,
                  })),
                ]}
              />
            )
          }
          act={
            adminEmpty ? undefined : (
              <HeroAct
                tone="calm"
                title={newestTitle}
                sub={followUp > 0 ? `${followUp} follow-up required` : undefined}
                testId="ward-governance-act"
                action={
                  newest
                    ? {
                        label: "Review next",
                        phoneLabel: "Review",
                        testId: "ward-governance-review-next",
                        onClick: () => openPhoneEvent(newest),
                      }
                    : undefined
                }
              />
            )
          }
          chips={
            <HeroQuickChips
              label="Governance actions"
              items={[
                // Shown whenever events wait; a desk that may not review is told why in the sheet.
                ...(adminEmpty || !newest
                  ? []
                  : [
                      {
                        id: "record",
                        label: "Record review",
                        icon: <Check strokeWidth={1.75} aria-hidden="true" />,
                        testId: "ward-governance-phone-record-review",
                        onClick: () => openPhoneEvent(selected ?? newest),
                      },
                    ]),
                // Role (access admin): a patient's chronology is not this desk's to open.
                ...(adminDesk
                  ? []
                  : [
                      {
                        id: "pir",
                        label: "PIR chronology",
                        icon: <Clock strokeWidth={1.75} aria-hidden="true" />,
                        href: PATIENT_CHRONOLOGY_HREF,
                      },
                    ]),
              ]}
            />
          }
        />
      </Hero>
      <FolderTabs
        label="Governance views"
        value={phoneTab}
        testId="ward-governance-tabs"
        more={
          // Registers and Reports sit behind More on a phone, as on Home.
          adminDesk ? undefined : (
            <Menu
              label="More governance views"
              align="end"
              items={[
                { id: "registers", label: "Registers", onSelect: () => setPhoneMore("registers") },
                { id: "reports", label: "Reports", onSelect: () => setPhoneMore("reports") },
              ]}
              trigger={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={Ellipsis}
                  className={folderTabClasses.more}
                  aria-label="More governance views"
                />
              )}
            />
          )
        }
      >
        <Segmented<"review" | "gaps" | "audit">
          className={folderTabClasses.switch}
          label="Governance views"
          value={phoneTab}
          onChange={(next) => changeTab(next)}
          items={[
            { id: "review", label: "Review", count: toReview.length },
            ...(adminDesk ? [] : [{ id: "gaps" as const, label: "Form gaps", count: totalGaps }]),
            { id: "audit", label: "Audit trail", ...(reviewedCount > 0 ? { count: reviewedCount } : {}) },
          ]}
        />
      </FolderTabs>
      {phoneTab === "review" ? (
        <Card aria-label="Waiting for review">
          {toReview.length > 0 ? (
            <>
              {toReview.some((event) => reviewState(event) === "unreviewed") ? (
                <>
                  {/* The count is the Review tab's; the head says only the order. */}
                  <GroupHead title="Waiting" aside="newest first" />
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
                {/* Role (access admin): who opened which record lives in Settings, so point there. */}
                {adminDesk ? (
                  <>
                    {" "}
                    <Link href="/ward-flow/settings#access" className={eventList.accessLink}>
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
                  meta={
                    entry.kind === "ed"
                      ? "Emergency department"
                      : entry.kind === "community"
                        ? "Community team"
                        : "Ward"
                  }
                  value={entry.gaps}
                  time={entry.gaps === 1 ? "gap" : "gaps"}
                  onSelect={() => setSiteId(entry.id)}
                />
              ))}
            </ul>
          )}
          {sites.length > phoneSites.length ? (
            <p className={thirdEdition.phoneCardNote}>
              {sites.length - phoneSites.length} more sites on a tablet or computer.
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
        <Card aria-label="Audit trail this session">
          {allowed && phoneReviewed.length > 0 ? (
            <ul className={thirdEdition.phoneList}>{phoneReviewed.map(phoneEventRow)}</ul>
          ) : (
            <p className={thirdEdition.emptyCell}>
              {allowed ? "No event has been reviewed yet." : "Audit is read by coordinators."}
            </p>
          )}
        </Card>
      ) : null}
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
                <p className={thirdEdition.quiet}>You can undo a review.</p>
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
        description="Full versions on a tablet or computer."
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
          </ul>
        ) : null}
        {phoneMore === "registers" ? (
          // GV1 (Josh, 3 Nov 2026): finished seclusion and restraint, and ward incidents, in full.
          <GovernanceRestrictiveRegister units={units} now={now} />
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
