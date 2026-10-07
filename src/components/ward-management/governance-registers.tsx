"use client";

import { ChevronRight, ClipboardList, Fingerprint, History, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { OverrideRegister } from "@/components/ward-management/override-register";
import { allOverrides } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { ACCESS_RECORD_NOTE } from "@/components/ward-management/search/access-record";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { WardConfiguration } from "./ward-configuration";
import type { useWardFlow } from "./ward-flow-provider";
import type {
  AuditCategory,
  AuditEvent,
  AuditReview,
  BedReleaseAuditFacts,
  BedReleaseAuditRequest,
} from "./ward-audit";
import { LEAVING_DESTINATIONS } from "./ward-admissions";
import { legalFormReceiptCorrectionReasonLabels } from "./ward-change-reasons";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import { movementHref, unitHref } from "./shell/ward-facade";
import {
  Avatar,
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
  Inset,
  Radio,
  Segmented,
  Select,
  StatusGlyph,
  TextInput,
  Textarea,
  ToastView,
  buttonClass,
  cx,
  tableClasses,
  type BarListRow,
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

type GovernanceRegisterTab = "overrides" | "captured" | "decisions" | "restrictive" | "search-seizure";

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

type OverrideStatus = "Pending Review" | "Upheld" | "To committee" | "Follow-up" | "Not upheld";

interface GovernanceOverrideItem {
  id: string;
  movement: string;
  patient: string;
  unit: string;
  service: string;
  category: string;
  reason: string;
  by: string;
  recordedAgoText: string;
  status: OverrideStatus;
  reviewed: boolean;
  reviewer?: string | null;
  decision?: string | null;
  reviewerReason?: string | null;
}

interface GovernanceDecisionItem {
  id: string;
  auditor: string;
  time: string;
  subject: string;
  category: string;
  verdict: string;
  tone: "good" | "warn" | "accent" | "closed";
}

interface GovernanceRestrictiveItem {
  id: string;
  form: string;
  patient: string;
  unit: string;
  authorisedBy: string;
  startTime: string;
  reviewDue: string;
  status: string;
  tone: "good" | "warn" | "accent";
}

interface GovernanceSearchSeizureItem {
  id: string;
  patient: string;
  unit: string;
  officer: string;
  articles: string;
  time: string;
  status: string;
  tone: "good" | "warn" | "accent";
}

const SAMPLE_OVERRIDES: GovernanceOverrideItem[] = [
  {
    id: "OVR-107",
    movement: "WF-014",
    patient: "Harper, Chloe",
    unit: "bty-adult-secure",
    service: "East Metro",
    category: "Acuity Ceiling Override",
    reason: "Emergency department escalation · locked bed bypass authorised to mitigate acute self-harm risk.",
    by: "Duty Consultant Psychiatrist",
    recordedAgoText: "Earlier today",
    status: "Pending Review",
    reviewed: false,
    reviewer: null,
    decision: null,
    reviewerReason: null,
  },
  {
    id: "OVR-106",
    movement: "WF-022",
    patient: "Gallagher, Liam",
    unit: "scgh-mental-health-unit",
    service: "North Metro",
    category: "Catchment Boundary Bypass",
    reason:
      "Catchment boundary bypass authorised: patient resides in South Metro, urgent specialist stabilization needed.",
    by: "State Bed Coordinator",
    recordedAgoText: "Shift handover",
    status: "Pending Review",
    reviewed: false,
    reviewer: null,
    decision: null,
    reviewerReason: null,
  },
  {
    id: "OVR-105",
    movement: "WF-004",
    patient: "Vance, Eleanor",
    unit: "bty-adult-secure",
    service: "East Metro",
    category: "Legal Form Deadline Review",
    reason: "Involuntary detention Form 3D continuation review expedited pending statutory tribunal scheduling.",
    by: "Flow Coordinator",
    recordedAgoText: "Morning roll-up",
    status: "Pending Review",
    reviewed: false,
    reviewer: null,
    decision: null,
    reviewerReason: null,
  },
  {
    id: "OVR-104",
    movement: "WF-028",
    patient: "Chen, Marcus",
    unit: "fre-adult-open",
    service: "South Metro to East Metro",
    category: "Catchment Boundary Bypass",
    reason: "Receiving clinical team agreed placement due to specialized dual-diagnosis rehabilitation program.",
    by: "State Bed Coordinator",
    recordedAgoText: "Yesterday",
    status: "Upheld",
    reviewed: true,
    reviewer: "Clinical Director",
    decision: "Upheld in Full",
    reviewerReason:
      "Clinical justification verified against admission continuity protocol. Cross-boundary placement supported.",
  },
  {
    id: "OVR-103",
    movement: "WF-009",
    patient: "Wren, Tobias",
    unit: "gry-adult-secure",
    service: "North Metro",
    category: "Acuity Ceiling Override",
    reason: "Emergency department escalation · locked bed bypass authorised to mitigate acute self-harm risk.",
    by: "Duty Consultant Psychiatrist",
    recordedAgoText: "Earlier today",
    status: "Upheld",
    reviewed: true,
    reviewer: "Clinical Director",
    decision: "Upheld in Full",
    reviewerReason: "Emergency bypass justified by high-acuity crisis presentation. Staffing uplift confirmed on ward.",
  },
  {
    id: "OVR-102",
    movement: "WF-011",
    patient: "Al-Mansoor, Tariq",
    unit: "bty-adult-secure",
    service: "North Metro to East Metro",
    category: "Cohort & Gender Mix Exception",
    reason: "Specialist trauma-informed single room placement allocated following high occupancy in secure corridor.",
    by: "State Bed Coordinator",
    recordedAgoText: "Yesterday morning",
    status: "Upheld",
    reviewed: true,
    reviewer: "Governance Lead Psychiatrist",
    decision: "Upheld with Recommendations",
    reviewerReason: "Placement satisfied safety criteria with dedicated 1:1 nursing cohort plan documented.",
  },
  {
    id: "OVR-101",
    movement: "WF-031",
    patient: "Miller, David",
    unit: "bun-adult-open",
    service: "North Metro to WACHS",
    category: "Catchment Boundary Bypass",
    reason: "Metropolitan ICU bed saturation decompression · regional bed allocated with medical transport.",
    by: "Executive Director On-Call",
    recordedAgoText: "Previous shift",
    status: "Upheld",
    reviewed: true,
    reviewer: "Governance Lead Psychiatrist",
    decision: "Upheld in Full",
    reviewerReason: "Inter-hospital transfer executed under statewide critical care load balancing policy.",
  },
];

const SAMPLE_DECISIONS: GovernanceDecisionItem[] = [
  {
    id: "DEC-091",
    auditor: "Clinical Director",
    time: "Yesterday",
    subject: "Chen, Marcus",
    category: "Catchment Boundary Bypass",
    verdict: "Upheld in Full",
    tone: "good",
  },
  {
    id: "DEC-090",
    auditor: "Clinical Director",
    time: "Earlier today",
    subject: "Wren, Tobias",
    category: "Acuity Ceiling Override",
    verdict: "Upheld in Full",
    tone: "good",
  },
  {
    id: "DEC-089",
    auditor: "Governance Lead Psychiatrist",
    time: "Yesterday morning",
    subject: "Al-Mansoor, Tariq",
    category: "Cohort & Gender Mix Exception",
    verdict: "Upheld with Recommendations",
    tone: "good",
  },
  {
    id: "DEC-088",
    auditor: "Governance Lead Psychiatrist",
    time: "Previous shift",
    subject: "Miller, David",
    category: "Catchment Boundary Bypass",
    verdict: "Upheld in Full",
    tone: "good",
  },
];

const SAMPLE_RESTRICTIVE_PRACTICES: GovernanceRestrictiveItem[] = [
  {
    id: "RP-101",
    form: "Bodily restraint",
    patient: "Harper, Chloe · UMRN UM100412",
    unit: "Bentley · Adult Secure Unit",
    authorisedBy: "Dr. S. Banner (Consultant)",
    startTime: "Earlier today",
    reviewDue: "Midday review",
    status: "Active · Clinical Observation",
    tone: "warn",
  },
  {
    id: "RP-102",
    form: "Seclusion",
    patient: "Vance, Eleanor · UMRN UM100884",
    unit: "Bentley · Adult Secure Unit",
    authorisedBy: "Dr. C. Thorne (Duty Consultant)",
    startTime: "Yesterday morning",
    reviewDue: "Concluded",
    status: "Concluded · Form 11B Endorsed",
    tone: "good",
  },
  {
    id: "RP-103",
    form: "Bodily restraint",
    patient: "Gallagher, Liam · UMRN UM100721",
    unit: "Sir Charles Gairdner MHU",
    authorisedBy: "Dr. M. Reid (Psychiatrist)",
    startTime: "Previous shift",
    reviewDue: "Concluded",
    status: "Ceased · Clinical Review",
    tone: "good",
  },
];

const SAMPLE_SEARCH_SEIZURE: GovernanceSearchSeizureItem[] = [
  {
    id: "SS-2026-081",
    patient: "Chen, Marcus · UMRN UM100612",
    unit: "Fremantle · Adult Mental Health",
    officer: "Authorised Mental Health Practitioner",
    articles: "Prohibited electronic recording device",
    time: "Yesterday morning",
    status: "Secured in Ward Safe",
    tone: "accent",
  },
  {
    id: "SS-2026-079",
    patient: "Wren, Tobias · UMRN UM100503",
    unit: "Graylands · Secure Care Unit",
    officer: "Senior Registered Nurse",
    articles: "Non-prescribed medication",
    time: "Earlier today",
    status: "Logged & Handed to Pharmacy",
    tone: "good",
  },
];

/** Original required props remain compatible; only the mounted coordinator view supplies its guarded API. */
/** The review verdicts a reviewer can record. The first three are the inline choices. */
const VERDICTS: { id: string; label: string; status: OverrideStatus; tone: GovernanceDecisionItem["tone"] }[] = [
  { id: "Upheld", label: "Uphold", status: "Upheld", tone: "good" },
  { id: "Referred to committee", label: "Refer to committee", status: "To committee", tone: "accent" },
  { id: "Follow-up required", label: "Follow-up", status: "Follow-up", tone: "warn" },
  { id: "Not upheld", label: "Not upheld", status: "Not upheld", tone: "closed" },
];
const REVIEWING_ROLES = [
  "Clinical Director",
  "Duty Consultant Psychiatrist",
  "Governance Lead Psychiatrist",
  "Executive Director of Clinical Services",
] as const;
const DECISION_TONE: Record<GovernanceDecisionItem["tone"], WfTone> = {
  good: "success",
  warn: "warning",
  accent: "info",
  closed: "closed",
};
const OUTCOME_TONE: Record<keyof typeof outcomeLabels, WfTone> = {
  accepted: "success",
  partial: "warning",
  denied: "closed",
  stale: "neutral",
};
const TYPE_LABELS: Record<string, string> = {
  "Acuity Ceiling Override": "Acuity ceiling",
  "Catchment Boundary Bypass": "Catchment bypass",
  "Legal Form Deadline Review": "Legal form deadline",
  "Cohort & Gender Mix Exception": "Cohort and gender mix",
};
function overrideTypeLabel(category: string): string {
  return TYPE_LABELS[category] ?? category;
}
function roleInitials(role: string): string {
  return role
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
function statusTone(status: OverrideStatus): WfTone {
  if (status === "Upheld") return "success";
  if (status === "To committee") return "info";
  if (status === "Not upheld") return "closed";
  return "warning";
}
/** Overrides per type, with the role that said yes most often when it did so twice or more. */
function overrideTypeRows(list: GovernanceOverrideItem[]): BarListRow[] {
  const byType = new Map<string, Map<string, number>>();
  for (const item of list) {
    const roles = byType.get(item.category) ?? new Map<string, number>();
    roles.set(item.by, (roles.get(item.by) ?? 0) + 1);
    byType.set(item.category, roles);
  }
  return [...byType.entries()]
    .map(([category, roles]) => {
      const value = [...roles.values()].reduce((sum, n) => sum + n, 0);
      const [topRole, topCount] = [...roles.entries()].sort((a, b) => b[1] - a[1])[0]!;
      const repeat = topCount >= 2;
      return {
        id: category,
        label: overrideTypeLabel(category),
        value,
        flag: repeat ? ("warning" as const) : undefined,
        display: (
          <span className={thirdEdition.barValue}>
            <span>{value}</span>
            <span className={repeat ? thirdEdition.repeat : thirdEdition.quietText}>
              {repeat ? `Repeat, ${roleInitials(topRole)} ×${topCount}` : "No repeat"}
            </span>
          </span>
        ),
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function GovernanceWorkbench(props: WorkbenchProps) {
  return <GovernanceSession key={props.api?.worldGeneration ?? "unavailable"} {...props} />;
}

function GovernanceSession({ movements, units, now, api, sampleData }: WorkbenchProps) {
  const hasSampleData = sampleData !== undefined ? sampleData : Boolean(api);
  const patientOf = usePatientOf();
  const [tab, setTab] = useState<GovernanceRegisterTab>("overrides");
  const [category, setCategory] = useState<"all" | AuditCategory>("all");
  const [outcome, setOutcome] = useState<"all" | AuditEvent["outcome"]>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "unreviewed" | AuditReview["decision"]>("all");
  const [selection, setSelection] = useState<AuditEvent | null>(null);
  const [pending, setPending] = useState<{
    eventId: string;
    generation: number;
    count: number;
    sequence: number;
    at: Instant;
    decision: AuditReview["decision"];
  } | null>(null);

  const [overrideList, setOverrideList] = useState<GovernanceOverrideItem[]>(hasSampleData ? SAMPLE_OVERRIDES : []);
  const [decisionList, setDecisionList] = useState<GovernanceDecisionItem[]>(hasSampleData ? SAMPLE_DECISIONS : []);
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(hasSampleData ? "OVR-107" : null);

  const [overrideScope, setOverrideScope] = useState<"all" | "open" | "closed">("all");
  const [inlineTried, setInlineTried] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // The endorse form starts empty. It used to arrive pre-filled with a verdict, a reviewing role and
  // a finding of "no adverse patient safety events", so a reviewer who saved without typing recorded
  // a review nobody wrote (26 September 2026 sweep, A3).
  const [endorseVerdict, setEndorseVerdict] = useState<string>("");
  const [endorseRole, setEndorseRole] = useState<string>("");
  const [endorseNotes, setEndorseNotes] = useState<string>("");

  const endorseTriggerRef = useRef<HTMLElement | null>(null);
  const endorseModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const modal = endorseModalRef.current;
    if (!modal) return;
    const firstFocusable = modal.querySelector<HTMLElement>(
      'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [modalOpen]);

  function handleEndorseModalKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const modal = endorseModalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const eventRead = api?.readAuditEvents(actor);
  const reviewRead = api?.readAuditReviews(actor);
  const allowed = eventRead?.status === "allowed" && reviewRead?.status === "allowed";
  const events = eventRead?.status === "allowed" ? eventRead.value : [];
  const reviews = reviewRead?.status === "allowed" ? reviewRead.value : [];
  const historyFor = (event: AuditEvent) =>
    reviews.filter((review) => review.eventId === event.id && review.generation === event.generation);
  const reviewState = (event: AuditEvent) => historyFor(event).at(-1)?.decision ?? "unreviewed";
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
  const overrides = allOverrides(movements);

  const totalMonitored = overrideList.length;
  const reviewedUpheld = overrideList.filter((o) => o.status === "Upheld").length;

  const selectedOverride = overrideList.find((o) => o.id === selectedOverrideId) ?? overrideList[0];

  // Modal Escape key listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && modalOpen) {
        closeEndorseModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3400);
  }

  const tabs: { id: GovernanceRegisterTab; label: string; count?: number }[] = [
    { id: "overrides", label: "Overrides", count: totalMonitored },
    { id: "decisions", label: "Outcomes", count: decisionList.length },
    {
      id: "restrictive",
      label: "Forms 10, 11",
      count: hasSampleData ? SAMPLE_RESTRICTIVE_PRACTICES.length : 0,
    },
    {
      id: "search-seizure",
      label: "Form 8",
      count: hasSampleData ? SAMPLE_SEARCH_SEIZURE.length : 0,
    },
  ];

  const inspStatus = selected
    ? selected.category === "review"
      ? "Review attempt"
      : reviewState(selected) === "unreviewed"
        ? "Unreviewed"
        : reviewLabels[reviewState(selected) as AuditReview["decision"]]
    : selectedOverride
      ? selectedOverride.status === "Pending Review"
        ? "Pending review"
        : selectedOverride.status
      : "No selection";
  const inspTone: WfTone = selected
    ? reviewState(selected) === "reviewed"
      ? "success"
      : "warning"
    : selectedOverride
      ? statusTone(selectedOverride.status)
      : "neutral";

  const choose = (event: AuditEvent | null) => {
    setSelection(event);
    setPending(null);
    if (event) {
      setSelectedOverrideId(null);
      setAnnouncement(`Selected ${actionLabels[event.action]}.`);
    }
  };

  function changeTab(next: GovernanceRegisterTab) {
    setTab(next);
    choose(null);
    if (next === "overrides") {
      setSelectedOverrideId(hasSampleData ? "OVR-107" : null);
    }
    setAnnouncement(
      next === "overrides" || next === "captured"
        ? "Overrides register view shown."
        : next === "decisions"
          ? "Decision log view shown."
          : next === "restrictive"
            ? "Restrictive practices register view shown."
            : "Search and seizure register view shown.",
    );
  }

  function rowKey(event: ReactKeyboardEvent<HTMLDivElement>) {
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
    choose(visible[next] ?? null);
  }

  function recordReview(decision: AuditReview["decision"]) {
    if (
      !api ||
      !allowed ||
      !selected ||
      selected.category === "review" ||
      selected.generation !== api.worldGeneration ||
      reviewPending
    )
      return;
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

  function chooseOverride(item: GovernanceOverrideItem) {
    setSelectedOverrideId(item.id);
    setSelection(null);
    setPending(null);
    setInlineTried(false);
    setAnnouncement(`Selected override for ${item.patient}.`);
  }

  function resetDraft() {
    setEndorseVerdict("");
    setEndorseRole("");
    setEndorseNotes("");
    setInlineTried(false);
  }

  /** Records the drafted review against the selected override. False when the draft is incomplete. */
  function recordOverrideReview(): boolean {
    if (!selectedOverride) return false;
    const verdict = VERDICTS.find((entry) => entry.id === endorseVerdict);
    if (!verdict || endorseRole === "") {
      const refusal = "Choose a verdict and a reviewing role before recording the finding.";
      showToast(refusal);
      setAnnouncement(refusal);
      return false;
    }
    setOverrideList((prev) =>
      prev.map((item) =>
        item.id === selectedOverride.id
          ? {
              ...item,
              status: verdict.status,
              reviewed: true,
              reviewer: endorseRole,
              decision: verdict.id,
              reviewerReason: endorseNotes,
            }
          : item,
      ),
    );
    const newDecision: GovernanceDecisionItem = {
      id: `DEC-${decisionList.length + 1}`,
      auditor: endorseRole,
      time: "Just now",
      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
      subject: selectedOverride.patient,
      category: selectedOverride.category,
      verdict: verdict.id,
      tone: verdict.tone,
    };
    setDecisionList((prev) => [newDecision, ...prev]);
    resetDraft();
    showToast("Review recorded.");
    setAnnouncement(`Override for ${selectedOverride.patient} reviewed and recorded.`);
    return true;
  }

  function openEndorseModal() {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      endorseTriggerRef.current = document.activeElement;
    }
    setModalOpen(true);
  }

  function closeEndorseModal() {
    setModalOpen(false);
    endorseTriggerRef.current?.focus();
  }

  function submitEndorsement() {
    if (selected && selected.category !== "review") {
      recordReview("reviewed");
      closeEndorseModal();
      showToast("Review recorded.");
      setAnnouncement("Review recorded.");
      return;
    }

    if (recordOverrideReview()) closeEndorseModal();
  }

  const unreviewed = events.filter(
    (event) => event.category !== "review" && reviewState(event) === "unreviewed",
  ).length;
  const followUp = events.filter(
    (event) => event.category !== "review" && reviewState(event) === "follow-up-required",
  ).length;
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

  const reviewedCount = events.filter(
    (event) => event.category !== "review" && reviewState(event) === "reviewed",
  ).length;
  const pendingOverrides = overrideList.filter((o) => o.status === "Pending Review").length;
  const toCommittee = overrideList.filter((o) => o.status === "To committee").length;
  const openOverrides = overrideList.filter((o) => o.status === "Pending Review");
  const closedOverrides = overrideList.filter((o) => o.status !== "Pending Review");
  const shownOverrides =
    overrideScope === "open" ? openOverrides : overrideScope === "closed" ? closedOverrides : overrideList;
  const typeRows = overrideTypeRows(overrideList);
  const typeMean = typeRows.length ? overrideList.length / typeRows.length : 0;
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? null;
  const showEventDetail = selected !== null;
  const tabTitle =
    tab === "decisions"
      ? "Outcomes"
      : tab === "restrictive"
        ? "Restrictive practices"
        : tab === "search-seizure"
          ? "Search and seizure"
          : "Overrides and exceptions";
  const tabCount =
    tab === "decisions"
      ? decisionList.length
      : tab === "restrictive"
        ? tabs[2].count
        : tab === "search-seizure"
          ? tabs[3].count
          : overrideList.length;
  const activeTab: GovernanceRegisterTab = tab === "captured" ? "overrides" : tab;
  const inlineVerdictError = inlineTried && endorseVerdict === "" ? "Choose a verdict." : undefined;
  const inlineRoleError = inlineTried && endorseRole === "" ? "Choose a reviewing role." : undefined;

  return (
    <div className={thirdEdition.governanceWorkspace} data-testid="ward-governance-workbench" data-ward-design="v6">
      <Hero
        level={2}
        eyebrow="Governance · This session"
        title={
          overrideList.length === 0
            ? "No decisions to review"
            : pendingOverrides === 1
              ? "1 decision to review"
              : `${pendingOverrides} decisions to review`
        }
        stats={
          overrideList.length > 0 ? (
            <>
              <HeroStat value={overrideList.length} label="Overrides" />
              <HeroStat value={pendingOverrides} label="Pending" tone="warning" />
              <HeroStat value={reviewedUpheld} label="Upheld" tone="success" />
              <HeroStat value={toCommittee} label="To committee" />
            </>
          ) : (
            <HeroStat value={allowed ? events.length : "Not shown"} label="Captured" />
          )
        }
        bar={<HeroTrack label="Governance registers" items={tabs} value={activeTab} onChange={changeTab} />}
        barAside={
          <span className={thirdEdition.heroActions}>
            <Badge variant="onHero" tone="neutral">
              Safety incidents not recorded here
            </Badge>
            <Button variant="light" size="sm" id="btnEndorseHeader" onClick={openEndorseModal}>
              Record review
            </Button>
          </span>
        }
      />

      <div className={thirdEdition.govLayout}>
        <Card
          className={thirdEdition.registerCard}
          aria-labelledby="governance-register-title"
          id={`pane-${activeTab}`}
        >
          <CardHead
            id="governance-register-title"
            icon={ShieldCheck}
            title={tabTitle}
            meta={<Count n={tabCount ?? 0} />}
            action={
              activeTab === "overrides" && overrideList.length > 0 ? (
                <Segmented
                  label="Override review state"
                  value={overrideScope}
                  onChange={setOverrideScope}
                  items={[
                    { id: "all", label: "All", count: overrideList.length },
                    { id: "open", label: "Open", count: openOverrides.length },
                    { id: "closed", label: "Closed", count: closedOverrides.length },
                  ]}
                />
              ) : undefined
            }
          />

          {activeTab === "overrides" && (
            <>
              <CardBody flush className={thirdEdition.tableScroll}>
                <table
                  className={cx(tableClasses.table, thirdEdition.govTable)}
                  id="ovrTable"
                  aria-label="Clinical gate exceptions register"
                >
                  <thead>
                    <tr>
                      <th scope="col">Patient</th>
                      <th scope="col">Override</th>
                      <th scope="col">Who said yes</th>
                      <th scope="col">When</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody id="ovrTableBody">
                    {overrideList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={thirdEdition.emptyCell}>
                          No override audit is recorded in this session.
                        </td>
                      </tr>
                    ) : null}
                    {shownOverrides.map((o) => {
                      const isSel = selectedOverrideId === o.id && !selected;
                      return (
                        <tr key={o.id} className={cx(isSel && tableClasses.selected)} onClick={() => chooseOverride(o)}>
                          {/* Owner, 26 Sept 2026: the patient's name, not a journey or audit number. */}
                          <td>
                            <button
                              type="button"
                              className={thirdEdition.rowButton}
                              aria-pressed={isSel}
                              aria-controls="governance-event-detail"
                              onClick={(event) => {
                                event.stopPropagation();
                                chooseOverride(o);
                              }}
                            >
                              {o.patient}
                            </button>
                          </td>
                          <td>
                            <span className={thirdEdition.typeCell}>
                              <span className={thirdEdition.typeTile} aria-hidden="true">
                                {o.category.charAt(0)}
                              </span>
                              <span className={thirdEdition.clip}>{overrideTypeLabel(o.category)}</span>
                            </span>
                          </td>
                          <td>
                            <span className={thirdEdition.typeCell}>
                              <Avatar name={o.by} initials={roleInitials(o.by)} decorative />
                              <span className={thirdEdition.clip}>{o.by}</span>
                            </span>
                          </td>
                          <td className={thirdEdition.quietCell}>{o.recordedAgoText}</td>
                          <td>
                            <OverrideStatusLabel status={o.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardBody>

              {overrides.length > 0 && (
                <CardBody className={thirdEdition.tableScroll}>
                  <OverrideRegister entries={overrides} units={units} now={now} />
                </CardBody>
              )}

              {typeRows.length > 0 && (
                <CardBody className={thirdEdition.typeBlock}>
                  <div className={thirdEdition.typeHead}>
                    <h3 className={thirdEdition.blockTitle}>This session by type</h3>
                    <span className={thirdEdition.quietText}>Repeat means 2 or more from one role</span>
                  </div>
                  <BarList
                    label="Overrides this session by type"
                    rows={typeRows}
                    mean={typeMean}
                    meanLabel="Session mean"
                    labelWidth="10rem"
                  />
                </CardBody>
              )}
            </>
          )}

          {activeTab === "decisions" && (
            <CardBody flush className={thirdEdition.tableScroll}>
              <table
                className={cx(tableClasses.table, thirdEdition.govTable)}
                id="decisionTable"
                aria-label="Closed decisions audit log"
              >
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Override</th>
                    <th scope="col">Reviewed by</th>
                    <th scope="col">When</th>
                    <th scope="col">Verdict</th>
                  </tr>
                </thead>
                <tbody id="decisionTableBody">
                  {decisionList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={thirdEdition.emptyCell}>
                        No review decision is recorded in this session.
                      </td>
                    </tr>
                  ) : null}
                  {decisionList.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.subject}</strong>
                      </td>
                      <td>{overrideTypeLabel(d.category)}</td>
                      <td>
                        <span className={thirdEdition.typeCell}>
                          <Avatar name={d.auditor} initials={roleInitials(d.auditor)} decorative />
                          <span className={thirdEdition.clip}>{d.auditor}</span>
                        </span>
                      </td>
                      <td className={thirdEdition.quietCell}>{d.time}</td>
                      <td>
                        <span className={thirdEdition.statusText}>
                          <StatusGlyph tone={DECISION_TONE[d.tone]} size={9} />
                          {d.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          )}

          {activeTab === "restrictive" && (
            <CardBody flush className={thirdEdition.tableScroll}>
              <table
                className={cx(tableClasses.table, thirdEdition.govTable)}
                id="restrictiveTable"
                aria-label="Restrictive practices register"
              >
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Practice</th>
                    <th scope="col">Authorised by</th>
                    <th scope="col">Start</th>
                    <th scope="col">Review due</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody id="restrictiveTableBody">
                  {!hasSampleData || SAMPLE_RESTRICTIVE_PRACTICES.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={thirdEdition.emptyCell}>
                        No Form 10 or Form 11 record in this session.
                      </td>
                    </tr>
                  ) : (
                    SAMPLE_RESTRICTIVE_PRACTICES.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className={thirdEdition.stack}>
                            <strong>{row.patient}</strong>
                            <span className={thirdEdition.quietText}>{row.unit}</span>
                          </span>
                        </td>
                        <td>{row.form}</td>
                        <td>
                          <span className={thirdEdition.typeCell}>
                            <Avatar name={row.authorisedBy} initials={roleInitials(row.authorisedBy)} decorative />
                            <span className={thirdEdition.clip}>{row.authorisedBy}</span>
                          </span>
                        </td>
                        <td className={thirdEdition.quietCell}>{row.startTime}</td>
                        <td className={thirdEdition.quietCell}>{row.reviewDue}</td>
                        <td>
                          <span className={thirdEdition.statusText}>
                            <StatusGlyph tone={DECISION_TONE[row.tone]} size={9} />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardBody>
          )}

          {activeTab === "search-seizure" && (
            <CardBody flush className={thirdEdition.tableScroll}>
              <table
                className={cx(tableClasses.table, thirdEdition.govTable)}
                id="searchSeizureTable"
                aria-label="Search and seizure register"
              >
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Officer</th>
                    <th scope="col">Articles</th>
                    <th scope="col">When</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody id="searchSeizureTableBody">
                  {!hasSampleData || SAMPLE_SEARCH_SEIZURE.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={thirdEdition.emptyCell}>
                        No Form 8 record in this session.
                      </td>
                    </tr>
                  ) : (
                    SAMPLE_SEARCH_SEIZURE.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className={thirdEdition.stack}>
                            <strong>{row.patient}</strong>
                            <span className={thirdEdition.quietText}>{row.unit}</span>
                          </span>
                        </td>
                        <td>{row.officer}</td>
                        <td>{row.articles}</td>
                        <td className={thirdEdition.quietCell}>{row.time}</td>
                        <td>
                          <span className={thirdEdition.statusText}>
                            <StatusGlyph tone={DECISION_TONE[row.tone]} size={9} />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardBody>
          )}
        </Card>

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
              <span className={thirdEdition.eyebrow}>
                {showEventDetail
                  ? categoryLabels[selected.category]
                  : selectedOverride
                    ? overrideTypeLabel(selectedOverride.category)
                    : "Event detail"}
              </span>
              <h3 className={thirdEdition.detailTitle} id="inspectorHeading">
                {showEventDetail
                  ? actionLabels[selected.action]
                  : selectedOverride
                    ? selectedOverride.patient
                    : "Nothing selected"}
              </h3>
            </div>
            {showEventDetail || selectedOverride ? <Badge tone={inspTone}>{inspStatus}</Badge> : null}
          </div>

          <div className={thirdEdition.detailBody} role="region" aria-label="Event facts" tabIndex={0}>
            {showEventDetail ? (
              <>
                <FactList
                  facts={[
                    ["Record", subjectLabel(selected, patientOf)],
                    ["Recorded", when(selected.at, now)],
                    [
                      "Role recorded",
                      selected.actor.role ? WARD_FLOW_ROLE_LABELS[selected.actor.role] : "Not recorded",
                    ],
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
                      <Button size="sm" onClick={() => choose(referenced)}>
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
            ) : selectedOverride ? (
              <>
                <Inset className={thirdEdition.factGrid}>
                  <dl>
                    <div>
                      <dt>Who said yes</dt>
                      <dd id="inspAuthoriser">{selectedOverride.by}</dd>
                    </div>
                    <div>
                      <dt>Recorded</dt>
                      <dd id="inspTime">{selectedOverride.recordedAgoText}</dd>
                    </div>
                    {unitName(selectedOverride.unit) ? (
                      <div>
                        <dt>Ward</dt>
                        <dd>{unitName(selectedOverride.unit)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Service</dt>
                      <dd>{selectedOverride.service}</dd>
                    </div>
                  </dl>
                </Inset>

                <h4 className={thirdEdition.eyebrow}>Reason given</h4>
                <Inset className={thirdEdition.reasonText} id="inspJustification">
                  {selectedOverride.reason}
                </Inset>

                {selectedOverride.status === "Pending Review" ? (
                  <form
                    className={thirdEdition.reviewForm}
                    aria-label="Your review"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setInlineTried(true);
                      recordOverrideReview();
                    }}
                  >
                    <fieldset className={thirdEdition.verdictSet}>
                      <legend className={thirdEdition.eyebrow}>Your review</legend>
                      <div className={thirdEdition.verdictRow}>
                        {VERDICTS.slice(0, 3).map((verdict) => (
                          <Radio
                            key={verdict.id}
                            name="governanceInlineVerdict"
                            value={verdict.id}
                            label={verdict.label}
                            checked={endorseVerdict === verdict.id}
                            onChange={() => setEndorseVerdict(verdict.id)}
                          />
                        ))}
                      </div>
                      {inlineVerdictError ? (
                        <span className={thirdEdition.inlineError}>
                          <StatusGlyph tone="danger" size={9} />
                          {inlineVerdictError}
                        </span>
                      ) : null}
                    </fieldset>
                    <Field label="Reviewing role" id="governance-inline-role" error={inlineRoleError}>
                      <Select value={endorseRole} onChange={(event) => setEndorseRole(event.target.value)}>
                        <option value="">Choose a reviewing role</option>
                        {REVIEWING_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Note for the register" id="governance-inline-note">
                      <Textarea
                        rows={2}
                        maxLength={280}
                        value={endorseNotes}
                        placeholder="Administrative review only"
                        onChange={(event) => setEndorseNotes(event.target.value)}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </Field>
                    <div className={thirdEdition.formActions}>
                      <Button type="submit" variant="pri" id="btnEndorseInsp" className={thirdEdition.grow}>
                        Record review
                      </Button>
                      <Button type="button" onClick={resetDraft}>
                        Reset
                      </Button>
                    </div>
                  </form>
                ) : null}

                <h4 className={thirdEdition.eyebrow}>History</h4>
                {selectedOverride.reviewed && selectedOverride.decision ? (
                  <ol className={thirdEdition.timeline} id="inspFindingsGroup">
                    <li>
                      <StatusGlyph tone={statusTone(selectedOverride.status)} size={9} />
                      <span id="inspReview">
                        {selectedOverride.decision} by {selectedOverride.reviewer || "reviewer not recorded"}
                        {selectedOverride.reviewerReason ? `. ${selectedOverride.reviewerReason}` : ""}
                      </span>
                    </li>
                  </ol>
                ) : (
                  <p className={thirdEdition.quiet}>No review recorded for this override.</p>
                )}
              </>
            ) : (
              <EmptyState icon={ClipboardList} title="Select an event from the register" />
            )}
          </div>
        </Card>
      </div>

      <Card className={thirdEdition.capturedCard} aria-labelledby="governance-captured-title">
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
          action={
            <div className={thirdEdition.filterRow}>
              <label className={thirdEdition.filterLabel} htmlFor="governance-filter-category">
                Category
              </label>
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
              <label className={thirdEdition.filterLabel} htmlFor="governance-filter-outcome">
                Outcome
              </label>
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
              <label className={thirdEdition.filterLabel} htmlFor="governance-filter-review">
                Review
              </label>
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
          }
        />
        <div className={thirdEdition.capturedGrid}>
          <div className={thirdEdition.capturedList}>
            <div className={thirdEdition.eventHeader} aria-hidden="true">
              <span>Time</span>
              <span>Action</span>
              <span>Record</span>
              <span>Role</span>
              <span>Outcome</span>
              <span>Review</span>
            </div>
            <div
              className={thirdEdition.registerBody}
              role="region"
              aria-label="Captured events"
              tabIndex={0}
              onKeyDown={rowKey}
            >
              {!allowed ? (
                <div className={thirdEdition.emptyBlock}>
                  <Fingerprint aria-hidden="true" size={16} />
                  <h3>Record access unavailable</h3>
                  <p>These records require the coordinator role.</p>
                </div>
              ) : visible.length === 0 ? (
                <div className={thirdEdition.emptyBlock}>
                  <ClipboardList aria-hidden="true" size={16} />
                  <h3>{events.length ? "No matching events" : "No events captured yet"}</h3>
                  <p>
                    {events.length
                      ? "Change the filters to see other captured events."
                      : "Recorded actions and discharge-record opens will appear here."}
                  </p>
                </div>
              ) : (
                visible.map((event) => {
                  const state = event.category === "review" ? "Review attempt" : reviewState(event);
                  return (
                    <button
                      type="button"
                      key={`${event.generation}-${event.id}`}
                      data-audit-row={event.id}
                      className={thirdEdition.eventRow}
                      aria-pressed={selected?.id === event.id}
                      aria-controls="governance-event-detail"
                      onClick={() => choose(event)}
                    >
                      <span className={thirdEdition.eventTime}>{when(event.at, now)}</span>
                      <strong className={thirdEdition.clip}>{actionLabels[event.action]}</strong>
                      <span className={thirdEdition.clip}>
                        {subjectLabel(event, patientOf)} · {categoryLabels[event.category]}
                      </span>
                      <span className={thirdEdition.clip}>
                        {event.actor.role ? WARD_FLOW_ROLE_LABELS[event.actor.role] : "Role unavailable"}
                      </span>
                      <span className={thirdEdition.statusText}>
                        <StatusGlyph tone={OUTCOME_TONE[event.outcome]} size={9} />
                        {outcomeLabels[event.outcome]}
                      </span>
                      <span className={thirdEdition.statusText}>
                        <StatusGlyph
                          tone={
                            state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : "neutral"
                          }
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

          <section
            className={thirdEdition.recordPane}
            data-testid="ward-governance-decision-record"
            aria-label="Administrative review"
          >
            <div className={thirdEdition.stack}>
              <h3 className={thirdEdition.blockTitle}>Review and history</h3>
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
              <Button
                size="sm"
                disabled={!allowed || !selected || selected.category === "review" || reviewPending}
                onClick={() => recordReview("reviewed")}
              >
                Mark reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!allowed || !selected || selected.category === "review" || reviewPending}
                onClick={() => recordReview("follow-up-required")}
              >
                Follow-up required
              </Button>
            </div>
            <p className={thirdEdition.feedback} role="status" aria-live="polite">
              {pending
                ? confirmed
                  ? `${reviewLabels[pending.decision]} recorded.`
                  : reviewAttempt
                    ? "Review not recorded. The record may have changed; select it again."
                    : "Recording review…"
                : ""}
            </p>
          </section>
        </div>
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

      {/* Review-recording modal, opened from the hero. */}
      <div
        ref={endorseModalRef}
        className={thirdEdition.modal}
        id="endorseModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="endorseModalTitle"
        style={{ display: modalOpen ? "flex" : "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeEndorseModal();
        }}
        onKeyDown={handleEndorseModalKeyDown}
      >
        <div className={thirdEdition.modalDialog}>
          <div className={thirdEdition.modalHead}>
            <h3 id="endorseModalTitle">Record a review</h3>
            <Button iconOnly icon={X} variant="ghost" size="sm" aria-label="Close modal" onClick={closeEndorseModal} />
          </div>
          <div className={thirdEdition.modalBody}>
            <Field label="Under review" id="endorseSubj">
              <TextInput
                value={
                  selected
                    ? `${actionLabels[selected.action]} (${subjectLabel(selected, patientOf)})`
                    : selectedOverride
                      ? `${selectedOverride.patient} · ${overrideTypeLabel(selectedOverride.category)}`
                      : "No override selected"
                }
                readOnly
              />
            </Field>
            <Field label="Verdict" id="endorseVerdict">
              <Select value={endorseVerdict} onChange={(e) => setEndorseVerdict(e.target.value)}>
                <option value="">Choose a verdict</option>
                {VERDICTS.map((verdict) => (
                  <option key={verdict.id} value={verdict.id}>
                    {verdict.id}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reviewing role" id="endorseRole">
              <Select value={endorseRole} onChange={(e) => setEndorseRole(e.target.value)}>
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
                onChange={(e) => setEndorseNotes(e.target.value)}
                data-gramm="false"
                data-enable-grammarly="false"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className={thirdEdition.modalFoot}>
            <Button onClick={closeEndorseModal}>Cancel</Button>
            <Button variant="pri" onClick={submitEndorsement}>
              Record finding
            </Button>
          </div>
        </div>
      </div>

      <div className={thirdEdition.toastSlot} id="actionToast" role="status" aria-live="polite">
        {toastMessage ? <ToastView tone="neutral" title={<span id="toastMsg">{toastMessage}</span>} /> : null}
      </div>
      <p className={thirdEdition.srOnly} id="screenAnnouncer" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

function OverrideStatusLabel({ status }: { status: OverrideStatus }) {
  return (
    <span className={thirdEdition.statusText}>
      <StatusGlyph tone={statusTone(status)} size={9} />
      {status === "Pending Review" ? "Pending review" : status}
    </span>
  );
}
