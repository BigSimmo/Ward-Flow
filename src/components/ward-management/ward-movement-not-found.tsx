"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { handOffPatientSearchText, isNewTabClick } from "@/components/ward-management/search/patient-query-handoff";
import styles from "./ward-management.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";

// Kept apart from ward-management-console.tsx (Oct 2026 phone performance pass) so the person
// and movement not-found routes do not pull the movement cockpit into their first-load JS.
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
  reason: "no-such-movement" | "not-a-movement-id" | "not-a-person-id" | "no-such-umrn";
}) {
  const aboutPerson = reason === "not-a-person-id" || reason === "no-such-umrn";
  // shell-6: a way on to the patient search. An unknown UMRN travels to it in memory (the
  // read-once handoff), never in the link, so the search opens with it typed in.
  const searchLink = (
    <Link
      href="/mockups/ward-flow/search"
      onClick={(event) => handOffPatientSearchText(isNewTabClick(event) ? undefined : requestedId)}
    >
      Search patients for {requestedId}
    </Link>
  );
  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <header className={styles.workspaceHeader}>
        <ContextualBackLink fallbackHref="/mockups/ward-flow" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <span className={styles.headerCrumb}>{aboutPerson ? "Person not found" : "Movement not found"}</span>
        </div>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        {/* shell-11/12: the one not-found pattern; no internal id (WF-, PT-) is ever echoed. */}
        {aboutPerson ? (
          <WardNotFoundBody
            title="Person not found"
            list={{ href: "/mockups/ward-flow/search", label: "All patients" }}
            search={reason === "no-such-umrn" ? searchLink : null}
          >
            {reason === "no-such-umrn" ? `No one with UMRN ${requestedId}.` : "No person matches this link."}
          </WardNotFoundBody>
        ) : (
          <WardNotFoundBody
            title="Movement not found"
            list={{ href: "/mockups/ward-flow/movements", label: "All movements" }}
            extra={
              reason === "not-a-movement-id" && requestedId.startsWith("PT-") ? (
                <Link href={`/mockups/ward-flow/people/${requestedId}`}>Open their patient record</Link>
              ) : null
            }
          >
            {reason === "not-a-movement-id" && requestedId.startsWith("PT-")
              ? "This link is to a patient record, not a movement."
              : "No movement matches this link. It may have closed, or the link is wrong."}
          </WardNotFoundBody>
        )}
        <WardPrototypeFooter testId="ward-console-governance" />
      </main>
    </div>
  );
}
