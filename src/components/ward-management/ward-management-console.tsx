"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { type MovementId } from "@/components/ward-management/ward-model";
import styles from "./ward-management.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";

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
        <WardPrototypeFooter testId="ward-console-governance" />
      </main>
    </div>
  );
}

export function WardPatientWorkspace({ movementId }: { movementId: MovementId }) {
  const { movements } = useWardFlow();
  const patient = movements.find((candidate) => candidate.id === movementId);

  if (!patient) {
    return <WardMovementNotFound requestedId={movementId} reason="no-such-movement" />;
  }

  return <MovementWorkspaceCockpit movementId={movementId} />;
}
