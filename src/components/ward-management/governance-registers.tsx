"use client";

import { ChevronRight, ClipboardList, Download, FileText, Fingerprint, History, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useContext, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { ignoreUnavailableActivation } from "@/components/primitive-recipes/recipes";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { allOverrides } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { ACCESS_RECORD_NOTE } from "@/components/ward-management/search/access-record";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { WardConfiguration } from "./ward-configuration";
import { WardFlowContext, type useWardFlow, type WardFlowContextValue } from "./ward-flow-provider";
import type {
  AuditCategory,
  AuditEvent,
  AuditReview,
  BedReleaseAuditFacts,
  BedReleaseAuditRequest,
} from "./ward-audit";
import { LEAVING_DESTINATIONS } from "./ward-admissions";
import { legalFormReceiptCorrectionReasonLabels } from "./ward-change-reasons";
import { snoozeReasonLabel } from "./ward-inbox-snooze";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import { movementHref, unitHref } from "./shell/ward-facade";
import {
  WardBarPageTools,
  wardBarToolClass,
  wardBarToolCountClass,
  wardBarToolLabelClass,
} from "./shell/ward-bar-page-tools";
import { DOWNTIME_PACK_HREF, PATIENT_CHRONOLOGY_HREF, WEEKLY_REPORT_HREF } from "./reports/report-routes";
import { isOpen } from "./ward-derivations";
import { edById, edShortName } from "./ward-sites";
import { resolveSubjectPatient } from "./ward-patient-resolver";
import {
  SUPPORT_NOTIFICATION_OCCASION_LABELS,
  SUPPORT_NOTIFICATION_PARTY_SHORT,
  type SupportNotificationParty,
} from "./ward-support-notifications";
import { recentTellSubjects, recordedFacts, type RecordGap } from "./legal-forms/legal-forms-view";
import {
  Badge,
  BarList,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Count,
  EmptyState,
  Field,
  Hero,
  HeroStat,
  HeroTrack,
  Select,
  Sheet,
  StatusGlyph,
  TextInput,
  Textarea,
  buttonClass,
  cx,
  tableClasses,
  type WfTone,
} from "@/components/wf";

import thirdEdition from "./governance-third-edition.module.css";

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
}: {
  movements: Movement[];
  units: Unit[];
  now: Instant;
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
export function GovernanceAccessRecordPanel() {
  return (
    <Card as="div" role="complementary" data-testid="ward-governance-access-record">
      <header className={thirdEdition.panelHead}>
        <div>
          <h2>Access record</h2>
          <p>What this prototype actually keeps, not a network-wide log</p>
        </div>
      </header>
      <CardBody className={thirdEdition.noticeStack}>
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

type GovernanceApi = Pick<
  ReturnType<typeof useWardFlow>,
  "worldGeneration" | "readAuditEvents" | "readAuditReviews" | "dispatch" | "admissions" | "bedReleases"
>;
type WorkbenchProps = {
  movements: Movement[];
  units: Unit[];
  now: Instant;
  api?: GovernanceApi;
  sampleData?: boolean;
};
const actor = { role: "coordinator" } as const;
const categoryLabels: Record<AuditCategory, string> = {
  referral: "Referral",
  override: "Override",
  "legal-status": "Legal status",
  "legal-form": "Legal form",
  discharge: "Discharge",
  "record-access": "Record access",
  review: "Review",
  configuration: "Configuration",
  inbox: "Action item",
};
const outcomeLabels = {
  accepted: "Accepted",
  partial: "Partly accepted",
  denied: "Refused",
  stale: "Stale request",
} as const;
const reasonLabels: Record<AuditEvent["reasonCode"], string> = {
  none: "None",
  role: "Role not permitted",
  scope: "Outside permitted scope",
  "missing-or-inaccessible": "Missing or inaccessible record",
  "invalid-payload": "Invalid request",
  "identity-link": "Patient link did not match",
  generation: "Session changed",
  revision: "Record changed",
  transition: "Transition not permitted",
};
const actionLabels: Record<AuditEvent["action"], string> = {
  REFER_TO_UNITS: "Refer to wards",
  PULL_PATIENT: "Pull bed",
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  ACCEPT_REFERRAL: "Accept referral",
  CHANGE_LEGAL_STATUS: "Change legal status",
  RAISE_REFERRAL: "Record legal form",
  // T2 (2026-09-17 build plan). Covers both the first typed expiry and a later extension — see
  // `legalFormOperationLabels` below for which of the two this row was.
  RECORD_COUNTRY_EXTENSION: "Country paper extension",
  RECORD_LEGAL_FORM_CONTINUATION: "Paper continuation",
  RECORD_LEGAL_FORM_EXPIRY: "Record legal form expiry",
  // T4 (2026-09-17 build plan).
  CORRECT_LEGAL_FORM_RECEIPT: "Correct legal form receipt",
  FLAG_BED_RELEASE: "Plan bed release",
  CONFIRM_BED_RELEASE: "Confirm bed release",
  REVERT_BED_RELEASE: "Revert bed release",
  BLOCK_BED_RELEASE: "Record release blocker",
  CLEAR_BED_RELEASE_BLOCK: "Clear release blocker",
  SET_BED_PREPARATION: "Update bed preparation",
  RELEASE_BED: "Release bed",
  RECORD_LEAVING: "Record departure",
  RECORD_ADMISSION_CARE: "Care journey fact",
  RECORD_ADMISSION_FOLLOW_UP: "Record follow-up arrangement",
  RECORD_PATIENT_DISCHARGE: "Record patient discharge",
  OPEN_DISCHARGE_RECORD: "Open discharge record",
  REVIEW_AUDIT_EVENT: "Review event",
  SET_CONFIGURATION: "Change configuration",
  TAKE_INBOX_ITEM_OWNERSHIP: "Take action item",
  SNOOZE_INBOX_ITEM: "Snooze action item",
  UNSNOOZE_INBOX_ITEM: "Return snoozed action item",
};
const reviewLabels = { reviewed: "Reviewed", "follow-up-required": "Follow-up required" } as const;
const display = (value: string | number | boolean | null | undefined) =>
  value === null || value === undefined
    ? "Not recorded"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
const when = (at: Instant | null, now: Instant) => (at === null ? "Time unavailable" : formatInstantWithDay(at, now));
const destination = (id: string | null) =>
  LEAVING_DESTINATIONS.find((entry) => entry.id === id)?.label ?? "Not recorded";
function subjectLabel(event: AuditEvent, patientOf: ReturnType<typeof usePatientOf>): string {
  const subject = event.subject;
  switch (subject.kind) {
    case "admission":
      return subject.admissionId;
    case "movement": {
      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
      return patientOf({ movementId: subject.movementId }).displayName;
    }
    case "referral":
      return subject.referralId;
    case "bed-release":
      return subject.releaseId;
    case "audit-event":
      return subject.eventId;
    case "configuration":
      return "Configuration";
    case "unresolved":
      return "Unresolved record";
  }
}
function FactList({ facts }: { facts: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className={thirdEdition.factList}>
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function BedFacts({ facts, now }: { facts: BedReleaseAuditFacts | null; now: Instant }) {
  return facts ? (
    <FactList
      facts={[
        ["State", facts.state ?? "Not recorded"],
        ["Expected", when(facts.expectedAt, now)],
        ["Waiting on", display(facts.waitingOn)],
        ["Blocker", display(facts.blocker)],
        ["Preparing", display(facts.preparing)],
        ["Preparation note", display(facts.preparationNote)],
      ]}
    />
  ) : (
    <p className={thirdEdition.quiet}>No record at this point.</p>
  );
}
function RequestedBedFacts({ request, now }: { request: BedReleaseAuditRequest; now: Instant }) {
  const facts: [string, ReactNode][] = [["Action", actionLabels[request.action]]];
  switch (request.action) {
    case "FLAG_BED_RELEASE":
      facts.push(
        ["Expected", when(request.expectedAt, now)],
        ["Waiting on", display(request.waitingOn)],
        ["Blocker", display(request.blocker)],
      );
      break;
    case "REVERT_BED_RELEASE":
      facts.push(["Waiting on", display(request.waitingOn)]);
      break;
    case "BLOCK_BED_RELEASE":
      facts.push(["Blocker", display(request.blocker)]);
      break;
    case "SET_BED_PREPARATION":
      facts.push(["Preparing", display(request.preparing)], ["Preparation note", display(request.note)]);
      break;
    case "CONFIRM_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "RELEASE_BED":
      break;
  }
  return <FactList facts={facts} />;
}
function EventFacts({ event, units, now }: { event: AuditEvent; units: Unit[]; now: Instant }) {
  switch (event.category) {
    case "referral":
    case "override":
      return (
        <>
          <FactList
            facts={[
              ["Reason supplied", display(event.details.reason)],
              ["Override fact recorded", display(event.details.overrideFactRecorded)],
              ["Prior gate verdict", "Not captured"],
            ]}
          />
          <h3 className={thirdEdition.subheading}>Requested wards</h3>
          <ul className={thirdEdition.targetList}>
            {event.details.targets.map((target, index) => {
              const matches = units.filter((unit) => unit.id === target.unitId);
              return (
                <li key={index}>
                  <span>{matches.length === 1 ? matches[0].name : "Unresolved ward"}</span>
                  <span className={thirdEdition.badge} data-tone={target.outcome}>
                    {outcomeLabels[target.outcome]}
                  </span>
                  {target.reasonCode !== "none" && <small>{reasonLabels[target.reasonCode]}</small>}
                </li>
              );
            })}
          </ul>
        </>
      );
    case "legal-status":
      return (
        <FactList
          facts={[
            ["Before", display(event.details.before)],
            ["Requested", display(event.details.requested)],
            ["After", display(event.details.after)],
          ]}
        />
      );
    case "legal-form":
      // T2 (2026-09-17 build plan). `RAISE_REFERRAL`'s own capture keeps its original shape
      // (`formCode`); `RECORD_LEGAL_FORM_EXPIRY` carries the typed value instead
      // (`dueAt`); T4's `CORRECT_LEGAL_FORM_RECEIPT` carries a fixed reason and the corrected
      // instant instead again (`reason`/`correctedReceivedAt`) — the three are discriminated by
      // `event.action`, never assumed from `details` shape alone.
      if (event.action === "RAISE_REFERRAL") {
        return (
          <FactList
            facts={[
              ["Operation", "Initial capture"],
              ["Form", display(event.details.formCode)],
            ]}
          />
        );
      }
      if (event.action === "CORRECT_LEGAL_FORM_RECEIPT") {
        return (
          <FactList
            facts={[
              [
                "Reason",
                event.details.reason ? legalFormReceiptCorrectionReasonLabels[event.details.reason] : "Not recorded",
              ],
              [
                "Receipt corrected",
                event.details.correctedReceivedAt === null
                  ? "Not recorded"
                  : formatInstantWithDay(event.details.correctedReceivedAt, now),
              ],
            ]}
          />
        );
      }
      return (
        <FactList
          facts={[
            [
              "Operation",
              event.details.operation === "extension-recorded"
                ? "Extension recorded"
                : event.details.operation === "continuation-recorded"
                  ? "Continuation recorded"
                  : "Expiry recorded",
            ],
            [
              "Expiry typed",
              event.details.dueAt === null ? "Not recorded" : formatInstantWithDay(event.details.dueAt, now),
            ],
          ]}
        />
      );
    case "record-access":
      return (
        <>
          <FactList facts={[["Open request", display(event.details.requestId)]]} />
          <p className={thirdEdition.quiet}>Discharge opens captured this session.</p>
        </>
      );
    case "review":
      return (
        <FactList
          facts={[["Decision", event.details.decision ? reviewLabels[event.details.decision] : "Not recorded"]]}
        />
      );
    case "discharge":
      return event.details.kind === "care" ? (
        <>
          <FactList facts={[["Care operation", display(event.details.operation)]]} />
          {event.details.recorded && (
            <dl>
              {Object.entries(event.details.recorded)
                .filter(([key]) => key !== "kind")
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
          )}
        </>
      ) : event.details.kind === "follow-up" ? (
        <FactList
          facts={[
            ["Before", display(event.details.before)],
            ["Requested follow-up", display(event.details.requested)],
            ["After", display(event.details.after)],
          ]}
        />
      ) : event.details.kind === "departure" ? (
        <FactList
          facts={[
            ["Before", display(event.details.before)],
            ["After", display(event.details.after)],
            ["Requested destination", destination(event.details.requestedDestination)],
            ["Recorded destination", destination(event.details.recordedDestination)],
          ]}
        />
      ) : (
        <div className={thirdEdition.snapshotStack}>
          <section>
            <h3>Requested change</h3>
            <RequestedBedFacts request={event.details.requested} now={now} />
          </section>
          <section>
            <h3>Before</h3>
            <BedFacts facts={event.details.before} now={now} />
          </section>
          <section>
            <h3>After</h3>
            <BedFacts facts={event.details.after} now={now} />
          </section>
        </div>
      );
    case "inbox":
      return (
        <FactList
          facts={[
            [
              "Action",
              event.action === "TAKE_INBOX_ITEM_OWNERSHIP"
                ? "Ownership taken"
                : event.action === "SNOOZE_INBOX_ITEM"
                  ? "Snoozed"
                  : "Returned from snooze",
            ],
            ["Reason", event.details.reason === null ? "Not recorded" : snoozeReasonLabel(event.details.reason)],
            ["Back at", event.details.until === null ? "Not recorded" : formatInstantWithDay(event.details.until, now)],
          ]}
        />
      );
    case "configuration": {
      const fields = (value: WardConfiguration | null): (readonly [string, ReactNode])[] =>
        value === null
          ? [["Configuration", "Not recorded"]]
          : [
              ["ED access target", `${value.edAccessTargetMinutes} min`],
              ["Parallel referral cap", `${value.parallelReferralCap}`],
              ["Pull hold", `${value.pullHoldMinutes} min`],
            ];
      return (
        <div className={thirdEdition.snapshotStack}>
          <section>
            <h3>Requested change</h3>
            <FactList facts={fields(event.details.requested)} />
          </section>
          <section>
            <h3>Before</h3>
            <FactList facts={fields(event.details.before)} />
          </section>
          <section>
            <h3>After</h3>
            <FactList facts={fields(event.details.after)} />
          </section>
        </div>
      );
    }
  }
}

/**
 * GOVERNANCE (Tabs, owner pick 9 Oct 2026). Oversight across everyone, after the fact: what waits
 * for review, which sites have gaps on the form or in who was told, the audit trail, the registers
 * and the reports. No live clocks and no record buttons for forms here; a name opens Forms, where
 * the live work is.
 */
type GovernanceTab = "review" | "gaps" | "audit" | "registers" | "reports";

const NOT_WIRED = "Not wired in this prototype.";
const FORMS_HREF = "/mockups/ward-flow/legal-forms";

const REVIEWING_ROLES = [
  "Clinical Director",
  "Duty Consultant Psychiatrist",
  "Governance Lead Psychiatrist",
  "Executive Director of Clinical Services",
] as const;
const OUTCOME_TONE: Record<keyof typeof outcomeLabels, WfTone> = {
  accepted: "success",
  partial: "warning",
  denied: "closed",
  stale: "neutral",
};

type GapKey = RecordGap | SupportNotificationParty;
const GAP_KEYS: GapKey[] = ["written", "received", "examination", "carer", "personal_support_person", "mhas"];
const GAP_LABEL: Record<GapKey, string> = {
  written: "Time written",
  received: "Received",
  examination: "Examined",
  carer: "Carer",
  personal_support_person: "PSP",
  mhas: "MHAS",
};
type GapCell = { done: number; total: number };
type SiteGap = {
  id: string;
  name: string;
  kind: "ed" | "ward";
  cells: Record<GapKey, GapCell>;
  gaps: number;
  people: { key: string; name: string; umrn: string; detail: string; missing: string[]; href: string }[];
};

function emptyCells(): Record<GapKey, GapCell> {
  return {
    written: { done: 0, total: 0 },
    received: { done: 0, total: 0 },
    examination: { done: 0, total: 0 },
    carer: { done: 0, total: 0 },
    personal_support_person: { done: 0, total: 0 },
    mhas: { done: 0, total: 0 },
  };
}

/**
 * Gaps by site. Emergency departments carry the recorded facts on the form for their open moves;
 * wards carry carer, PSP and MHAS records for their recent arrivals and discharges. A cell reads
 * done of applicable, and a dash where nothing applies.
 */
function siteGaps(flow: WardFlowContextValue | null, now: Instant): SiteGap[] {
  if (!flow) return [];
  const sites = new Map<string, SiteGap>();
  const site = (id: string, name: string, kind: SiteGap["kind"]) => {
    const existing = sites.get(id);
    if (existing) return existing;
    const created: SiteGap = { id, name, kind, cells: emptyCells(), gaps: 0, people: [] };
    sites.set(id, created);
    return created;
  };
  for (const movement of flow.movements) {
    if (!isOpen(movement) || !movement.legalForm) continue;
    const ed = edById(movement.originEdId);
    const entry = site(`ed-${movement.originEdId}`, ed ? edShortName(ed) : movement.originEdId, "ed");
    const missing: string[] = [];
    for (const fact of recordedFacts(movement)) {
      entry.cells[fact.gap].total += 1;
      if (fact.at !== undefined) entry.cells[fact.gap].done += 1;
      else missing.push(GAP_LABEL[fact.gap]);
    }
    if (missing.length > 0) {
      const person = resolveSubjectPatient(movement, flow);
      entry.gaps += missing.length;
      entry.people.push({
        key: movement.id,
        name: person.formalName,
        umrn: person.umrn,
        detail: `Form ${movement.legalForm.code}`,
        missing,
        href: FORMS_HREF,
      });
    }
  }
  for (const subject of recentTellSubjects(flow, now, false)) {
    if (!subject.unitId) continue;
    const entry = site(`unit-${subject.unitId}`, subject.place, "ward");
    for (const party of subject.parties) {
      entry.cells[party].total += 1;
      if (!subject.missing.includes(party)) entry.cells[party].done += 1;
    }
    if (subject.missing.length > 0) {
      entry.gaps += subject.missing.length;
      entry.people.push({
        key: subject.key,
        name: subject.name,
        umrn: subject.umrn,
        detail: SUPPORT_NOTIFICATION_OCCASION_LABELS[subject.occasion],
        missing: subject.missing.map((party) => SUPPORT_NOTIFICATION_PARTY_SHORT[party]),
        href: subject.movementId ? movementHref(subject.movementId) : FORMS_HREF,
      });
    }
  }
  return [...sites.values()].sort((a, b) => b.gaps - a.gaps || a.name.localeCompare(b.name));
}

function cellTone(cell: GapCell): WfTone | null {
  if (cell.total === 0) return null;
  if (cell.done === cell.total) return "success";
  return cell.done / cell.total < 0.5 ? "warning" : "neutral";
}

function GapPill({ cell, label }: { cell: GapCell; label: string }) {
  const tone = cellTone(cell);
  if (tone === null) {
    return (
      <span className={thirdEdition.gapPill} data-tone="none">
        <span aria-hidden="true">–</span>
        <span className={thirdEdition.srOnly}>{label} not applicable</span>
      </span>
    );
  }
  return (
    <span className={thirdEdition.gapPill} data-tone={tone}>
      <StatusGlyph tone={tone} size={9} />
      <span className={thirdEdition.gapValue}>
        {cell.done}/{cell.total}
      </span>
      <span className={thirdEdition.srOnly}>{label} recorded</span>
    </span>
  );
}

export function GovernanceWorkbench(props: WorkbenchProps) {
  // The open tab survives a demo reset; everything else in the session starts again.
  const [tab, setTab] = useState<GovernanceTab>("gaps");
  return <GovernanceSession key={props.api?.worldGeneration ?? "unavailable"} {...props} tab={tab} setTab={setTab} />;
}

function GovernanceSession({
  movements,
  units,
  now,
  api,
  tab,
  setTab,
}: WorkbenchProps & { tab: GovernanceTab; setTab: (tab: GovernanceTab) => void }) {
  const flow = useContext(WardFlowContext);
  const patientOf = usePatientOf();
  const [category, setCategory] = useState<"all" | AuditCategory>("all");
  const [outcome, setOutcome] = useState<"all" | AuditEvent["outcome"]>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "unreviewed" | AuditReview["decision"]>("all");
  const [selection, setSelection] = useState<AuditEvent | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
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
  const [announcement, setAnnouncement] = useState<string>("");

  const eventRead = api?.readAuditEvents(actor);
  const reviewRead = api?.readAuditReviews(actor);
  const allowed = eventRead?.status === "allowed" && reviewRead?.status === "allowed";
  const events = eventRead?.status === "allowed" ? eventRead.value : [];
  const reviews = reviewRead?.status === "allowed" ? reviewRead.value : [];
  const historyFor = (event: AuditEvent) =>
    reviews.filter((review) => review.eventId === event.id && review.generation === event.generation);
  const reviewState = (event: AuditEvent) => historyFor(event).at(-1)?.decision ?? "unreviewed";
  const reviewable = events.filter((event) => event.category !== "review");
  const toReview = reviewable.filter((event) => reviewState(event) !== "reviewed").reverse();
  const reviewedCount = reviewable.filter((event) => reviewState(event) === "reviewed").length;
  const followUp = reviewable.filter((event) => reviewState(event) === "follow-up-required").length;
  const unreviewed = reviewable.filter((event) => reviewState(event) === "unreviewed").length;
  const visible = [...events]
    .filter(
      (event) =>
        (category === "all" || event.category === category) &&
        (outcome === "all" || event.outcome === outcome) &&
        (reviewFilter === "all" || (event.category !== "review" && reviewState(event) === reviewFilter)),
    )
    .reverse();
  const selected =
    allowed &&
    selection &&
    events.some((event) => event.id === selection.id && event.generation === selection.generation)
      ? selection
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
  const savedReview = pending ? history[pending.count] : undefined;
  const confirmed =
    reviewAttempt?.outcome === "accepted" &&
    savedReview?.decision === pending?.decision &&
    savedReview?.at === pending?.at;
  const reviewPending = pending !== null && reviewAttempt === undefined;
  const canReview = allowed && selected !== null && selected.category !== "review" && !reviewPending;

  const sites = siteGaps(flow, now);
  const totalGaps = sites.reduce((sum, entry) => sum + entry.gaps, 0);
  const site = sites.find((entry) => entry.id === siteId) ?? null;
  const overrideCount = toReview.filter((event) => event.category === "override").length;
  const refusedCount = toReview.filter((event) => event.outcome === "denied" || event.outcome === "stale").length;
  const accessCount = toReview.filter((event) => event.category === "record-access").length;

  const choose = (event: AuditEvent | null) => {
    setSelection(event);
    setPending(null);
    if (event) setAnnouncement(`Selected ${actionLabels[event.action]}.`);
  };

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

  function recordReview(decision: AuditReview["decision"]) {
    if (!api || !canReview || !selected || selected.generation !== api.worldGeneration) return;
    const count = history.length;
    setPending({
      eventId: selected.id,
      generation: selected.generation,
      count,
      sequence: events.at(-1)?.sequence ?? 0,
      at: now,
      decision,
    });
    api.dispatch({
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      now,
      eventId: selected.id,
      expectedGeneration: selected.generation,
      expectedReviewCount: count,
      decision,
    });
  }

  function closeEndorse() {
    setEndorseOpen(false);
    setEndorseVerdict("");
    setEndorseRole("");
    setEndorseNotes("");
  }

  function startReview() {
    setTab("review");
    choose(toReview[0] ?? null);
  }

  const TAB_LABEL: Record<GovernanceTab, string> = {
    review: "Review",
    gaps: "Gaps by site",
    audit: "Audit trail",
    registers: "Registers",
    reports: "Reports",
  };
  const heroTitle =
    tab === "review"
      ? toReview.length === 0
        ? "Nothing to review"
        : `${toReview.length} to review`
      : tab === "gaps"
        ? totalGaps === 0
          ? "No gaps recorded"
          : `${totalGaps} ${totalGaps === 1 ? "gap" : "gaps"} across ${sites.filter((entry) => entry.gaps > 0).length} sites`
        : tab === "audit"
          ? "Audit trail"
          : tab === "registers"
            ? "Restrictive practice and incidents"
            : "Reports";
  const heroStats =
    tab === "review" ? (
      <>
        <HeroStat value={overrideCount} label="Overrides" />
        <HeroStat value={refusedCount} label="Refused or stale" />
        <HeroStat value={accessCount} label="Record access" />
        <HeroStat value={followUp} label="Follow-up" tone={followUp > 0 ? "warning" : undefined} />
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

  const detail = (
    <EventDetail
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
      feedback={
        pending
          ? confirmed
            ? `${reviewLabels[pending.decision]} recorded.`
            : reviewAttempt
              ? "Review not recorded. The record may have changed; select it again."
              : "Recording review…"
          : ""
      }
    />
  );

  return (
    <div className={thirdEdition.governanceWorkspace} data-testid="ward-governance-workbench" data-ward-design="v8">
      <WardBarPageTools label="Governance tools">
        <button type="button" className={wardBarToolClass} onClick={startReview}>
          <ShieldCheck size={14} aria-hidden="true" />
          <span className={wardBarToolLabelClass}>Start review</span>
          <span className={wardBarToolCountClass}>{toReview.length}</span>
        </button>
        <Link href={PATIENT_CHRONOLOGY_HREF} className={wardBarToolClass}>
          <History size={14} aria-hidden="true" />
          <span className={wardBarToolLabelClass}>PIR chronology</span>
        </Link>
        <button
          type="button"
          className={wardBarToolClass}
          aria-disabled="true"
          title={NOT_WIRED}
          onClick={ignoreUnavailableActivation}
        >
          <Download size={14} aria-hidden="true" />
          <span className={wardBarToolLabelClass}>Export</span>
        </button>
      </WardBarPageTools>

      <Hero
        level={2}
        eyebrow="Governance · This session"
        title={heroTitle}
        stats={heroStats}
        aside={
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
            <Button variant="light" size="sm" onClick={() => setEndorseOpen(true)}>
              Record review
            </Button>
          </span>
        }
        bar={
          <HeroTrack<GovernanceTab>
            label="Governance views"
            value={tab}
            onChange={changeTab}
            items={[
              { id: "review", label: "Review", count: toReview.length },
              { id: "gaps", label: "Gaps by site" },
              { id: "audit", label: "Audit trail" },
              { id: "registers", label: "Registers" },
              { id: "reports", label: "Reports" },
            ]}
          />
        }
        barAside={
          <Badge variant="onHero" tone="neutral">
            Safety incidents not recorded here
          </Badge>
        }
      />

      {tab === "review" ? (
        <div className={thirdEdition.govLayout}>
          <Card className={thirdEdition.registerCard} aria-labelledby="governance-review-title">
            <CardHead
              id="governance-review-title"
              icon={ShieldCheck}
              title="Waiting for review"
              meta={<Count n={toReview.length} />}
              aside={
                <span className={thirdEdition.quietText}>
                  Overrides, refused actions and record access. Newest first.
                </span>
              }
            />
            <EventTable
              label="Waiting for review"
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
                  <p>No override audit is recorded in this session.</p>
                </div>
              }
            />
          </Card>
          {detail}
        </div>
      ) : null}

      {tab === "gaps" ? (
        <div className={thirdEdition.govLayout}>
          <div className={thirdEdition.stackGap}>
            <Card className={thirdEdition.registerCard} aria-labelledby="governance-gaps-title">
              <CardHead
                id="governance-gaps-title"
                title="Sites and requirements"
                aside={<span className={thirdEdition.quietText}>Done of applicable. A name opens Forms.</span>}
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
          <Card className={thirdEdition.detailCard} aria-label={site ? site.name : "All sites"}>
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
                </div>
              }
              allowed={allowed}
            />
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
          {detail}
        </div>
      ) : null}

      {tab === "registers" ? (
        <div className={thirdEdition.stackGap}>
          <div className={thirdEdition.previewGrid}>
            {[
              {
                title: "Seclusion",
                text: "Form 11 records: start, reviews, release and duration by ward.",
              },
              {
                title: "Bodily restraint",
                text: "Form 10 records: start, reviews, release and duration by ward.",
              },
              {
                title: "Notifiable incidents",
                text: "AWOL, death and serious harm, with the time the Chief Psychiatrist was told.",
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
            <GovernanceOverridesRegisterPanel movements={movements} units={units} now={now} />
            <GovernanceAccessRecordPanel />
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
              text: "Restrictive practice and incident counts. Needs Form 10, Form 11 and incident records.",
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
              <CardFoot>
                <Button variant="sec" size="sm" disabledReason={NOT_WIRED} reasonDisplay="tooltip">
                  Open
                </Button>
              </CardFoot>
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
                recordReview(endorseVerdict);
                setAnnouncement("Review recorded.");
                closeEndorse();
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

/** A list of captured events: one button per row, arrow keys move between them. */
function EventTable({
  label,
  rows,
  selected,
  now,
  patientOf,
  reviewState,
  onChoose,
  onKey,
  empty,
  allowed = true,
}: {
  label: string;
  rows: AuditEvent[];
  selected: AuditEvent | null;
  now: Instant;
  patientOf: ReturnType<typeof usePatientOf>;
  reviewState: (event: AuditEvent) => "unreviewed" | AuditReview["decision"];
  onChoose: (event: AuditEvent) => void;
  onKey: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  empty: ReactNode;
  allowed?: boolean;
}) {
  return (
    <div className={thirdEdition.capturedList}>
      <div className={thirdEdition.eventHeader} aria-hidden="true">
        <span>When</span>
        <span>What</span>
        <span>Record</span>
        <span>By</span>
        <span>Outcome</span>
        <span>Review</span>
      </div>
      <div className={thirdEdition.registerBody} role="region" aria-label={label} tabIndex={0} onKeyDown={onKey}>
        {!allowed ? (
          <div className={thirdEdition.emptyBlock}>
            <Fingerprint aria-hidden="true" size={16} />
            <h3>Record access unavailable</h3>
            <p>These records require the coordinator role.</p>
          </div>
        ) : rows.length === 0 ? (
          empty
        ) : (
          rows.map((event) => {
            const state = event.category === "review" ? "Review attempt" : reviewState(event);
            return (
              <button
                type="button"
                key={`${event.generation}-${event.id}`}
                data-audit-row={event.id}
                className={thirdEdition.eventRow}
                aria-pressed={selected?.id === event.id}
                aria-controls="governance-event-detail"
                onClick={() => onChoose(event)}
              >
                <span className={thirdEdition.eventTime}>{when(event.at, now)}</span>
                <span className={thirdEdition.stack}>
                  <strong className={thirdEdition.clip}>{actionLabels[event.action]}</strong>
                  <span className={cx(thirdEdition.quietText, thirdEdition.clip)}>
                    {categoryLabels[event.category]}
                  </span>
                </span>
                <span className={thirdEdition.clip}>{subjectLabel(event, patientOf)}</span>
                <span className={thirdEdition.clip}>
                  {event.actor.role ? WARD_FLOW_ROLE_LABELS[event.actor.role] : "Role unavailable"}
                </span>
                <span className={thirdEdition.statusText}>
                  <StatusGlyph tone={OUTCOME_TONE[event.outcome]} size={9} />
                  {outcomeLabels[event.outcome]}
                </span>
                <span className={thirdEdition.statusText}>
                  <StatusGlyph
                    tone={state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : "neutral"}
                    size={9}
                  />
                  {state === "Review attempt"
                    ? "Review attempt"
                    : state === "unreviewed"
                      ? "Unreviewed"
                      : reviewLabels[state]}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** The side panel for one captured event: its facts, links to the record, and the review. */
function EventDetail({
  selected,
  units,
  movements,
  api,
  events,
  history,
  now,
  patientOf,
  reviewState,
  canReview,
  onReview,
  onChoose,
  feedback,
}: {
  selected: AuditEvent | null;
  units: Unit[];
  movements: Movement[];
  api?: GovernanceApi;
  events: readonly AuditEvent[];
  history: AuditReview[];
  now: Instant;
  patientOf: ReturnType<typeof usePatientOf>;
  reviewState: (event: AuditEvent) => "unreviewed" | AuditReview["decision"];
  canReview: boolean;
  onReview: (decision: AuditReview["decision"]) => void;
  onChoose: (event: AuditEvent) => void;
  feedback: string;
}) {
  const subject = selected?.subject;
  const subjectWardId = subject?.kind === "admission" || subject?.kind === "bed-release" ? subject.unitId : null;
  const matchingWard = units.filter((unit) => unit.id === subjectWardId);
  const subjectExists =
    subject?.kind === "admission"
      ? api?.admissions.filter((entry) => entry.id === subject.admissionId).length === 1
      : subject?.kind === "bed-release"
        ? api?.bedReleases.filter((entry) => entry.id === subject.releaseId).length === 1
        : false;
  const movementExists =
    subject?.kind === "movement" && movements.filter((entry) => entry.id === subject.movementId).length === 1;
  const referenced = subject?.kind === "audit-event" ? events.find((entry) => entry.id === subject.eventId) : undefined;
  const state = selected ? (selected.category === "review" ? "review" : reviewState(selected)) : null;

  return (
    <Card
      id="governance-event-detail"
      className={thirdEdition.detailCard}
      data-testid="ward-governance-override-detail"
      aria-label="Selected event detail"
    >
      <h2 className={thirdEdition.srOnly}>Event detail</h2>
      <span className={thirdEdition.srOnly}>Select an event from the register</span>
      <div className={thirdEdition.detailHead}>
        <div className={thirdEdition.stack}>
          <span className={thirdEdition.eyebrow}>{selected ? categoryLabels[selected.category] : "Event detail"}</span>
          <h3 className={thirdEdition.detailTitle} id="inspectorHeading">
            {selected ? actionLabels[selected.action] : "Nothing selected"}
          </h3>
        </div>
        {state ? (
          <span className={thirdEdition.statusText}>
            <StatusGlyph
              tone={state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : "neutral"}
              size={9}
            />
            {state === "review" ? "Review attempt" : state === "unreviewed" ? "To review" : reviewLabels[state]}
          </span>
        ) : null}
      </div>

      <div className={thirdEdition.detailBody} role="region" aria-label="Event facts" tabIndex={0}>
        {selected ? (
          <>
            <FactList
              facts={[
                ["Record", subjectLabel(selected, patientOf)],
                ["Recorded", when(selected.at, now)],
                ["Role recorded", selected.actor.role ? WARD_FLOW_ROLE_LABELS[selected.actor.role] : "Not recorded"],
                ...(selected.actor.actingUnitId
                  ? [
                      [
                        "Acting ward",
                        units.find((unit) => unit.id === selected.actor.actingUnitId)?.name ?? "Unresolved ward",
                      ] as const,
                    ]
                  : []),
                ...(selected.reasonCode !== "none"
                  ? [["Outcome reason", reasonLabels[selected.reasonCode]] as const]
                  : []),
              ]}
            />
            {(movementExists || (subjectExists && matchingWard.length === 1) || referenced) && (
              <div className={thirdEdition.entityLinks}>
                {movementExists && subject?.kind === "movement" && (
                  <Link href={movementHref(subject.movementId)} className={buttonClass({ size: "sm" })}>
                    Open movement <ChevronRight aria-hidden="true" size={14} />
                  </Link>
                )}
                {subjectExists && matchingWard.length === 1 && (
                  <Link href={unitHref(matchingWard[0].id)} className={buttonClass({ size: "sm" })}>
                    Open {matchingWard[0].name} <ChevronRight aria-hidden="true" size={14} />
                  </Link>
                )}
                {referenced && (
                  <Button size="sm" onClick={() => onChoose(referenced)}>
                    Inspect {referenced.id}
                  </Button>
                )}
              </div>
            )}
            <div className={thirdEdition.operationFacts}>
              <h3 className={thirdEdition.subheading}>Recorded facts</h3>
              <EventFacts event={selected} units={units} now={now} />
            </div>
          </>
        ) : (
          <EmptyState icon={ClipboardList} title="Select an event from the register" />
        )}
      </div>

      <section
        className={thirdEdition.recordPane}
        data-testid="ward-governance-decision-record"
        aria-label="Administrative review"
      >
        <div className={thirdEdition.stack}>
          <h3 className={thirdEdition.blockTitle}>Your review</h3>
          <span className={thirdEdition.quietText}>
            {selected
              ? `${history.length} recorded ${history.length === 1 ? "review" : "reviews"} · role recorded`
              : "No event selected"}
          </span>
        </div>
        <div className={thirdEdition.reviewBody} role="region" aria-label="Review history" tabIndex={0}>
          {selected && history.length ? (
            <ol className={thirdEdition.timeline}>
              {[...history].reverse().map((review) => (
                <li key={review.id}>
                  <StatusGlyph tone={review.decision === "reviewed" ? "success" : "warning"} size={9} />
                  <span className={thirdEdition.stack}>
                    <strong>{reviewLabels[review.decision]}</strong>
                    <span className={thirdEdition.quietText}>{when(review.at, now)} · Flow coordinator</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={thirdEdition.quiet}>
              {selected?.category === "review"
                ? "Review attempts cannot be reviewed."
                : selected
                  ? "No review recorded for this event."
                  : "Choose an event to review."}
            </p>
          )}
        </div>
        <div className={thirdEdition.reviewActions}>
          <Button size="sm" disabled={!canReview} onClick={() => onReview("reviewed")}>
            Mark reviewed
          </Button>
          <Button size="sm" variant="ghost" disabled={!canReview} onClick={() => onReview("follow-up-required")}>
            Follow-up required
          </Button>
        </div>
        <p className={thirdEdition.feedback} role="status" aria-live="polite">
          {feedback}
        </p>
      </section>
    </Card>
  );
}
