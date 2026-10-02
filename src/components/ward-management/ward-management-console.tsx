"use client";

import {
  ArrowLeft,
  BedSingle,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  Search,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { type Instant } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import {
  MOVEMENT_STAGES,
  type Movement,
  type MovementStage,
  type MovementId,
} from "@/components/ward-management/ward-model";
import styles from "./ward-management.module.css";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import {
  stageReachedAt,
  type StepState,
  trackStepSentence,
} from "@/components/ward-management/movements/movement-workspace-derivations";

export {
  stageChangeReasonLabel,
  declineReasonLabels,
  URGENT_FIGURE_FLAG_CEILING,
  urgentFigureFlags,
  unresolvedOriginDepartment,
  stageReachedAt,
  type StepState,
  trackStepSentence,
  type Attention,
  orphanedTransportAttention,
  attentionItems,
} from "@/components/ward-management/movements/movement-workspace-derivations";

const stageIcons = {
  placement_requested: FileCheck2,
  destination_review: Search,
  accepted_awaiting_bed: BedSingle,
  pulled: CalendarDays,
  handover_ready: ShieldCheck,
  moving: Truck,
  arrived: CheckCircle2,
} satisfies Record<MovementStage, LucideIcon>;

/**
 * THE PROGRESS TRACK FOR ONE PATIENT — and the deletion that matters more than the addition.
 *
 * ⚠️ THIS USED TO RENDER `stageSummaries(movements)`: seven counts — 14/9/6/7/2/6/6 on the day it
 * was reviewed — every one of them a fact about OTHER PATIENTS, on one patient's own page, under a
 * heading that reads as this patient's progress. The call is gone, not reworded, and nothing on
 * this page reads the whole `movements` collection any more.
 *
 * ⚠️ AND IT USED TO BE SEVEN BUTTONS. Clicking a stage moved a local `useState` and nothing else —
 * a future step on somebody else's movement was clickable and did nothing. Steps are plain list
 * items now: this is a record of where a patient has got to, not a control.
 *
 * ⚠️ A CLOSED MOVEMENT HAS NO CURRENT STEP. Observed 2026-09-04: the closure banner said the
 * movement was over while step 3 rendered in accent blue as though it were live. The step a closed
 * movement stopped at is marked `stopped`, which is worded and styled as a full stop, never as
 * "you are here".
 */
function MovementTrack({ movement, now, open }: { movement: Movement; now: Instant; open: boolean }) {
  const reachedIndex = MOVEMENT_STAGES.indexOf(movement.stage);
  return (
    <ol className={styles.track} data-testid="ward-console-track">
      {MOVEMENT_STAGES.map((stage, index) => {
        const Icon = stageIcons[stage];
        const state: StepState =
          index < reachedIndex ? "done" : index > reachedIndex ? "ahead" : open ? "current" : "stopped";
        const at = state === "ahead" ? undefined : stageReachedAt(movement, stage);
        return (
          <li className={styles.trackStep} key={stage} data-state={state}>
            <span className={styles.trackMark} aria-hidden="true">
              <Icon aria-hidden="true" />
            </span>
            <span className={styles.trackBody}>
              <strong className={styles.trackLabel}>
                {index + 1}. {stageCopy[stage].label}
              </strong>
              <span className={styles.trackWhen}>{trackStepSentence(movement, state, at, now)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * ⚠️ **THIS IS A MOVEMENT WORKSPACE, AND ITS PROP NOW SAYS SO.** It was `patientId: string`, and
 * the body looks the value up in `movements` — so the name invited a real patient id and nothing
 * stopped one being passed. It worked only because every call site happened to pass a movement.
 * The prop is now `movementId: MovementId`, so the mistake the old name invited fails to compile
 * rather than rendering a dead-end "no movement matches" page.
 *
 * The ROUTE was `/patients/[patientId]` and just as misleading to a human reader
 * as the prop had been to the compiler. It has since moved to
 * `/mockups/ward-flow/movements/[movementId]`, nested under the existing `movements` mode page —
 * the site map, the reachability assertion and this file's own doc comment all moved with it.
 *
 * ⚠️ **THE PAGE HAS A TENSE NOW, AND THAT WAS THE DEFECT UNDER MOST OF THE OTHERS** (Ward Lead
 * ruling 2, 2026-09-04). A closed movement is a DIFFERENT ARRANGEMENT of this page, not the same
 * page with a banner on top: what happened comes first and dominant, the live tools demote and go
 * quiet, "Current stage" becomes "Stopped at", and the step track shows where it stopped rather
 * than a highlighted step nobody is standing on.
 *
 * ⚠️ **THE READER IS A COORDINATOR WHO ARRIVED FROM A LIST.** Every route in is a list — patient
 * search, the tracker's review link, four mode screens, the network view — so this page never has
 * to introduce the patient. It opens on the answer: what is wrong, then what it means, then the
 * three things a person can actually do.
 */
/**
 * ⚠️ **THE ROUTE USED TO QUOTE BACK AN ID THE USER NEVER TYPED.** `MovementId` is the template
 * literal type `` `WF-${string}` ``, so the bare string `"WF-"` satisfies it — and the route was
 * using exactly that as a sentinel for "this is not a movement id at all", handing it to a page
 * whose not-found sentence then quoted it. `/movements/PT-004` rendered *No synthetic movement
 * matches “WF-”*. Well-typed, so `tsc` could not see it; asserted by no test; and a page telling a
 * clinician something they did not type is the kind of thing that ends up in a screenshot.
 *
 * The sentinel is gone. The route now renders this component directly for a wrong-shaped id, so
 * there is no cast on that path and nothing to quote back wrongly, and the two cases say different
 * things because they ARE different: one is "that is not the sort of thing this screen shows", the
 * other is "it is, and there is no such one".
 *
 * 🔴 AND THE FIRST VERSION OF THIS FIX INTRODUCED A WORSE FALSE STATEMENT THAN THE ONE IT REPLACED.
 * It ended "a person is not a movement, and their record is not reachable from here." A person's
 * record IS reachable: `/mockups/ward-flow/people/[patientId]` renders it, and the patient search
 * links straight to it. So the page sent a coordinator AWAY from the screen holding what they
 * wanted, fluently and with authority. **The old bug quoted nonsense and the reader looked
 * elsewhere; this one was believable.** Caught by an adversarial review, not by me, and not by any
 * test. The lesson is the one worth keeping: every one of these six fixes replaced a sentence with
 * another sentence, and a replacement is a new claim that needs checking exactly as hard as the
 * one it removes.
 */
export function WardMovementNotFound({
  requestedId,
  reason,
}: {
  requestedId: string;
  reason: "no-such-movement" | "not-a-movement-id" | "not-a-person-id";
}) {
  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <header className={styles.workspaceHeader}>
        <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <span className={styles.headerCrumb}>
            {reason === "not-a-person-id" ? "Person not found" : "Movement not found"}
          </span>
        </div>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        <div className={styles.masthead}>
          <span className={styles.eyebrow}>
            {reason === "not-a-person-id" ? "Person record" : "Movement workspace"}
          </span>
          <h1 className={styles.mastheadTitle}>
            {reason === "not-a-person-id" ? "Person not found" : "Movement not found"}
          </h1>
        </div>
        <p className={styles.governanceNote}>
          {reason === "not-a-person-id" ? (
            <>
              &ldquo;{requestedId}&rdquo; is not a person&rsquo;s record number.{" "}
              {requestedId.startsWith("WF-") ? (
                <>
                  It is a movement id.{" "}
                  <Link href={`/mockups/ward-flow/movements/${requestedId}`}>Open that movement instead</Link>.
                </>
              ) : (
                <>Record numbers (UMRN) identify a person. This screen shows one person&rsquo;s own record.</>
              )}
            </>
          ) : reason === "not-a-movement-id" && requestedId.startsWith("PT-") ? (
            <>
              &ldquo;{requestedId}&rdquo; is a person&rsquo;s record identifier, not a movement id. This screen shows
              one movement at a time.{" "}
              <Link href={`/mockups/ward-flow/people/${requestedId}`}>Open that person&rsquo;s record instead</Link>.
            </>
          ) : reason === "not-a-movement-id" ? (
            <>
              &ldquo;{requestedId}&rdquo; is not a movement id. Movement ids begin with WF-. This screen shows one
              movement at a time.
            </>
          ) : (
            <>
              No synthetic movement matches &ldquo;{requestedId}&rdquo;. It may have arrived and closed, or the id is
              incorrect.
            </>
          )}
        </p>
      </main>
    </div>
  );
}

/*
 * The reason each correction control states while it is inert. Named constants because each is
 * rendered TWICE — once as the `title` a pointer user gets, once as the visually hidden text an
 * `aria-describedby` reader gets — and two copies of a sentence drift. Same shape as
 * `DECLINE_REASON_UNCHOSEN` in `referral-match.tsx`.
 */
const WITHDRAW_REASON_UNCHOSEN = "Choose why the acceptance is being withdrawn first. The ward reads the reason.";
const STEP_BACK_UNCHOSEN = "Choose the stage and the reason first. Both are recorded on this movement's audit trail.";
const CANCEL_TRANSPORT_UNCHOSEN = "Choose why the transport job is being cancelled first. The provider is told.";
const URGENT_FLAG_UNCHOSEN = "Choose why this patient is being flagged urgent first.";

export function WardPatientWorkspace({ movementId }: { movementId: MovementId }) {
  const { movements } = useWardFlow();
  const patient = movements.find((candidate) => candidate.id === movementId);

  if (!patient) {
    return <WardMovementNotFound requestedId={movementId} reason="no-such-movement" />;
  }

  return <MovementWorkspaceCockpit movementId={movementId} />;
}
