// src/components/ward-management/reports/fixed-questions.ts
//
// FIXED-MENU QUESTIONS (closing-the-loop features, Josh, 24 Oct 2026). A short, fixed list of plain
// questions a coordinator asks, each answered by a pure selector over recorded data. There is no
// typed question, no AI and no ranking: rows keep recorded order, and every row names the record it
// came from so the screen can link to it. Nothing here releases, books or changes anything.
import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { transportNeedState } from "@/components/ward-management/ward-derivations-transport";
import type { BedRelease, Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import { originName } from "@/components/ward-management/ward-movement-origin";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";

export type FixedQuestionId =
  | "accepted_need_transport"
  | "dependencies_no_owner"
  | "requests_no_ward_asked"
  | "pulls_past_limit"
  | "transfers_no_escort";

/** The record a row came from. The screen turns it into a link; nothing else is carried. */
export type FixedAnswerSource = { kind: "movement"; id: Movement["id"] } | { kind: "discharge"; admissionId: string };

type FixedAnswerRow = { key: string; label: string; detail: string; source: FixedAnswerSource };

export type FixedAnswer = {
  id: FixedQuestionId;
  question: string;
  /** How the answer is read from the record, in plain words. */
  basis: string;
  rows: FixedAnswerRow[];
};

export type FixedQuestionInput = {
  movements: readonly Movement[];
  bedReleases: readonly BedRelease[];
  admissions: readonly Admission[];
  units: readonly Unit[];
  now: Instant;
};

/** H-0807: the stage words every other screen uses (`stageCopy`), never a set of this report's own. */
const STAGE_WORDS: Record<MovementStage, string> = {
  placement_requested: stageCopy.placement_requested.label,
  destination_review: stageCopy.destination_review.label,
  accepted_awaiting_bed: stageCopy.accepted_awaiting_bed.label,
  pulled: stageCopy.pulled.label,
  handover_ready: stageCopy.handover_ready.label,
  moving: stageCopy.moving.label,
  arrived: stageCopy.arrived.label,
};

const ACCEPTED_STAGES: readonly MovementStage[] = ["accepted_awaiting_bed", "pulled", "handover_ready"];

/** The stages in which a transfer to a ward is agreed and not yet arrived. */
const TRANSFER_STAGES: readonly MovementStage[] = ["accepted_awaiting_bed", "pulled", "handover_ready", "moving"];

function unitName(units: readonly Unit[], unitId: string | undefined): string {
  if (unitId === undefined) return "Ward not recorded";
  return units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
}

/**
 * A row's name without a patient name, UMRN or journey number (D-39): the admission number when
 * the journey has one, otherwise where and when the request was raised.
 */
function journeyLabel(movement: Movement, admissions: readonly Admission[], now: Instant): string {
  const admission = admissions.find((each) => each.movementId === movement.id)?.id ?? movement.admissionId;
  if (admission) return admission;
  return `${originName(movement) ?? "Origin not recorded"}, raised ${formatInstantWithDay(movement.openedAt, now)}`;
}

function open(movement: Movement): boolean {
  return movement.closure === undefined && movement.stage !== "arrived";
}

/** A transport job that still stands: booked and not cancelled. */
function liveTransport(movement: Movement) {
  const job = movement.transport;
  return job !== undefined && job.cancelledAt === undefined ? job : undefined;
}

function movementRow(
  movement: Movement,
  admissions: readonly Admission[],
  now: Instant,
  detail: string,
): FixedAnswerRow {
  return {
    key: movement.id,
    label: journeyLabel(movement, admissions, now),
    detail,
    source: { kind: "movement", id: movement.id },
  };
}

/** Every fixed question with its answer, in the menu's fixed order. */
export function fixedQuestionAnswers(input: FixedQuestionInput): FixedAnswer[] {
  const { movements, bedReleases, admissions, units, now } = input;

  const needTransport = movements
    .filter((movement) => open(movement) && ACCEPTED_STAGES.includes(movement.stage))
    .filter((movement) => movement.acceptedUnitId !== undefined)
    .filter((movement) => transportNeedState(movement) !== "not_needed" && liveTransport(movement) === undefined)
    .map((movement) =>
      movementRow(
        movement,
        admissions,
        now,
        `${STAGE_WORDS[movement.stage]} at ${unitName(units, movement.acceptedUnitId)}. ${
          transportNeedState(movement) === "needed" ? "Transport needed" : "Transport need not recorded"
        }, none booked.`,
      ),
    );

  const noOwner = bedReleases
    .filter((release) => release.blocker !== null && release.state !== "discharged")
    .map((release) => ({
      key: release.id,
      label: release.admissionId,
      detail: `${unitName(units, release.unitId)}. Waiting on: ${release.blocker}. Block recorded by ${
        release.blockedBy ?? "not recorded"
      }; no owner recorded.`,
      source: { kind: "discharge" as const, admissionId: release.admissionId },
    }));

  const noWardAsked = movements
    .filter((movement) => open(movement) && movement.acceptedUnitId === undefined)
    .filter((movement) => movement.stage === "placement_requested" || movement.stage === "destination_review")
    .filter((movement) => movement.referredUnitIds.length === 0)
    .map((movement) => movementRow(movement, admissions, now, `${STAGE_WORDS[movement.stage]}. No ward asked yet.`));

  const pastLimit = movements
    .filter((movement) => open(movement) && movement.stage === "pulled")
    .filter((movement) => movement.pullExpiresAt !== undefined && movement.pullExpiresAt < now)
    .map((movement) =>
      movementRow(
        movement,
        admissions,
        now,
        `Bed pulled at ${unitName(units, movement.acceptedUnitId)}. Pull time limit ${formatInstantWithDay(
          movement.pullExpiresAt!,
          now,
        )}. Still pulled until a person releases it.`,
      ),
    );

  const noEscort = movements
    .filter((movement) => open(movement) && TRANSFER_STAGES.includes(movement.stage))
    .filter((movement) => liveTransport(movement) === undefined)
    .map((movement) =>
      movementRow(
        movement,
        admissions,
        now,
        `${STAGE_WORDS[movement.stage]} to ${unitName(units, movement.acceptedUnitId)}. No transport booked, so no escort answer.`,
      ),
    );

  return [
    {
      id: "accepted_need_transport",
      question: "Which accepted referrals still need transport?",
      basis: "Accepted, not yet moving, with no transport booked or marked not needed.",
      rows: needTransport,
    },
    {
      id: "dependencies_no_owner",
      question: "Which discharge dependencies have no owner?",
      basis: "Owners are not recorded, so every blocked discharge is listed.",
      rows: noOwner,
    },
    {
      id: "requests_no_ward_asked",
      question: "Which requests have no ward asked?",
      basis: "Open requests, none accepted.",
      rows: noWardAsked,
    },
    {
      id: "pulls_past_limit",
      question: "Which pulled beds are past their pull time limit?",
      basis: "Shown only. Nothing is released.",
      rows: pastLimit,
    },
    {
      id: "transfers_no_escort",
      question: "Which transfers have no recorded escort?",
      basis: "Agreed transfers with no transport booked, so no escort answer yet.",
      rows: noEscort,
    },
  ];
}
