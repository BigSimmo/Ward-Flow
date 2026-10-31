"use client";

import { ClipboardList, FileText, Fingerprint, History, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useContext, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { OverrideRegister } from "@/components/ward-management/override-register";
import { allOverrides } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import { ACCESS_RECORD_NOTE } from "@/components/ward-management/search/access-record";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { WardFlowContext } from "./ward-flow-provider";
import { useEffectiveWardAccess } from "./shell/ward-access-store";
import eventList from "./governance-event-list.module.css";
import type { WardCommandOutcome } from "./ward-shared-client";
import type { AuditCategory, AuditEvent, AuditReview } from "./ward-audit";
import { UNDO_TOAST_MS } from "./ward-operational-defaults";
import { DOWNTIME_PACK_HREF, PATIENT_CHRONOLOGY_HREF, WEEKLY_REPORT_HREF } from "./reports/report-routes";
import {
  Badge,
  BarList,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Count,
  Drawer,
  Field,
  Hero,
  HeroStat,
  HeroTrack,
  Segmented,
  Select,
  Sheet,
  StatusGlyph,
  TextInput,
  Textarea,
  buttonClass,
  cx,
  tableClasses,
  useIsPhone,
  useOptionalToast,
  useIsTabletPortrait,
} from "@/components/wf";

import thirdEdition from "./governance-third-edition.module.css";
import { EventDetail, EventTable } from "./governance-event-detail";
import { GovernancePhone } from "./governance-phone";
import {
  REVIEWING_ROLES,
  actionLabels,
  actor,
  categoryLabels,
  outcomeLabels,
  readGovernanceEvents,
  reviewLabels,
  sessionOverrideSentence,
  subjectLabel,
  subjectPerson,
  type GovernanceTab,
  type ReviewChip,
  type WorkbenchProps,
} from "./governance-shared";
import { GAP_KEYS, GAP_LABEL, GapPill, cellTone, siteGaps } from "./governance-site-gaps";
import { isPattern, openingEvents, viewsOfRecord } from "./governance-access-review";
import { RecordViewsTable, WhoOpenedList } from "./governance-record-views";
import { useGovernanceAccessReview } from "./use-governance-access-review";

export { EventFacts } from "./governance-event-facts";

/**
 * TWO NEW GOVERNANCE PANELS — built to sit inside `GovernanceView`
 * (`ward-management-modes.tsx:264-455`), but not wired in from this file. `ward-management-modes.tsx`
 * is a shared file (it also carries `QueueView` and `ExceptionsView`), and this task's brief
 * forbids editing a shared file directly — the exact two-JSX-block, one-import wiring edit is
 * handed back in the build report rather than applied here.
 *
 * Both panels answer the drawing's `governance-third-edition.html` two-tab register concept
 * (`renderRegister`/`renderAccess`, `:5739-5815`) using only data this codebase actually has —
 * see each panel's own comment for exactly what was left out and why.
 */

/**
 * "OVERRIDES REGISTER" — the honest half of the drawing's "Overrides for review" tab.
 *
 * The drawing's tab claims a `reviewed`/`unreviewed` split and a "Gate overridden" field
 * (`governance-third-edition.html:5745,5762-5764`). Neither exists on `Override`
 * (`ward-model.ts:508-517`): it carries `at`, `by` (a role), `reason` (one of the fixed
 * `OVERRIDE_REASONS`) and `unitIds`, and nothing marks one override as reviewed. So this panel
 * does NOT claim to be a review queue — it is titled "Overrides register" and shows every
 * override ever recorded, network-wide, using the exact same unrestricted read
 * (`allOverrides`, `ward-derivations.ts:1174`) and the exact same read-only render component
 * (`OverrideRegister`, `override-register.tsx`) the coordinator's exception drawer already uses.
 * Nothing here is invented: on the seeded fixture (48 movements, every `overrides: []`) this
 * panel renders `OverrideRegister`'s own true empty state, and it starts showing real rows the
 * moment a coordinator screen dispatches `REFER_TO_UNITS` with an `overrideReason` — the same
 * live path `tests/ward-override-register-render.dom.test.tsx` exercises.
 */
export function GovernanceOverridesRegisterPanel({
  movements,
  units,
  now,
  sessionCount,
}: {
  movements: Movement[];
  units: Unit[];
  now: Instant;
  /** The override events this session's Review holds: the same figure as the hero's Overrides. */
  sessionCount?: number;
}) {
  const entries = allOverrides(movements);
  return (
    <Card data-testid="ward-governance-overrides-register">
      <header className={thirdEdition.panelHead}>
        <div>
          <h2>Overrides register</h2>
          {/* Deliberately NOT "for review" and NOT "oldest first": neither a reviewed/unreviewed
              split nor a queue order exists in this model (see file comment above). This is every
              override this system has ever recorded, across the network — `OverrideRegister`
              itself renders them newest first. */}
          <p>Every override this system has recorded, across the network</p>
        </div>
      </header>
      <CardBody>
        {sessionCount !== undefined ? (
          <p className={thirdEdition.quiet} data-testid="ward-governance-overrides-session">
            {sessionOverrideSentence(sessionCount)} This register lists overrides saved on a referral.
          </p>
        ) : null}
        <OverrideRegister entries={entries} units={units} now={now} />
      </CardBody>
    </Card>
  );
}

/**
 * "ACCESS RECORD" — the panel this task exists to stop from overstating itself.
 *
 * The drawing's own tab claims, unqualified, *"Every time somebody opened a person's record,
 * most recent first, across the whole network"* and renders a `who` per row
 * (`governance-third-edition.html:5790,5799-5807`). **That is false on this codebase.** The only
 * access log anywhere under `src/` is `search/access-record.ts`: it is held in one page's
 * `useState`, is never persisted, never leaves that page, and — per a standing ruling recorded in
 * that file — carries no `who` at all, because there is no signed-in user and "the role IS the
 * route you are on." Building a network-wide "who opened what" register would mean inventing a
 * persistence layer and an identity model neither of which this prototype has, which the build
 * brief for this screen explicitly forbids.
 *
 * So this panel makes no claim beyond what is true today: it states plainly, in the governance
 * screen's own voice, what the real access record is, where it lives, and what it cannot tell a
 * reader. `tests/ward-no-screen-claims-a-durable-access-record.test.ts` is the standing guard for
 * this exact shape of over-claim; this panel is written to pass it by being true, not by working
 * around it.
 */
export function GovernanceAccessRecordPanel({ sessionCount }: { sessionCount?: number } = {}) {
  return (
    <Card as="div" role="complementary" data-testid="ward-governance-access-record">
      <header className={thirdEdition.panelHead}>
        <div>
          <h2>Access record</h2>
          <p>What this prototype actually keeps, not a network-wide log</p>
        </div>
      </header>
      <CardBody className={thirdEdition.noticeStack}>
        {sessionCount !== undefined ? (
          <p className={thirdEdition.quiet} data-testid="ward-governance-access-session">
            {sessionCount === 0
              ? "No record opening from this session waits in Review."
              : `${sessionCount} record ${sessionCount === 1 ? "opening" : "openings"} from this session ${sessionCount === 1 ? "waits" : "wait"} in Review.`}
          </p>
        ) : null}
        <p className={thirdEdition.notice}>
          <History aria-hidden="true" size={16} /> {ACCESS_RECORD_NOTE}
        </p>
        <p className={thirdEdition.notice} data-testid="ward-governance-access-record-scope">
          <Fingerprint aria-hidden="true" size={16} /> There is no network-wide version of this record here, and no row
          names who looked: this system has no signed-in user to name, only the screen a search ran from, held in that
          screen&apos;s own memory and nowhere else.
        </p>
      </CardBody>
    </Card>
  );
}

export function GovernanceWorkbench(props: WorkbenchProps) {
  // Role (access admin): this desk sees no patients and no clinical content, and comes to review who
  // opened which record. Gaps by site, Registers (seclusion, restraint, incidents) and Reports (a
  // patient's chronology, the downtime board) are not its to open, so it has Review and the Audit
  // trail only, and always opens on Review, where record access is.
  const adminDesk = useEffectiveWardAccess().role === "admin";
  // The open tab survives a demo reset; everything else in the session starts again. It opens on
  // Review when something waits (v10 mockup), and on Gaps by site when the session holds nothing.
  const [tab, setTab] = useState<GovernanceTab>(() => {
    if (adminDesk) return "review";
    const read = readGovernanceEvents(props.api);
    const waiting = read?.status === "allowed" && read.value.some((event) => event.category !== "review");
    return waiting ? "review" : "gaps";
  });
  const shownTab = adminDesk && tab !== "review" && tab !== "audit" ? "review" : tab;
  return (
    <GovernanceSession
      key={props.api?.worldGeneration ?? "unavailable"}
      {...props}
      tab={shownTab}
      setTab={setTab}
      adminDesk={adminDesk}
    />
  );
}

function GovernanceSession({
  movements,
  units,
  now,
  api,
  tab,
  setTab,
  adminDesk,
}: WorkbenchProps & { tab: GovernanceTab; setTab: (tab: GovernanceTab) => void; adminDesk: boolean }) {
  const flow = useContext(WardFlowContext);
  const resolvePatient = usePatientOf();
  // An admission subject names only its id: resolve through the stay itself, so a bed record shows
  // its person and UMRN rather than an internal id.
  const patientOf: typeof resolvePatient = (subject) => {
    const id = subject && "id" in subject && !("movementId" in subject) ? subject.id : undefined;
    const stay = id ? flow?.admissions.find((admission) => admission.id === id) : undefined;
    const info = resolvePatient(stay ?? subject);
    // Every row, pane and phone line names the person surname first (D-83).
    return { ...info, displayName: info.formalName };
  };
  const [category, setCategory] = useState<"all" | AuditCategory | "record-views">("all");
  const [outcome, setOutcome] = useState<"all" | AuditEvent["outcome"]>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "unreviewed" | AuditReview["decision"]>("all");
  // `undefined` until someone chooses, so the pane opens on the newest event waiting; `null` once
  // they close it, so it stays closed.
  const [selection, setSelection] = useState<AuditEvent | null | undefined>(undefined);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    command: number;
    status: "pending" | WardCommandOutcome["status"];
    eventId: string;
    generation: number;
    count: number;
    sequence: number;
    at: Instant;
    decision: AuditReview["decision"];
  } | null>(null);
  const [endorseOpen, setEndorseOpen] = useState(false);
  const [endorseVerdict, setEndorseVerdict] = useState<"" | AuditReview["decision"]>("");
  const [endorseRole, setEndorseRole] = useState<string>("");
  const [endorseNotes, setEndorseNotes] = useState<string>("");
  const endorseSessionRef = useRef(0);
  const reviewCommandRef = useRef(0);
  const [announcement, setAnnouncement] = useState<string>("");
  const [chip, setChip] = useState<ReviewChip | null>(null);
  const [phoneSheet, setPhoneSheet] = useState(false);
  // Audit settings-4: after a phone review is confirmed, the sheet moves on to the next waiting event.
  const [phoneAdvance, setPhoneAdvance] = useState(false);
  const [phoneMore, setPhoneMore] = useState<"registers" | "reports" | null>(null);
  const isPhone = useIsPhone();
  // Discreet names on phone (audit settings-9): initials plus UMRN in the phone rows and sheet.
  const nameFor = usePatientNameDisplay();
  const phoneSubjectLabel = (event: AuditEvent) => {
    const person = subjectPerson(event, patientOf);
    if (!person) return subjectLabel(event, patientOf);
    // Audit settings-5: the UMRN rides with the name, as on desktop.
    const shown = nameFor(person.name, person.umrn);
    return shown.includes(person.umrn) ? shown : `${shown} · ${person.umrn}`;
  };
  const isTabletPortrait = useIsTabletPortrait();
  const gate = useRoleGate();
  const reviewGate = gate("REVIEW_AUDIT_EVENT");

  const eventRead = readGovernanceEvents(api);
  const reviewRead = api?.readAuditReviews(actor);
  const allowed = eventRead?.status === "allowed" && reviewRead?.status === "allowed";
  const events = eventRead?.status === "allowed" ? eventRead.value : [];
  const reviews = reviewRead?.status === "allowed" ? reviewRead.value : [];
  // D-80 item 14: each break glass opening joins the list, from the server or the demo, in time order.
  const accessReview = useGovernanceAccessReview(events, now);
  const rows = allowed
    ? [...events, ...openingEvents(accessReview.openings, api?.worldGeneration ?? 0)].sort(
        (a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER),
      )
    : events;
  const historyFor = (event: AuditEvent) =>
    reviews.filter((review) => review.eventId === event.id && review.generation === event.generation);
  const reviewState = (event: AuditEvent) => historyFor(event).at(-1)?.decision ?? "unreviewed";
  const reviewable = rows.filter((event) => event.category !== "review");
  const toReview = reviewable.filter((event) => reviewState(event) !== "reviewed").reverse();
  const reviewedCount = reviewable.filter((event) => reviewState(event) === "reviewed").length;
  const followUp = reviewable.filter((event) => reviewState(event) === "follow-up-required").length;
  const unreviewed = reviewable.filter((event) => reviewState(event) === "unreviewed").length;
  const visible = [...rows]
    .filter(
      (event) =>
        (category === "all" || event.category === category) &&
        (outcome === "all" || event.outcome === outcome) &&
        (reviewFilter === "all" || (event.category !== "review" && reviewState(event) === reviewFilter)),
    )
    .reverse();
  // On a phone or a portrait tablet the event opens over the list, so nothing opens unasked there.
  const opening = selection === undefined && !isPhone && !isTabletPortrait ? (toReview[0] ?? visible[0]) : selection;
  const selected =
    allowed && opening && rows.some((event) => event.id === opening.id && event.generation === opening.generation)
      ? opening
      : null;
  const history = selected ? historyFor(selected) : [];
  const reviewAttempt = pending
    ? [...events]
        .reverse()
        .find(
          (event) =>
            event.category === "review" &&
            event.sequence > pending.sequence &&
            event.generation === pending.generation &&
            event.at === pending.at &&
            event.subject.kind === "audit-event" &&
            event.subject.eventId === pending.eventId &&
            event.details.decision === pending.decision,
        )
    : undefined;
  // Read from the reviewed event itself, not the selection, so a phone sheet that has moved on to
  // the next event still confirms (and toasts) the review it just recorded (audit settings-4).
  const savedReview = pending
    ? reviews.filter((review) => review.eventId === pending.eventId && review.generation === pending.generation)[
        pending.count
      ]
    : undefined;
  const confirmed =
    pending?.status === "accepted" &&
    reviewAttempt?.outcome === "accepted" &&
    savedReview?.decision === pending?.decision &&
    savedReview?.at === pending?.at;
  const reviewSettled =
    pending !== null && pending.status !== "pending" && (pending.status !== "accepted" || reviewAttempt !== undefined);
  const reviewPending = pending !== null && !reviewSettled;
  const canReview = allowed && selected !== null && selected.category !== "review" && !reviewPending;

  // Undo (pass 2 engine): once a review is confirmed, a toast offers Undo for a few seconds.
  // Undo dispatches `UNDO_AUDIT_REVIEW` with the new review's id; a refusal shows its reason.
  const toast = useOptionalToast();
  const toastedReviewRef = useRef<string | null>(null);
  const undoWatchRef = useRef<{ rejections: number; reviewId: string } | null>(null);
  const undoGate = gate("UNDO_AUDIT_REVIEW");
  const undoGateReason = undoGate.allowed ? undefined : undoGate.reason;
  const rejectionCount = api?.rejections?.length ?? 0;
  const newestRejection = api?.rejections?.at(-1);
  const reviewIds = reviews.map((review) => review.id).join(" ");
  const savedReviewId = confirmed ? (savedReview?.id ?? null) : null;
  const savedDecision = pending?.decision;
  useEffect(() => {
    if (!toast || !api || savedReviewId === null || toastedReviewRef.current === savedReviewId) return;
    toastedReviewRef.current = savedReviewId;
    const generation = api.worldGeneration;
    toast.push({
      tone: "success",
      title: `${savedDecision ? reviewLabels[savedDecision] : "Review"} recorded`,
      body: undoGateReason,
      undo: undoGateReason
        ? undefined
        : {
            durationMs: UNDO_TOAST_MS,
            onUndo: () => {
              undoWatchRef.current = { rejections: rejectionCount, reviewId: savedReviewId };
              api.dispatch({
                type: "UNDO_AUDIT_REVIEW",
                role: "coordinator",
                now,
                reviewId: savedReviewId,
                expectedGeneration: generation,
              });
              setPending(null);
            },
          },
    });
  }, [api, now, rejectionCount, savedDecision, savedReviewId, toast, undoGateReason]);
  useEffect(() => {
    const watch = undoWatchRef.current;
    if (!watch) return;
    if (rejectionCount > watch.rejections) {
      undoWatchRef.current = null;
      const reason = newestRejection?.reason ?? "The record changed.";
      setAnnouncement(`Review not undone. ${reason}`);
      toast?.push({ tone: "warning", title: "Review not undone", body: reason });
    } else if (!reviewIds.split(" ").includes(watch.reviewId)) {
      undoWatchRef.current = null;
      setAnnouncement("Review undone.");
    }
  }, [newestRejection, rejectionCount, reviewIds, toast]);

  // The supplied snapshot, so every tab reads the same movements and units.
  const sites = siteGaps(flow ? { ...flow, movements, units } : null, now);
  const totalGaps = sites.reduce((sum, entry) => sum + entry.gaps, 0);
  const site = sites.find((entry) => entry.id === siteId) ?? null;
  const overrideCount = toReview.filter((event) => event.category === "override").length;
  const refusedCount = toReview.filter((event) => event.outcome === "denied" || event.outcome === "stale").length;
  const accessCount = toReview.filter((event) => event.category === "record-access").length;
  const patternCount = toReview.filter(isPattern).length;

  const chipMatches = (event: AuditEvent): boolean =>
    chip === null
      ? true
      : chip === "override"
        ? event.category === "override"
        : chip === "refused"
          ? event.outcome === "denied" || event.outcome === "stale"
          : chip === "access"
            ? event.category === "record-access"
            : chip === "pattern"
              ? isPattern(event)
              : reviewState(event) === "follow-up-required";
  const chipCount = toReview.filter((event) => chip !== null && chipMatches(event)).length;
  const toggleChip = (next: ReviewChip) => {
    setChip((current) => (current === next ? null : next));
    if (tab !== "review") setTab("review");
  };

  /** The record a row is about, by its person, and its journey when it names one. */
  function recordOf(event: AuditEvent): string[] | null {
    if (event.action === "BREAK_GLASS") return event.details.record === null ? null : [event.details.record];
    const subject = event.subject;
    const info =
      subject.kind === "movement"
        ? patientOf({ movementId: subject.movementId })
        : subject.kind === "referral"
          ? patientOf({ referralId: subject.referralId })
          : subject.kind === "admission"
            ? patientOf({ id: subject.admissionId })
            : null;
    const person = info?.patient?.id;
    if (!person) return null;
    return subject.kind === "movement" ? [person, subject.movementId] : [person];
  }

  const choose = (event: AuditEvent | null) => {
    reviewCommandRef.current += 1;
    setSelection(event);
    setPending(null);
    if (event) setAnnouncement(`Selected ${actionLabels[event.action]}.`);
  };

  // Audit settings-4: once the phone review is settled, the sheet loads the next event still
  // waiting, or closes when none is left. A refused review stays put. Adjusted while rendering
  // (React's pattern for state that follows other state), so no effect sets state.
  if (phoneAdvance && reviewSettled) {
    setPhoneAdvance(false);
    const nextWaiting = toReview.find(
      (event) => reviewState(event) === "unreviewed" && !(selected && event.id === selected.id),
    );
    if (confirmed && nextWaiting) setSelection(nextWaiting);
    else if (confirmed) setPhoneSheet(false);
    // Announce only the settled outcome, never before the review is confirmed.
    setAnnouncement(
      confirmed && pending
        ? `${reviewLabels[pending.decision]} recorded.`
        : "Review not confirmed. The record may have changed; select it again.",
    );
  }

  function changeTab(next: GovernanceTab) {
    setTab(next);
    setAnnouncement(`${TAB_LABEL[next]} shown.`);
  }

  function rowKey(event: ReactKeyboardEvent<HTMLDivElement>, list: AuditEvent[]) {
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-audit-row]"));
    const index = rows.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const next =
      event.key === "ArrowDown"
        ? Math.min(index + 1, rows.length - 1)
        : event.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    rows[next]?.focus();
    choose(list[next] ?? null);
  }

  function recordReview(
    decision: AuditReview["decision"],
    onSettled?: (accepted: boolean) => void,
    /** Runs just before dispatch, so a pending notice never follows a synchronous outcome. */
    onStart?: () => void,
  ): boolean {
    if (!api || !canReview || !selected || selected.generation !== api.worldGeneration) return false;
    const command = ++reviewCommandRef.current;
    const count = history.length;
    setPending({
      command,
      status: "pending",
      eventId: selected.id,
      generation: selected.generation,
      count,
      sequence: events.at(-1)?.sequence ?? 0,
      at: now,
      decision,
    });
    const record = () =>
      api.dispatch({
        type: "REVIEW_AUDIT_EVENT",
        role: "coordinator",
        now,
        eventId: selected.id,
        expectedGeneration: selected.generation,
        expectedReviewCount: count,
        decision,
      });
    const settle = (outcome: WardCommandOutcome | void) => {
      if (reviewCommandRef.current !== command) return;
      const status = outcome?.isCurrent?.() === false ? "cancelled" : (outcome?.status ?? "failed");
      setPending((current) => (current?.command === command ? { ...current, status } : current));
      onSettled?.(status === "accepted");
    };
    const fail = () => settle(undefined);
    try {
      onStart?.();
      const completion = record();
      if (completion && "then" in completion) void completion.then(settle, fail);
      else settle(completion);
    } catch {
      fail();
      return false;
    }
    return true;
  }

  function closeEndorse() {
    endorseSessionRef.current += 1;
    setEndorseOpen(false);
    setEndorseVerdict("");
    setEndorseRole("");
    setEndorseNotes("");
  }

  const TAB_LABEL: Record<GovernanceTab, string> = {
    review: "Review",
    gaps: "Form gaps by site",
    audit: "Audit trail",
    registers: "Registers",
    reports: "Reports",
  };
  // Audit settings-7: the hero reads the Waiting count the list shows, with follow-ups named apart.
  const reviewTitle =
    toReview.length === 0
      ? "Nothing to review"
      : followUp > 0
        ? `${unreviewed} to review · ${followUp} follow-up`
        : `${unreviewed} to review`;
  const heroTitle =
    tab === "review"
      ? reviewTitle
      : tab === "gaps"
        ? totalGaps === 0
          ? "No form gaps recorded"
          : `${totalGaps} form ${totalGaps === 1 ? "gap" : "gaps"} across ${sites.filter((entry) => entry.gaps > 0).length} ${sites.filter((entry) => entry.gaps > 0).length === 1 ? "site" : "sites"}`
        : tab === "audit"
          ? "Audit trail"
          : tab === "registers"
            ? "Restrictive practice and incidents"
            : "Reports";
  // Role (access admin): with nothing to review, the counts, filters and review controls have nothing
  // to act on, so the page shows the title, the tabs and one empty state with its Access log link.
  const adminEmpty = adminDesk && toReview.length === 0;
  const heroStats =
    tab === "review" && adminEmpty ? null : tab === "review" ? (
      <>
        <HeroStat
          inline
          value={overrideCount}
          label="Overrides"
          tone="neutral"
          pressed={chip === "override"}
          onToggle={() => toggleChip("override")}
        />
        <HeroStat
          inline
          value={refusedCount}
          label="Refused or stale"
          tone="neutral"
          pressed={chip === "refused"}
          onToggle={() => toggleChip("refused")}
        />
        <HeroStat
          inline
          value={accessCount}
          label="Record access"
          tone="neutral"
          pressed={chip === "access"}
          onToggle={() => toggleChip("access")}
        />
        <HeroStat
          inline
          value={patternCount}
          label={adminDesk ? "Patterns" : "Pattern"}
          tone="warning"
          pressed={chip === "pattern"}
          onToggle={() => toggleChip("pattern")}
        />
        <HeroStat
          inline
          value={followUp}
          label={adminDesk ? "For follow-up" : "Follow-up"}
          tone="warning"
          pressed={chip === "follow-up"}
          onToggle={() => toggleChip("follow-up")}
        />
      </>
    ) : tab === "gaps" ? (
      sites
        .filter((entry) => entry.gaps > 0)
        .slice(0, 3)
        .map((entry) => <HeroStat key={entry.id} value={entry.gaps} label={entry.name} />)
    ) : tab === "audit" ? (
      <HeroStat value={allowed ? events.length : "Not shown"} label="Captured" />
    ) : null;
  const reviewedOf = reviewable.length;

  // The rail at rest. Audit settings-12: the hero already carries the counts and the reviewed
  // ring, so the rail no longer repeats them; it says what to do, or that everything is reviewed.
  const restSummary = (
    <div className={thirdEdition.restSummary} data-testid="ward-governance-rest-summary">
      {toReview.length === 0 ? (
        <p className={thirdEdition.restClear}>
          <StatusGlyph tone="success" size={9} />
          Every captured event is reviewed.
        </p>
      ) : (
        <p className={thirdEdition.quietText}>Choose an event</p>
      )}
    </div>
  );

  // D-80 item 14: who opened the chosen row's record, when the row has one.
  const record = selected ? recordOf(selected) : null;
  const detail = (
    <EventDetail
      recordViews={
        record ? <WhoOpenedList views={viewsOfRecord(accessReview.views, record, now)} now={now} /> : undefined
      }
      rest={restSummary}
      selected={selected}
      units={units}
      movements={movements}
      api={api}
      events={events}
      history={history}
      now={now}
      patientOf={patientOf}
      reviewState={reviewState}
      canReview={canReview}
      onReview={recordReview}
      onChoose={choose}
      roleReason={reviewGate.allowed ? undefined : reviewGate.reason}
      feedback={
        pending
          ? confirmed
            ? `${reviewLabels[pending.decision]} recorded.`
            : reviewSettled
              ? "Review not confirmed. The record may have changed; select it again."
              : "Recording review…"
          : ""
      }
    />
  );

  // Tablet portrait (v10): no rail beside the table, so the chosen event slides over from the
  // right and the session summary stays in the page below the table.
  const placedDetail =
    isTabletPortrait && selected ? (
      <>
        <Drawer
          open
          onClose={() => choose(null)}
          title={actionLabels[selected.action]}
          description={categoryLabels[selected.category]}
          testId="ward-governance-event-sheet"
        >
          {detail}
        </Drawer>
      </>
    ) : (
      detail
    );

  const phoneTree = (
    <GovernancePhone
      accessCount={accessCount}
      adminDesk={adminDesk}
      allowed={allowed}
      announcement={announcement}
      canReview={canReview}
      changeTab={changeTab}
      chip={chip}
      chipMatches={chipMatches}
      choose={choose}
      followUp={followUp}
      history={history}
      movements={movements}
      nameFor={nameFor}
      now={now}
      overrideCount={overrideCount}
      phoneMore={phoneMore}
      phoneSheet={phoneSheet}
      phoneSubjectLabel={phoneSubjectLabel}
      recordReview={recordReview}
      recordViews={
        record ? <WhoOpenedList views={viewsOfRecord(accessReview.views, record, now)} now={now} /> : undefined
      }
      refusedCount={refusedCount}
      reviewGate={reviewGate}
      reviewState={reviewState}
      reviewTitle={reviewTitle}
      reviewable={reviewable}
      reviewedCount={reviewedCount}
      selected={selected}
      setAnnouncement={setAnnouncement}
      setPhoneAdvance={setPhoneAdvance}
      setPhoneMore={setPhoneMore}
      setPhoneSheet={setPhoneSheet}
      setSiteId={setSiteId}
      site={site}
      sites={sites}
      tab={tab}
      toReview={toReview}
      toggleChip={toggleChip}
      totalGaps={totalGaps}
      units={units}
    />
  );
  if (isPhone) return phoneTree;

  return (
    <div className={thirdEdition.governanceWorkspace} data-testid="ward-governance-workbench" data-ward-design="v8">
      <Hero
        level={2}
        eyebrow="Governance · This session"
        title={heroTitle}
        stats={heroStats}
        aside={
          tab === "review" && adminEmpty ? undefined : (
            <span className={thirdEdition.heroActions}>
              <span className={thirdEdition.reviewedRing}>
                <span
                  className={thirdEdition.ringDial}
                  style={{
                    ["--done" as string]: `${reviewedOf === 0 ? 0 : Math.round((reviewedCount / reviewedOf) * 360)}deg`,
                  }}
                  aria-hidden="true"
                />
                <span className={thirdEdition.stack}>
                  <strong>
                    {reviewedCount} of {reviewedOf}
                  </strong>
                  <span>reviewed</span>
                </span>
              </span>
              <Button
                variant="light"
                size="sm"
                disabledReason={
                  !reviewGate.allowed ? reviewGate.reason : selected === null ? "Choose an event first" : undefined
                }
                reasonDisplay="tooltip"
                onClick={() => setEndorseOpen(true)}
              >
                Record review
              </Button>
            </span>
          )
        }
        bar={
          <HeroTrack<GovernanceTab>
            label="Governance views"
            value={tab}
            onChange={changeTab}
            items={
              adminDesk
                ? [
                    { id: "review", label: "Review", count: toReview.length },
                    { id: "audit", label: "Audit trail" },
                  ]
                : [
                    { id: "review", label: "Review", count: toReview.length },
                    { id: "gaps", label: "Form gaps by site" },
                    { id: "audit", label: "Audit trail" },
                    { id: "registers", label: "Registers" },
                    { id: "reports", label: "Reports" },
                  ]
            }
          />
        }
        barAside={
          <span className={thirdEdition.heroActions}>
            {/* A notice, not a button: plain text (device audit 11 Oct 2026). */}
            <span className={thirdEdition.heroNotice}>Safety incidents not recorded here</span>
            {/* Role (access admin): a patient's chronology is not this desk's to open. */}
            {adminDesk ? null : (
              <Link href={PATIENT_CHRONOLOGY_HREF} className={buttonClass({ variant: "onHero", size: "sm" })}>
                <History size={14} aria-hidden="true" />
                PIR chronology
              </Link>
            )}
          </span>
        }
      />

      {tab === "review" ? (
        <div className={thirdEdition.govLayout}>
          <Card
            className={cx(thirdEdition.registerCard, adminEmpty && eventList.fullWidth)}
            aria-labelledby="governance-review-title"
          >
            {adminEmpty ? (
              <h2 id="governance-review-title" className="sr-only">
                Waiting for review
              </h2>
            ) : (
              <CardHead
                id="governance-review-title"
                icon={ShieldCheck}
                title="Waiting for review"
                meta={<Count n={toReview.length} />}
                aside={
                  <span className={thirdEdition.quietText}>
                    {chip
                      ? `${chipCount} of ${toReview.length} highlighted, all rows stay`
                      : "Overrides, refused actions and record access, now with break glass. Newest first."}
                  </span>
                }
              />
            )}
            {adminEmpty ? null : (
              <div className={cx(thirdEdition.filterRow, thirdEdition.reviewFilter)}>
                <Segmented<"all" | "override" | "refused" | "access">
                  label="Show in the review list"
                  value={chip === "override" || chip === "refused" || chip === "access" ? chip : "all"}
                  onChange={(next) => setChip(next === "all" ? null : next)}
                  items={[
                    { id: "all", label: "All" },
                    { id: "override", label: "Overrides" },
                    { id: "refused", label: "Refused or stale" },
                    { id: "access", label: "Record access" },
                  ]}
                />
                <span className={thirdEdition.quietText} data-testid="ward-governance-break-glass-source">
                  {accessReview.problem
                    ? "Break glass could not be read from the server"
                    : accessReview.from === "server"
                      ? "Break glass is read from the server"
                      : "Break glass openings here are synthetic"}
                </span>
              </div>
            )}
            {adminEmpty ? (
              <div className={thirdEdition.emptyBlock}>
                <ClipboardList aria-hidden="true" size={16} />
                <h3>Nothing waiting for review</h3>
                <p>
                  {reviewable.length > 0
                    ? "Every recorded event has been reviewed."
                    : "No override, refused action or record access this session."}{" "}
                  {/* Role (access admin): who opened which record lives in Settings, so point there. */}
                  <Link href="/ward-flow/settings#access" className={eventList.accessLink}>
                    Open the Access log
                  </Link>
                </p>
              </div>
            ) : (
              <EventTable
                label="Waiting for review"
                isDim={(event) => !chipMatches(event)}
                rows={toReview}
                selected={selected}
                now={now}
                patientOf={patientOf}
                reviewState={reviewState}
                onChoose={choose}
                onKey={(event) => rowKey(event, toReview)}
                empty={
                  <div className={thirdEdition.emptyBlock}>
                    <ClipboardList aria-hidden="true" size={16} />
                    <h3>Nothing waiting for review</h3>
                    <p>
                      {reviewable.length > 0
                        ? "Every recorded event has been reviewed."
                        : "No override audit is recorded in this session."}
                    </p>
                  </div>
                }
              />
            )}
          </Card>
          {/* Role (access admin): with nothing waiting, the review panel has nothing to act on. */}
          {adminEmpty ? null : placedDetail}
        </div>
      ) : null}

      {tab === "gaps" ? (
        <div className={thirdEdition.govLayout}>
          <div className={thirdEdition.stackGap}>
            <Card className={thirdEdition.registerCard} aria-labelledby="governance-gaps-title">
              <CardHead
                id="governance-gaps-title"
                title="Sites and requirements"
                aside={<span className={thirdEdition.quietText}>Done / due</span>}
              />
              {sites.length === 0 ? (
                <p className={thirdEdition.emptyCell}>No open form or recent move to check.</p>
              ) : (
                <div className={thirdEdition.tableScroll} role="region" aria-label="Gaps by site" tabIndex={0}>
                  <table className={cx(tableClasses.table, thirdEdition.gapTable)}>
                    <thead>
                      <tr>
                        <th scope="col">Site</th>
                        {GAP_KEYS.map((key) => (
                          <th key={key} scope="col">
                            {GAP_LABEL[key]}
                          </th>
                        ))}
                        <th scope="col">Gaps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map((entry) => (
                        <tr key={entry.id} className={cx(entry.id === siteId && tableClasses.selected)}>
                          <td>
                            <button
                              type="button"
                              className={thirdEdition.rowButton}
                              aria-pressed={entry.id === siteId}
                              onClick={() => setSiteId(entry.id === siteId ? null : entry.id)}
                            >
                              <span className={thirdEdition.stack}>
                                <strong className={thirdEdition.clip}>{entry.name}</strong>
                                <span className={thirdEdition.quietText}>
                                  {entry.kind === "ed" ? "Emergency department" : "Ward"}
                                </span>
                              </span>
                            </button>
                          </td>
                          {GAP_KEYS.map((key) => (
                            <td key={key}>
                              <GapPill cell={entry.cells[key]} label={GAP_LABEL[key]} />
                            </td>
                          ))}
                          <td>
                            <Count n={entry.gaps} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card aria-labelledby="governance-gap-kinds">
              <CardHead
                id="governance-gap-kinds"
                title="Gaps by requirement"
                aside={<span className={thirdEdition.quietText}>All sites</span>}
              />
              <CardBody>
                <BarList
                  label="Gaps by requirement"
                  labelWidth="8rem"
                  rows={GAP_KEYS.map((key) => {
                    const missing = sites.reduce(
                      (sum, entry) => sum + entry.cells[key].total - entry.cells[key].done,
                      0,
                    );
                    return { id: key, label: GAP_LABEL[key], value: missing };
                  })}
                />
              </CardBody>
            </Card>
          </div>
          <Card className={thirdEdition.detailCard} aria-label={site ? site.name : "All sites"} data-wf-rail>
            <CardHead
              title={site ? site.name : "All sites"}
              level={2}
              meta={<Count n={site ? site.gaps : totalGaps} />}
              action={
                site ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={X}
                    aria-label="Show all sites"
                    onClick={() => setSiteId(null)}
                  />
                ) : undefined
              }
            />
            <CardBody className={thirdEdition.stackGap}>
              <div className={thirdEdition.tileGrid}>
                {GAP_KEYS.map((key) => {
                  const cell = site
                    ? site.cells[key]
                    : sites.reduce(
                        (sum, entry) => ({
                          done: sum.done + entry.cells[key].done,
                          total: sum.total + entry.cells[key].total,
                        }),
                        { done: 0, total: 0 },
                      );
                  const tone = cellTone(cell);
                  return (
                    <div key={key} className={thirdEdition.tile} data-tone={tone ?? "none"}>
                      <span className={thirdEdition.tileLabel}>
                        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
                        {GAP_LABEL[key]}
                      </span>
                      <strong className={thirdEdition.gapValue}>
                        {cell.total === 0 ? "–" : `${cell.done}/${cell.total}`}
                      </strong>
                    </div>
                  );
                })}
              </div>
              {site ? (
                <>
                  <h3 className={thirdEdition.eyebrow}>Patients with a gap</h3>
                  {site.people.length > 0 ? (
                    <ul className={thirdEdition.gapPeople}>
                      {site.people.map((person) => (
                        <li key={person.key}>
                          <span className={thirdEdition.stack}>
                            <strong className={thirdEdition.clip}>{person.name}</strong>
                            <span className={cx(thirdEdition.quietText, thirdEdition.clip)}>
                              {person.umrn} · {person.detail} · {person.missing.join(", ")}
                            </span>
                          </span>
                          <Link href={person.href} className={buttonClass({ variant: "sec", size: "sm" })}>
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={thirdEdition.quiet}>Everything that applies here is recorded.</p>
                  )}
                </>
              ) : (
                <p className={thirdEdition.quiet}>Choose a site to see who has a gap.</p>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className={thirdEdition.govLayout}>
          <Card className={thirdEdition.registerCard} aria-labelledby="governance-captured-title">
            <CardHead
              id="governance-captured-title"
              icon={History}
              title="Captured this session"
              meta={
                <span className={thirdEdition.metaRow}>
                  <Count n={allowed ? events.length : "–"} />
                  <span>resets with demo</span>
                </span>
              }
            />
            <div className={thirdEdition.filterRow}>
              <Select
                id="governance-filter-category"
                name="governanceFilterCategory"
                aria-label="Filter event category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as typeof category);
                  choose(null);
                }}
              >
                <option value="all">All categories</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                <option value="record-views">Record views</option>
              </Select>
              <Select
                id="governance-filter-outcome"
                name="governanceFilterOutcome"
                aria-label="Filter event outcome"
                value={outcome}
                onChange={(event) => {
                  setOutcome(event.target.value as typeof outcome);
                  choose(null);
                }}
              >
                <option value="all">All outcomes</option>
                {Object.entries(outcomeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                id="governance-filter-review"
                name="governanceFilterReview"
                aria-label="Filter review state"
                value={reviewFilter}
                onChange={(event) => {
                  setReviewFilter(event.target.value as typeof reviewFilter);
                  choose(null);
                }}
              >
                <option value="all">All review states</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="reviewed">Reviewed</option>
                <option value="follow-up-required">Follow-up required</option>
              </Select>
            </div>
            {category === "record-views" ? (
              <RecordViewsTable views={accessReview.views} now={now} patientOf={patientOf} from={accessReview.from} />
            ) : (
              <EventTable
                label="Captured events"
                rows={visible}
                selected={selected}
                now={now}
                patientOf={patientOf}
                reviewState={reviewState}
                onChoose={choose}
                onKey={(event) => rowKey(event, visible)}
                empty={
                  <div className={thirdEdition.emptyBlock}>
                    <ClipboardList aria-hidden="true" size={16} />
                    <h3>{events.length ? "No matching events" : "No events captured yet"}</h3>
                    <p>
                      {events.length
                        ? "Change the filters to see other captured events."
                        : "Recorded actions and discharge-record opens will appear here."}
                    </p>
                    {events.length > 0 && (category !== "all" || outcome !== "all" || reviewFilter !== "all") ? (
                      <button
                        type="button"
                        className={buttonClass({ variant: "sec", size: "sm" })}
                        onClick={() => {
                          setCategory("all");
                          setOutcome("all");
                          setReviewFilter("all");
                          choose(null);
                        }}
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                }
                allowed={allowed}
              />
            )}
            <CardFoot
              meta={
                allowed
                  ? `${reviewedCount} reviewed · ${followUp} follow-up · ${unreviewed} unreviewed`
                  : "Record access unavailable"
              }
            >
              System advice and bed state at decision time are not recorded
            </CardFoot>
          </Card>
          {placedDetail}
        </div>
      ) : null}

      {tab === "registers" ? (
        <div className={thirdEdition.stackGap}>
          <div className={thirdEdition.previewGrid}>
            {[
              {
                title: "Seclusion",
                text: "Seclusion records: start, reviews, release and duration by ward.",
              },
              {
                title: "Bodily restraint",
                text: "Bodily restraint records: start, reviews, release and duration by ward.",
              },
              {
                title: "Notifiable incidents",
                text: "Absent without leave, death and serious harm, with the time the Chief Psychiatrist was told.",
              },
            ].map((entry) => (
              <Card key={entry.title} className={thirdEdition.previewCard} aria-label={`${entry.title} register`}>
                <CardHead
                  title={entry.title}
                  level={2}
                  aside={
                    <Badge variant="plain" tone="neutral">
                      Preview
                    </Badge>
                  }
                />
                <CardBody className={thirdEdition.stackGap}>
                  <p className={thirdEdition.quiet}>{entry.text}</p>
                  <span className={thirdEdition.previewLines} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <p className={thirdEdition.quiet}>Nothing is shown until Ward Flow holds these records.</p>
                </CardBody>
              </Card>
            ))}
          </div>
          <div className={thirdEdition.previewGrid} data-columns="2">
            <GovernanceOverridesRegisterPanel
              movements={movements}
              units={units}
              now={now}
              sessionCount={overrideCount}
            />
            <GovernanceAccessRecordPanel sessionCount={accessCount} />
          </div>
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className={thirdEdition.previewGrid} data-columns="2">
          {[
            {
              title: "Weekly operations report",
              text: "Flow, delays, overrides and reviews for the week",
              href: WEEKLY_REPORT_HREF,
            },
            {
              title: "PIR chronology",
              text: "One patient's events in time order, for a post incident review",
              href: PATIENT_CHRONOLOGY_HREF,
            },
            {
              title: "Downtime pack",
              text: "Printable board for when the system is down",
              href: DOWNTIME_PACK_HREF,
            },
          ].map((report) => (
            <Card key={report.title} aria-label={report.title}>
              <CardHead title={report.title} icon={FileText} level={2} />
              <CardBody>
                <p className={thirdEdition.quiet}>{report.text}</p>
              </CardBody>
              <CardFoot>
                <Link href={report.href} className={buttonClass({ variant: "sec", size: "sm" })}>
                  Open
                </Link>
              </CardFoot>
            </Card>
          ))}
          <Card aria-label="Settings change log">
            <CardHead title="Settings change log" icon={FileText} level={2} />
            <CardBody>
              <p className={thirdEdition.quiet}>Who changed warning windows or thresholds, and when</p>
            </CardBody>
            <CardFoot>
              <Button
                variant="sec"
                size="sm"
                onClick={() => {
                  setCategory("configuration");
                  setOutcome("all");
                  setReviewFilter("all");
                  choose(null);
                  changeTab("audit");
                }}
              >
                Open
              </Button>
            </CardFoot>
          </Card>
          {[
            {
              title: "Chief Psychiatrist return",
              text: "Restrictive practice and incident counts. Needs seclusion, bodily restraint and incident records.",
            },
            {
              title: "Tribunal and advocacy",
              text: "Reviews and advocate contact on time. Needs hearing dates and contact times.",
            },
          ].map((report) => (
            <Card key={report.title} className={thirdEdition.previewCard} aria-label={report.title}>
              <CardHead
                title={report.title}
                level={2}
                aside={
                  <Badge variant="plain" tone="neutral">
                    Preview
                  </Badge>
                }
              />
              <CardBody>
                <p className={thirdEdition.quiet}>{report.text}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <Sheet
        open={endorseOpen}
        onClose={closeEndorse}
        title="Record a review"
        description="The decision is saved. The reviewing role and note stay on this screen only."
        portal={false}
        testId="ward-governance-endorse"
        footer={
          <div className={thirdEdition.formActions}>
            <Button onClick={closeEndorse}>Cancel</Button>
            <span className={thirdEdition.grow} />
            <Button
              variant="pri"
              disabledReason={
                !canReview
                  ? "Select an event in Review first"
                  : endorseVerdict === ""
                    ? "Choose a decision"
                    : endorseRole === ""
                      ? "Choose a reviewing role"
                      : undefined
              }
              reasonDisplay="tooltip"
              onClick={() => {
                if (endorseVerdict === "" || endorseRole === "") return;
                const session = endorseSessionRef.current;
                const notConfirmed = "Review not confirmed. Review the event before trying again.";
                let started = false;
                const sent = recordReview(
                  endorseVerdict,
                  (accepted) => {
                    if (endorseSessionRef.current !== session) return;
                    setAnnouncement(accepted ? "Review recorded." : notConfirmed);
                    if (accepted) closeEndorse();
                  },
                  () => {
                    started = true;
                    setAnnouncement("Recording review…");
                  },
                );
                // Refused before dispatch (stale selection or no workspace): say so, never "Recording".
                if (!sent && !started) setAnnouncement(notConfirmed);
              }}
            >
              Record finding
            </Button>
          </div>
        }
      >
        <div className={thirdEdition.stackGap}>
          <Field label="Under review" id="endorseSubj">
            <TextInput
              value={
                selected
                  ? `${actionLabels[selected.action]} (${subjectLabel(selected, patientOf)})`
                  : "No event selected"
              }
              readOnly
            />
          </Field>
          <Field label="Decision" id="endorseVerdict">
            <Select
              value={endorseVerdict}
              onChange={(event) => setEndorseVerdict(event.target.value as typeof endorseVerdict)}
            >
              <option value="">Choose a decision</option>
              <option value="reviewed">{reviewLabels.reviewed}</option>
              <option value="follow-up-required">{reviewLabels["follow-up-required"]}</option>
            </Select>
          </Field>
          <Field label="Reviewing role" id="endorseRole">
            <Select value={endorseRole} onChange={(event) => setEndorseRole(event.target.value)}>
              <option value="">Choose a reviewing role</option>
              {REVIEWING_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note for the register" id="endorseNotes">
            <Textarea
              rows={3}
              maxLength={280}
              value={endorseNotes}
              onChange={(event) => setEndorseNotes(event.target.value)}
              data-gramm="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
        </div>
      </Sheet>

      <p className={thirdEdition.srOnly} id="screenAnnouncer" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
