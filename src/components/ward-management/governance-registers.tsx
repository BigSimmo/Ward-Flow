"use client";

import { CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Fingerprint, History } from "lucide-react";
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
import { WardDynamicIsland } from "./shell/ward-dynamic-island";

import se from "./ward-modes-second-edition.module.css";
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
    <section className={thirdEdition.cardPanel} data-testid="ward-governance-overrides-register">
      <header className={thirdEdition.cardHead}>
        <div>
          <h2>Overrides register</h2>
          {/* Deliberately NOT "for review" and NOT "oldest first": neither a reviewed/unreviewed
              split nor a queue order exists in this model (see file comment above). This is every
              override this system has ever recorded, across the network — `OverrideRegister`
              itself renders them newest first. */}
          <p>Every override this system has recorded, across the network</p>
        </div>
      </header>
      <div className={thirdEdition.cardBody}>
        <OverrideRegister entries={entries} units={units} now={now} />
      </div>
    </section>
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
    <aside className={thirdEdition.cardPanel} data-testid="ward-governance-access-record">
      <header className={thirdEdition.cardHead}>
        <div>
          <h2>Access record</h2>
          <p>What this prototype actually keeps, not a network-wide log</p>
        </div>
      </header>
      <div className={thirdEdition.cardBody}>
        <p className={thirdEdition.effNotice} style={{ margin: 0 }}>
          <History aria-hidden="true" /> {ACCESS_RECORD_NOTE}
        </p>
        <p className={thirdEdition.effNotice} style={{ margin: 0 }} data-testid="ward-governance-access-record-scope">
          <Fingerprint aria-hidden="true" /> There is no network-wide version of this record here, and no row names who
          looked: this system has no signed-in user to name, only the screen a search ran from, held in that
          screen&apos;s own memory and nowhere else.
        </p>
      </div>
    </aside>
  );
}

type GovernanceRegisterTab =
  "overrides" | "captured" | "decisions" | "access" | "restrictive" | "search-seizure" | "legacy" | "measures";

type GovernanceApi = Pick<
  ReturnType<typeof useWardFlow>,
  "worldGeneration" | "readAuditEvents" | "readAuditReviews" | "dispatch" | "admissions" | "bedReleases"
>;
type WorkbenchProps = {
  movements: Movement[];
  units: Unit[];
  now: Instant;
  api?: GovernanceApi;
  legacyChanges?: ReactNode;
  effectiveness?: ReactNode;
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
            ["Operation", event.details.operation === "extension-recorded" ? "Extension recorded" : "Expiry recorded"],
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
      return event.details.kind === "departure" ? (
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

interface GovernanceOverrideItem {
  id: string;
  movement: string;
  patient: string;
  unit: string;
  service: string;
  route: string;
  category: string;
  reason: string;
  by: string;
  recordedAgoText: string;
  status: "Pending Review" | "Upheld";
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
  tone: "good" | "warn" | "accent";
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
    route: "East Metro · Bentley Adult Secure",
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
    route: "North Metro · Sir Charles Gairdner MHU",
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
    route: "East Metro · Bentley Adult Secure",
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
    route: "South Metro to East Metro · Fremantle",
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
    route: "North Metro · Graylands Hospital",
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
    route: "North Metro to East Metro · Bentley",
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
    route: "North Metro to WACHS · Bunbury",
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
    subject: "OVR-104 (Marcus Chen)",
    category: "Catchment Boundary Bypass",
    verdict: "Upheld in Full",
    tone: "good",
  },
  {
    id: "DEC-090",
    auditor: "Clinical Director",
    time: "Earlier today",
    subject: "OVR-103 (Tobias Wren)",
    category: "Acuity Ceiling Override",
    verdict: "Upheld in Full",
    tone: "good",
  },
  {
    id: "DEC-089",
    auditor: "Governance Lead Psychiatrist",
    time: "Yesterday morning",
    subject: "OVR-102 (Tariq Al-Mansoor)",
    category: "Cohort & Gender Mix Exception",
    verdict: "Upheld with Recommendations",
    tone: "good",
  },
  {
    id: "DEC-088",
    auditor: "Governance Lead Psychiatrist",
    time: "Previous shift",
    subject: "OVR-101 (David Miller)",
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
export function GovernanceWorkbench(props: WorkbenchProps) {
  return <GovernanceSession key={props.api?.worldGeneration ?? "unavailable"} {...props} />;
}

function GovernanceSession({ movements, units, now, api, legacyChanges, effectiveness, sampleData }: WorkbenchProps) {
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
  const legacyCount = overrides.length;

  const totalMonitored = overrideList.length;
  const catchmentBypasses = overrideList.filter((o) => o.category === "Catchment Boundary Bypass").length;
  const acuityCeilings = overrideList.filter((o) => o.category === "Acuity Ceiling Override").length;
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
    { id: "overrides", label: "Overrides Register", count: totalMonitored },
    { id: "decisions", label: "Decision Log", count: decisionList.length },
    { id: "access", label: "Session Access Record", count: 0 },
    {
      id: "restrictive",
      label: "Restrictive Practices (Forms 10/11)",
      count: hasSampleData ? SAMPLE_RESTRICTIVE_PRACTICES.length : 0,
    },
    {
      id: "search-seizure",
      label: "Search & Seizure (Form 8)",
      count: hasSampleData ? SAMPLE_SEARCH_SEIZURE.length : 0,
    },
    { id: "legacy", label: "Legacy facts" },
    ...(effectiveness ? [{ id: "measures" as const, label: "Effectiveness" }] : []),
  ];

  const inspStatus = selected
    ? selected.category === "review"
      ? "Review attempt"
      : reviewState(selected) === "unreviewed"
        ? "Unreviewed"
        : reviewLabels[reviewState(selected) as AuditReview["decision"]]
    : selectedOverride
      ? selectedOverride.status
      : "No selection";
  const inspTone = selected
    ? reviewState(selected) === "reviewed"
      ? "good"
      : "warn"
    : selectedOverride?.status === "Upheld"
      ? "good"
      : "warn";

  const choose = (event: AuditEvent | null) => {
    setSelection(event);
    setPending(null);
    if (event) {
      setSelectedOverrideId(null);
      setAnnouncement(`Selected event ${event.id}.`);
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
          : next === "access"
            ? "Session access record view shown."
            : next === "restrictive"
              ? "Restrictive practices register view shown."
              : next === "search-seizure"
                ? "Search and seizure register view shown."
                : next === "legacy"
                  ? "Legacy facts view shown."
                  : "Effectiveness view shown.",
    );
  }

  function tabKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const activeIndex = tabs.findIndex((entry) => entry.id === tab || (tab === "captured" && entry.id === "overrides"));
    const next =
      event.key === "ArrowRight"
        ? (activeIndex + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (activeIndex - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    changeTab(tabs[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
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

    if (selectedOverride) {
      if (endorseVerdict === "" || endorseRole === "") {
        const refusal = "Choose a verdict and a reviewing role before recording the finding.";
        showToast(refusal);
        setAnnouncement(refusal);
        return;
      }
      setOverrideList((prev) =>
        prev.map((item) =>
          item.id === selectedOverride.id
            ? {
                ...item,
                status: "Upheld" as const,
                reviewed: true,
                reviewer: endorseRole,
                decision: endorseVerdict,
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
        subject: selectedOverride.id,
        category: selectedOverride.category,
        verdict: endorseVerdict.split(" · ")[0],
        tone: "good",
      };
      setDecisionList((prev) => [newDecision, ...prev]);

      closeEndorseModal();
      showToast("Action executed successfully.");
      setAnnouncement(`Override ${selectedOverride.id} endorsed and recorded.`);
    }
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

  return (
    <div className={thirdEdition.governanceWorkspace} data-testid="ward-governance-workbench">
      <WardDynamicIsland
        title={
          <>
            Governance{" "}
            <span style={{ opacity: 0.75, fontWeight: 500, fontSize: "var(--t-0, 12px)" }}>· This session</span>
          </>
        }
        status={totalMonitored > 0 ? "warning" : "nominal"}
        statusText={totalMonitored > 0 ? `${totalMonitored} overrides monitored` : "No overrides recorded this session"}
        ariaLabel="Clinical governance indicators"
        testId="ward-governance-hud-island"
        metrics={[
          {
            id: "kpi-monitored",
            label: "Overrides",
            value: totalMonitored,
            tone: "warn",
            ariaLabel: `${totalMonitored} Overrides Monitored`,
          },
          {
            id: "kpi-catchment",
            label: "Catchment",
            value: catchmentBypasses,
            tone: "accent",
            ariaLabel: `${catchmentBypasses} Catchment Bypasses`,
          },
          {
            id: "kpi-acuity",
            label: "Acuity",
            value: acuityCeilings,
            tone: "warn",
            ariaLabel: `${acuityCeilings} Acuity Ceilings Bypassed`,
          },
          {
            id: "kpi-upheld",
            label: "Upheld",
            value: reviewedUpheld,
            tone: "good",
            ariaLabel: `${reviewedUpheld} Reviewed & Upheld`,
          },
        ]}
        actions={
          <span className={thirdEdition.sentenceSub} style={{ margin: 0, paddingLeft: 4 }}>
            Safety incidents not recorded
          </span>
        }
      />

      <div className={thirdEdition.workspaceBar} role="region" aria-label="Governance session status and actions">
        <div className={thirdEdition.workspaceMeta}>
          <span className={thirdEdition.sessionDot} aria-hidden="true" />
          <p className={thirdEdition.workspaceNote}>Captured this session · resets with demo</p>
          <span className={thirdEdition.metaDot} aria-hidden="true">
            ·
          </span>
          <div className={thirdEdition.summary}>
            <span className={thirdEdition.summaryPill}>
              <strong>{allowed ? events.length : "—"}</strong> captured
            </span>
            <span className={thirdEdition.summaryPill}>
              <strong>{allowed ? unreviewed : "—"}</strong> unreviewed
            </span>
            <span className={thirdEdition.summaryPill}>
              <strong>{allowed ? followUp : "—"}</strong> follow-up
            </span>
          </div>
        </div>
        <div className={thirdEdition.reviewEntry}>
          <button
            type="button"
            className={`${thirdEdition.btn} ${thirdEdition.primary}`}
            id="btnEndorseHeader"
            onClick={openEndorseModal}
            aria-label="Endorse current audit"
          >
            + Endorse Current Audit
          </button>
        </div>
      </div>

      <div className={thirdEdition.tabbar} role="tablist" aria-label="Governance Registers" onKeyDown={tabKey}>
        {tabs.map((entry) => {
          const isSelected = tab === entry.id || (tab === "captured" && entry.id === "overrides");
          return (
            <button
              key={entry.id}
              type="button"
              id={`tab-${entry.id}`}
              data-tab={entry.id}
              className={thirdEdition.tabBtn}
              role="tab"
              aria-label={entry.label}
              aria-selected={isSelected}
              aria-controls={`pane-${entry.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => changeTab(entry.id)}
            >
              {entry.label}
              {entry.count !== undefined && (
                <span className={thirdEdition.tabNum} id={`tabBadge-${entry.id}`} aria-hidden="true">
                  {entry.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(tab === "overrides" || tab === "captured") && (
        <div
          id="pane-overrides"
          role="tabpanel"
          aria-labelledby="tab-overrides"
          className={thirdEdition.govLayout}
          tabIndex={0}
        >
          <section className={thirdEdition.tabsPanel} aria-label="Clinical governance registers">
            <div className={thirdEdition.ph}>
              <h2>Clinical Gate Exceptions &amp; Allocation Overrides</h2>
              <span className="mono" style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                WA Health Governance Standard
              </span>
            </div>
            <div className={thirdEdition.tableWrap}>
              <table className={thirdEdition.govTable} id="ovrTable" aria-label="Clinical gate exceptions register">
                <thead>
                  <tr>
                    <th scope="col">Audit ID</th>
                    <th scope="col">Patient · URM</th>
                    <th scope="col">Location · Route</th>
                    <th scope="col">Gate Overridden</th>
                    <th scope="col">Authorised By</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody id="ovrTableBody">
                  {overrideList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                        No override audit is recorded in this session.
                      </td>
                    </tr>
                  ) : null}
                  {overrideList.map((o) => {
                    const isSel = selectedOverrideId === o.id && !selected;
                    const catTone =
                      o.category === "Acuity Ceiling Override"
                        ? "danger"
                        : o.category === "Catchment Boundary Bypass"
                          ? "warn"
                          : o.category === "Cohort & Gender Mix Override"
                            ? "accent"
                            : "warn";
                    return (
                      <tr
                        key={o.id}
                        className={isSel ? thirdEdition.selected : ""}
                        onClick={() => {
                          setSelectedOverrideId(o.id);
                          setSelection(null);
                          setAnnouncement(`Selected override ${o.id}.`);
                        }}
                        tabIndex={0}
                        role="row"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedOverrideId(o.id);
                            setSelection(null);
                          }
                        }}
                      >
                        <td className="mono">
                          <strong>{o.id}</strong>
                        </td>
                        {/* Owner, 26 Sept 2026: dropped the WF journey number under the patient's name. */}
                        <td>
                          <strong>{o.patient}</strong>
                        </td>
                        <td>{o.route}</td>
                        <td>
                          <span className={thirdEdition.badge} data-tone={catTone}>
                            {o.category}
                          </span>
                        </td>
                        <td>{o.by}</td>
                        <td>
                          <span className={thirdEdition.badge} data-tone={o.status === "Upheld" ? "good" : "warn"}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {overrides.length > 0 && (
              <div className={thirdEdition.tableWrap}>
                <OverrideRegister entries={overrides} units={units} now={now} />
              </div>
            )}

            <section className={thirdEdition.registerPanel} aria-label="Captured event register">
              <header className={thirdEdition.panelHeader}>
                <div>
                  <h2>Captured Session Events</h2>
                  <p>
                    {allowed
                      ? `${visible.length} of ${events.length} captured events · newest first`
                      : "Record access unavailable"}
                  </p>
                </div>
              </header>
              <div className={thirdEdition.filters}>
                <label htmlFor="governance-filter-category">
                  Category
                  <select
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
                  </select>
                </label>
                <label htmlFor="governance-filter-outcome">
                  Outcome
                  <select
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
                  </select>
                </label>
                <label htmlFor="governance-filter-review">
                  Review
                  <select
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
                  </select>
                </label>
              </div>
              <div
                className={thirdEdition.registerBody}
                role="region"
                aria-label="Captured events"
                tabIndex={0}
                onKeyDown={rowKey}
              >
                {!allowed ? (
                  <div className={thirdEdition.empty}>
                    <Fingerprint aria-hidden="true" />
                    <h3>Record access unavailable</h3>
                    <p>These records require the coordinator role.</p>
                  </div>
                ) : visible.length === 0 ? (
                  <div className={thirdEdition.empty}>
                    <ClipboardList aria-hidden="true" />
                    <h3>{events.length ? "No matching events" : "No events captured yet"}</h3>
                    <p>
                      {events.length
                        ? "Change the filters to see other captured events."
                        : "Recorded actions and discharge-record opens will appear here."}
                    </p>
                  </div>
                ) : (
                  visible.map((event) => (
                    <button
                      type="button"
                      key={`${event.generation}-${event.id}`}
                      data-audit-row={event.id}
                      className={thirdEdition.eventRow}
                      aria-pressed={selected?.id === event.id}
                      aria-controls="governance-event-detail"
                      onClick={() => choose(event)}
                    >
                      <span className={thirdEdition.eventMain}>
                        <strong>{actionLabels[event.action]}</strong>
                        <span className={thirdEdition.badge} data-tone={event.outcome}>
                          {outcomeLabels[event.outcome]}
                        </span>
                      </span>
                      <span className={thirdEdition.eventMeta}>
                        <span>
                          {subjectLabel(event, patientOf)} · {categoryLabels[event.category]}
                        </span>
                        <time>{when(event.at, now)}</time>
                      </span>
                      <span className={thirdEdition.eventBottom}>
                        <span>{event.actor.role ? WARD_FLOW_ROLE_LABELS[event.actor.role] : "Role unavailable"}</span>
                        <span>
                          {event.category === "review"
                            ? "Review attempt"
                            : reviewState(event) === "unreviewed"
                              ? "Unreviewed"
                              : reviewLabels[reviewState(event) as AuditReview["decision"]]}
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </section>

          <div className={thirdEdition.sideColumn}>
            <section
              id="governance-event-detail"
              className={thirdEdition.detailPanel}
              data-testid="ward-governance-override-detail"
              aria-label="Selected event detail"
            >
              <header className={thirdEdition.panelHeader}>
                <div>
                  <h2 id="inspectorHeading">
                    {selected ? actionLabels[selected.action] : "Override Detail Inspector"}
                  </h2>
                  <h2 className={thirdEdition.srOnly}>Event detail</h2>
                  <p>
                    {selected
                      ? `${selected.id} · ${categoryLabels[selected.category]}`
                      : selectedOverride
                        ? `${selectedOverride.id} · ${selectedOverride.category}`
                        : "Select an event from the register"}
                    <span className={thirdEdition.srOnly}>Select an event from the register</span>
                  </p>
                </div>
                <span className={thirdEdition.badge} id="inspBadge" data-tone={inspTone}>
                  {inspStatus}
                </span>
              </header>

              <div className={thirdEdition.detailBody} role="region" aria-label="Event facts" tabIndex={0}>
                {selected ? (
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
                                units.find((unit) => unit.id === selected.actor.actingUnitId)?.name ??
                                  "Unresolved ward",
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
                          <Link href={movementHref(subject.movementId)}>
                            Open movement <ChevronRight aria-hidden="true" />
                          </Link>
                        )}
                        {subjectExists && matchingWard.length === 1 && (
                          <Link href={unitHref(matchingWard[0].id)}>
                            Open {matchingWard[0].name} <ChevronRight aria-hidden="true" />
                          </Link>
                        )}
                        {referenced && (
                          <button type="button" onClick={() => choose(referenced)}>
                            Inspect {referenced.id} <ChevronRight aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className={thirdEdition.operationFacts}>
                      <h3 className={thirdEdition.subheading}>Recorded facts</h3>
                      <EventFacts event={selected} units={units} now={now} />
                    </div>
                  </>
                ) : selectedOverride ? (
                  <div className={thirdEdition.inspectorBody}>
                    <div className={thirdEdition.inspectorCard}>
                      <div className={thirdEdition.inspectorRow}>
                        <span className={thirdEdition.inspectorLabel}>Override Audit ID</span>
                        <span className={`${thirdEdition.inspectorVal} mono`} id="inspId">
                          {selectedOverride.id}
                        </span>
                      </div>
                      <div className={thirdEdition.inspectorRow}>
                        <span className={thirdEdition.inspectorLabel}>Patient · URM</span>
                        {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                        <span className={thirdEdition.inspectorVal} id="inspPatient">
                          {selectedOverride.patient}
                        </span>
                      </div>
                      <div className={thirdEdition.inspectorRow}>
                        <span className={thirdEdition.inspectorLabel}>Gate Overridden</span>
                        <span className={thirdEdition.inspectorVal} id="inspGate">
                          {selectedOverride.category}
                        </span>
                      </div>
                      <div className={thirdEdition.inspectorRow}>
                        <span className={thirdEdition.inspectorLabel}>Transfer Route</span>
                        <span className={thirdEdition.inspectorVal} id="inspRoute">
                          {selectedOverride.route}
                        </span>
                      </div>
                      <div className={thirdEdition.inspectorRow}>
                        <span className={thirdEdition.inspectorLabel}>Authorising Role</span>
                        <span className={thirdEdition.inspectorVal} id="inspAuthoriser">
                          {selectedOverride.by}
                        </span>
                      </div>
                      <div className={thirdEdition.inspectorRow}>
                        <span className={thirdEdition.inspectorLabel}>Recorded Time</span>
                        <span className={`${thirdEdition.inspectorVal} mono`} id="inspTime">
                          {selectedOverride.recordedAgoText}
                        </span>
                      </div>
                    </div>

                    <div className={thirdEdition.formGroup}>
                      <span className={thirdEdition.formLabel}>Recorded Clinical Justification</span>
                      <div className={thirdEdition.inspectorText} id="inspJustification">
                        {selectedOverride.reason}
                      </div>
                    </div>

                    {selectedOverride.reviewed && selectedOverride.decision && (
                      <div className={thirdEdition.formGroup} id="inspFindingsGroup">
                        <span className={thirdEdition.formLabel}>Audit Finding &amp; Rationale</span>
                        <div className={thirdEdition.inspectorText} id="inspReview">
                          {selectedOverride.reviewerReason ||
                            `Endorsed by ${selectedOverride.reviewer || "reviewer not recorded"}: ${selectedOverride.decision}.`}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      <button
                        type="button"
                        className={`${thirdEdition.btn} ${thirdEdition.primary}`}
                        id="btnEndorseInsp"
                        style={{ flex: 1 }}
                        onClick={openEndorseModal}
                      >
                        Endorse Override
                      </button>
                      <button
                        type="button"
                        className={thirdEdition.btn}
                        id="btnReferInsp"
                        style={{ flex: 1 }}
                        onClick={() => showToast("Not wired in this prototype.")}
                      >
                        Refer to Committee
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={thirdEdition.empty}>
                    <ClipboardList aria-hidden="true" />
                    <p>Select an event from the register</p>
                  </div>
                )}
              </div>
            </section>

            <section
              className={thirdEdition.recordPanel}
              data-testid="ward-governance-decision-record"
              aria-label="Administrative review"
            >
              <header className={thirdEdition.panelHeader}>
                <div>
                  <h2>Review and history</h2>
                  <p>
                    {selected
                      ? `${history.length} recorded ${history.length === 1 ? "review" : "reviews"} · role recorded`
                      : selectedOverride?.reviewed
                        ? `1 recorded review · role recorded`
                        : "No event selected"}
                  </p>
                </div>
              </header>
              <div className={thirdEdition.reviewBody} role="region" aria-label="Review history" tabIndex={0}>
                {selected && history.length ? (
                  <ol className={thirdEdition.historyList}>
                    {[...history].reverse().map((review) => (
                      <li key={review.id}>
                        <CheckCircle2 aria-hidden="true" />
                        <div>
                          <strong>{reviewLabels[review.decision]}</strong>
                          <span>{when(review.at, now)} · Flow coordinator</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : selectedOverride?.reviewed ? (
                  <ol className={thirdEdition.historyList}>
                    <li>
                      <CheckCircle2 aria-hidden="true" />
                      <div>
                        <strong>{selectedOverride.decision || "Not recorded"}</strong>
                        <span>{selectedOverride.reviewer || "Not recorded"}</span>
                      </div>
                    </li>
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
              <div className={thirdEdition.reviewControls}>
                <p>Administrative review only</p>
                <div className={thirdEdition.reviewActions}>
                  <button
                    type="button"
                    disabled={!allowed || !selected || selected.category === "review" || reviewPending}
                    onClick={() => recordReview("reviewed")}
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    disabled={!allowed || !selected || selected.category === "review" || reviewPending}
                    onClick={() => recordReview("follow-up-required")}
                  >
                    Follow-up required
                  </button>
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
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === "decisions" && (
        <div
          id="pane-decisions"
          role="tabpanel"
          aria-labelledby="tab-decisions"
          tabIndex={0}
          className={thirdEdition.tabsPanel}
        >
          <div className={thirdEdition.ph}>
            <h2>Closed Governance Decisions &amp; Endorsements</h2>
            <span className="mono" style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
              Audited Exceptions
            </span>
          </div>
          <div className={thirdEdition.tableWrap}>
            <table className={thirdEdition.govTable} id="decisionTable" aria-label="Closed decisions audit log">
              <thead>
                <tr>
                  <th scope="col">Decision ID</th>
                  <th scope="col">Auditor Role</th>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Audit Subject</th>
                  <th scope="col">Gate Category</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody id="decisionTableBody">
                {decisionList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                      No review decision is recorded in this session.
                    </td>
                  </tr>
                ) : null}
                {decisionList.map((d) => (
                  <tr key={d.id} role="row">
                    <td className="mono">
                      <strong>{d.id}</strong>
                    </td>
                    <td>{d.auditor}</td>
                    <td className="mono">{d.time}</td>
                    <td className="mono">{d.subject}</td>
                    <td>{d.category}</td>
                    <td>
                      <span className={thirdEdition.badge} data-tone={d.tone}>
                        {d.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "access" && (
        <div
          id="pane-access"
          role="tabpanel"
          aria-labelledby="tab-access"
          tabIndex={0}
          className={thirdEdition.tabsPanel}
        >
          <div className={thirdEdition.ph}>
            <h2>Session Access &amp; Privacy Audit Record</h2>
            {/* Josh, 25 September 2026 (item 4): the panel says in plain view that nothing here is saved. */}
            <span
              className="mono"
              style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}
              data-testid="ward-governance-access-session-only"
            >
              This session only, not saved
            </span>
          </div>
          <div className={thirdEdition.tableWrap}>
            <table
              className={thirdEdition.govTable}
              id="accessTable"
              aria-label="Session access record, kept for this session only"
            >
              <thead>
                <tr>
                  <th scope="col">Movement ID</th>
                  <th scope="col">Accessing Role</th>
                  <th scope="col">Console Module</th>
                  <th scope="col">Access Time</th>
                  <th scope="col">Clinical Context</th>
                </tr>
              </thead>
              {/* Six typed-in rows used to stand here, naming a role, a screen and a purpose for
                  each "look" at a real movement. This system has no signed-in user and records no
                  one looking, as the panel below says (25 September 2026 audit, A16). */}
              <tbody id="accessTableBody">
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No access by any person is recorded. What this session keeps is described below.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: "16px 18px", borderTop: "1px solid var(--line)" }}>
            <GovernanceAccessRecordPanel />
          </div>
        </div>
      )}

      {tab === "restrictive" && (
        <div
          id="pane-restrictive"
          role="tabpanel"
          aria-labelledby="tab-restrictive"
          tabIndex={0}
          className={thirdEdition.tabsPanel}
        >
          <div className={thirdEdition.ph}>
            <h2>Restrictive Practices (Forms 10/11)</h2>
            <span className="mono" style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
              WA Mental Health Act Statutory Register
            </span>
          </div>
          <div className={thirdEdition.tableWrap}>
            <table className={thirdEdition.govTable} id="restrictiveTable" aria-label="Restrictive practices register">
              <thead>
                <tr>
                  <th scope="col">Practice</th>
                  <th scope="col">Patient · UMRN</th>
                  <th scope="col">Ward · Location</th>
                  <th scope="col">Authorised By</th>
                  <th scope="col">Start Time</th>
                  <th scope="col">Review Due</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody id="restrictiveTableBody">
                {!hasSampleData || SAMPLE_RESTRICTIVE_PRACTICES.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                      Statutory register for Form 10 and Form 11 clinical records.
                    </td>
                  </tr>
                ) : (
                  SAMPLE_RESTRICTIVE_PRACTICES.map((row) => (
                    <tr key={row.id} role="row">
                      <td>
                        <strong>{row.form}</strong>
                      </td>
                      <td>{row.patient}</td>
                      <td>{row.unit}</td>
                      <td>{row.authorisedBy}</td>
                      <td className="mono">{row.startTime}</td>
                      <td className="mono">{row.reviewDue}</td>
                      <td>
                        <span className={thirdEdition.badge} data-tone={row.tone}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "search-seizure" && (
        <div
          id="pane-search-seizure"
          role="tabpanel"
          aria-labelledby="tab-search-seizure"
          tabIndex={0}
          className={thirdEdition.tabsPanel}
        >
          <div className={thirdEdition.ph}>
            <h2>Search &amp; Seizure (Form 8)</h2>
            <span className="mono" style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
              WA Mental Health Act Statutory Register
            </span>
          </div>
          <div className={thirdEdition.tableWrap}>
            <table className={thirdEdition.govTable} id="searchSeizureTable" aria-label="Search and seizure register">
              <thead>
                <tr>
                  <th scope="col">Record ID</th>
                  <th scope="col">Patient · UMRN</th>
                  <th scope="col">Ward · Location</th>
                  <th scope="col">Authorised Officer</th>
                  <th scope="col">Articles Seized</th>
                  <th scope="col">Seizure Time</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody id="searchSeizureTableBody">
                {!hasSampleData || SAMPLE_SEARCH_SEIZURE.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                      Statutory register for Form 8 records.
                    </td>
                  </tr>
                ) : (
                  SAMPLE_SEARCH_SEIZURE.map((row) => (
                    <tr key={row.id} role="row">
                      <td className="mono">
                        <strong>{row.id}</strong>
                      </td>
                      <td>{row.patient}</td>
                      <td>{row.unit}</td>
                      <td>{row.officer}</td>
                      <td>{row.articles}</td>
                      <td className="mono">{row.time}</td>
                      <td>
                        <span className={thirdEdition.badge} data-tone={row.tone}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "legacy" && (
        <div
          id="governance-legacy-panel"
          role="tabpanel"
          aria-labelledby="tab-legacy"
          className={thirdEdition.legacyPanel}
        >
          <header className={thirdEdition.panelHeader}>
            <div>
              <h2>Legacy operational facts</h2>
              <p>Separate source records · capture/review unavailable</p>
            </div>
            <span className={thirdEdition.badge}>{legacyCount} override facts</span>
          </header>
          <div className={thirdEdition.legacyGrid}>
            <GovernanceOverridesRegisterPanel movements={movements} units={units} now={now} />
            {legacyChanges}
          </div>
          <details className={thirdEdition.accessScope}>
            <summary>
              <ChevronDown aria-hidden="true" style={{ width: 16, height: 16 }} />
              <span>Search access scope</span>
            </summary>
            <div className={thirdEdition.accessScopeBody}>
              <GovernanceAccessRecordPanel />
            </div>
          </details>
        </div>
      )}

      {tab === "measures" && (
        <div
          id="governance-measures-panel"
          role="tabpanel"
          aria-labelledby="tab-measures"
          className={thirdEdition.legacyPanel}
        >
          {effectiveness}
        </div>
      )}

      {/* Review-recording & endorsement modal */}
      <div
        ref={endorseModalRef}
        className={`${thirdEdition.modal} ${modalOpen ? thirdEdition.open : ""}`}
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
            <h3 id="endorseModalTitle">Endorse Clinical Governance Override</h3>
            <button
              type="button"
              className={`${thirdEdition.btn} ${thirdEdition.sm}`}
              onClick={closeEndorseModal}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
          <div className={thirdEdition.modalBody}>
            <div className={thirdEdition.formGroup}>
              <label className={thirdEdition.formLabel} htmlFor="endorseSubj">
                Override Audit Subject
              </label>
              <input
                type="text"
                className={`${thirdEdition.formInput} mono`}
                id="endorseSubj"
                value={
                  selected
                    ? `${selected.id} · ${actionLabels[selected.action]} (${subjectLabel(selected, patientOf)})`
                    : selectedOverride
                      ? `${selectedOverride.id} · ${selectedOverride.patient}`
                      : "No override selected"
                }
                readOnly
              />
            </div>
            <div className={thirdEdition.formGroup}>
              <label className={thirdEdition.formLabel} htmlFor="endorseVerdict">
                Governance Review Verdict
              </label>
              <select
                className={thirdEdition.formSelect}
                id="endorseVerdict"
                value={endorseVerdict}
                onChange={(e) => setEndorseVerdict(e.target.value)}
              >
                <option value="">Choose a verdict</option>
                <option value="Upheld in Full · Justified Clinical Need & Safety">
                  Upheld in Full · Justified Clinical Need &amp; Safety
                </option>
                <option value="Upheld with System Decompression Recommendation">
                  Upheld with System Decompression Recommendation
                </option>
                <option value="Not Upheld · Quality Review Initiated">Not Upheld · Quality Review Initiated</option>
                <option value="Referred to Clinical Governance Committee">
                  Referred to Clinical Governance Committee
                </option>
              </select>
            </div>
            <div className={thirdEdition.formGroup}>
              <label className={thirdEdition.formLabel} htmlFor="endorseRole">
                Reviewing Authority Role
              </label>
              <select
                className={thirdEdition.formSelect}
                id="endorseRole"
                value={endorseRole}
                onChange={(e) => setEndorseRole(e.target.value)}
              >
                <option value="">Choose a reviewing role</option>
                <option value="Clinical Director">Clinical Director</option>
                <option value="Duty Consultant Psychiatrist">Duty Consultant Psychiatrist</option>
                <option value="Governance Lead Psychiatrist">Governance Lead Psychiatrist</option>
                <option value="Executive Director of Clinical Services">Executive Director of Clinical Services</option>
              </select>
            </div>
            <div className={thirdEdition.formGroup}>
              <label className={thirdEdition.formLabel} htmlFor="endorseNotes">
                Audit Findings &amp; Action Plan
              </label>
              <textarea
                className={thirdEdition.formTextarea}
                id="endorseNotes"
                value={endorseNotes}
                onChange={(e) => setEndorseNotes(e.target.value)}
                data-gramm="false"
                data-enable-grammarly="false"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
          <div className={thirdEdition.modalFoot}>
            <button type="button" className={thirdEdition.btn} onClick={closeEndorseModal}>
              Cancel
            </button>
            <button type="button" className={`${thirdEdition.btn} ${thirdEdition.primary}`} onClick={submitEndorsement}>
              Sign &amp; Record Finding
            </button>
          </div>
        </div>
      </div>

      {/* Action Confirmation Toast */}
      <div
        className={`${thirdEdition.toast} ${toastMessage ? thirdEdition.show : ""}`}
        id="actionToast"
        role="status"
        aria-live="polite"
      >
        <span>✓</span>
        <span id="toastMsg">{toastMessage ?? "Action executed successfully."}</span>
      </div>
      <p className={thirdEdition.srOnly} id="screenAnnouncer" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
