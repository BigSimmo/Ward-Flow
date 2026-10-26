"use client";

// The facts a captured audit event carries, as the governance detail panel lists them. Split out
// of `governance-registers.tsx` (18 October 2026) to keep that file under the line cap.

import type { ReactNode } from "react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import type { WardConfiguration } from "./ward-configuration";
import type { AuditEvent, BedReleaseAuditFacts, BedReleaseAuditRequest } from "./ward-audit";
import { legalFormReceiptCorrectionReasonLabels } from "./ward-change-reasons";
import { snoozeReasonLabel } from "./ward-inbox-snooze";
import { deskRoleLabel } from "./settings/workstation-desks";
import { Badge } from "@/components/wf";
import thirdEdition from "./governance-third-edition.module.css";
import { ACCESS_ROLE_LABELS } from "./ward-role-access";
import { PATTERN_HOURS, PATTERN_LIMIT, reasonLabel } from "./governance-access-review";
import {
  UNDONE_STEP_LABELS,
  actionLabels,
  destination,
  display,
  outcomeLabels,
  reasonLabels,
  reviewLabels,
  when,
} from "./governance-shared";

export function FactList({ facts }: { facts: readonly (readonly [string, ReactNode])[] }) {
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
/**
 * D-80 item 14: a break glass opening's desk, reason, read only window and how many openings its
 * desk made in 12 hours. More than 3 reads as a pattern.
 */
function BreakGlassFacts({ event, now }: { event: AuditEvent & { action: "BREAK_GLASS" }; now: Instant }) {
  const details = event.details;
  const count = details.deskCount;
  const pattern = `${count} by this desk in ${PATTERN_HOURS} hours`;
  return (
    <FactList
      facts={[
        ["Desk", details.desk ? `${ACCESS_ROLE_LABELS[details.desk]}, ${details.place}` : "Not recorded"],
        ["Reason", `${reasonLabel(details.reason)}${details.otherText ? `: ${details.otherText}` : ""}`],
        [
          "Open",
          event.at === null || details.until === null
            ? "Not recorded"
            : `${formatInstantWithDay(event.at, now)} to ${formatInstantWithDay(details.until, now)}, read only`,
        ],
        ["Pattern", count > PATTERN_LIMIT ? <Badge tone="warning">{pattern}</Badge> : pattern],
      ]}
    />
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
    case "SEND_RELEASE_SUPPORT_NOTICE":
      facts.push(["Service", display(request.service)]);
      break;
    case "CONFIRM_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "RELEASE_BED":
      break;
  }
  return <FactList facts={facts} />;
}
export function EventFacts({ event, units, now }: { event: AuditEvent; units: Unit[]; now: Instant }) {
  switch (event.category) {
    case "referral":
    case "override":
      return (
        <>
          <FactList
            facts={[
              ["Reason supplied", display(event.details.reason)],
              ["Override fact recorded", display(event.details.overrideFactRecorded)],
              ...(event.details.secondSignOff
                ? ([
                    [
                      "Second sign-off",
                      `${event.details.secondSignOff.name}${
                        event.details.secondSignOff.role ? `, ${deskRoleLabel(event.details.secondSignOff.role)}` : ""
                      }`,
                    ],
                  ] as const)
                : []),
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
            // Owner ruling 2026-10-13 22:13 AWST (PR #279): a continuation names the form it continued.
            ...(event.details.operation === "continuation-recorded"
              ? ([["Form continued", display(event.details.formCode)]] as [string, string][])
              : []),
          ]}
        />
      );
    case "record-access":
      if (event.action === "BREAK_GLASS") return <BreakGlassFacts event={event} now={now} />;
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
    case "undo":
      return (
        <FactList
          facts={[
            [
              "Decision undone",
              event.details.undoneAction === null
                ? "Not recorded"
                : event.details.undoneAction === "ACCEPT_REFERRAL"
                  ? "Accept referral"
                  : event.details.undoneAction === "DECLINE_REFERRAL"
                    ? "Decline referral"
                    : (UNDONE_STEP_LABELS[event.details.undoneAction] ?? event.details.undoneAction),
            ],
            [
              "Decided at",
              event.details.decidedAt === null ? "Not recorded" : formatInstantWithDay(event.details.decidedAt, now),
            ],
          ]}
        />
      );
    case "bed-placement":
      return (
        <FactList
          facts={[
            ["From bed", display(event.details.fromBed)],
            ["To bed", display(event.details.toBed)],
          ]}
        />
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
