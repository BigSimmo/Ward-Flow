"use client";

// Tier 1 now: the Movements panel that calls out the longest-waiting Tier 1 journeys. Split out of
// movements-screen.tsx (Movements redesign, 31 Oct 2026) so the screen stays under its line cap. On
// a phone it sits in the band under the hero; on a tablet or laptop it heads the side column, above
// Transport now, with the heading above one row per person.
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StatusGlyph, Timer, buttonClass, cx } from "@/components/wf";
import { waitingHref } from "@/components/ward-management/delays/waiting-href";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import type { DueSoonThresholds, Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { TierPill } from "./movements-stage-row";
import { MS_PER_MINUTE, legalActNowReason, meaningfulBlocker } from "./movements-screen-helpers";
import flow from "./movement-flow.module.css";
import styles from "./movements.module.css";

export function MovementsTierOneNow({
  side,
  coreCount,
  openCount,
  attentionMovements,
  service,
  isInServiceScope,
  patients,
  referrals,
  now,
  thresholds,
  accessTarget,
  onFind,
}: {
  /** True in the side column (tablet and laptop); false in the band under the phone hero. */
  side: boolean;
  coreCount: number;
  openCount: number;
  attentionMovements: readonly Movement[];
  service: string | null;
  isInServiceScope: ((movement: Movement) => boolean) | null;
  patients: readonly Patient[];
  referrals: Referral[];
  now: Instant;
  thresholds: DueSoonThresholds;
  /** The configured ED access target, in minutes. */
  accessTarget: number;
  onFind: (movementId: string) => void;
}) {
  return (
    <div
      className={cx(styles.needsYou, side && styles.sideNeeds)}
      role="group"
      aria-label="Tier 1 now"
      data-testid="movements-needs-you"
    >
      <div className={cx(styles.needsYouHead, side && styles.sideNeedsHead)}>
        <h2 className={styles.needsYouTitle}>Tier 1 now</h2>
        {/* Redesign round 2: "3 of 18 open" on one line; the heading names Tier 1. */}
        {coreCount > 0 ? (
          <span className={styles.needsYouMeta}>
            {coreCount} of {openCount} open
          </span>
        ) : null}
        {/* B4: the full list of what needs the coordinator, in Delays' Needs me now view. */}
        <Link href={waitingHref("needs-me")} className={buttonClass({ variant: "ghost", size: "sm" })}>
          All in Waiting
        </Link>
      </div>
      {attentionMovements.length === 0 ? (
        <p className={styles.attentionEmpty}>No open Tier 1 movement needs calling out.</p>
      ) : (
        // D-b (Ward Lead's decisions, 2026-09-17): built off `openMovements`, never the scoped
        // worklist, and a movement outside the chosen service says so.
        <ul className={cx(flow.needsList, side && styles.sideNeedsList)}>
          {attentionMovements.map((movement) => {
            const outsideService = service !== null && isInServiceScope !== null && !isInServiceScope(movement);
            const subject = resolveSubjectPatient(movement, { patients, referrals });
            // Surname first on every device, as the worklist and timeline list people.
            const who = subject.formalName;
            const legalReason = legalActNowReason(movement, now, thresholds);
            const reason = legalReason ?? meaningfulBlocker(movement) ?? stageCopy[movement.stage].label;
            return (
              <li key={movement.id} className={cx(flow.needsCell, side && styles.sideNeedsCell)}>
                <button
                  type="button"
                  className={flow.needsItem}
                  data-record-key={movement.id}
                  // Act-now rows only (a legal authority passed or approaching): the act tint, and a
                  // status glyph before the reason in place of the old red side edge.
                  data-act-now={legalReason ? "true" : undefined}
                  onClick={() => onFind(movement.id)}
                  aria-label={`Find ${who} in worklist: ${reason}${outsideService ? ` — outside ${service}` : ""}`}
                >
                  <TierPill tier={movement.urgency} />
                  <span className={flow.needsMain}>
                    <span className={flow.needsTop}>
                      <strong className={flow.needsName}>{who}</strong>
                      <span className={flow.needsWait}>
                        <Timer
                          at={movement.openedAt * MS_PER_MINUTE}
                          now={now * MS_PER_MINUTE}
                          direction="waiting"
                          thresholds={{
                            dueSoon: ED_SEVERE_PRESSURE_WAIT_MINUTES * MS_PER_MINUTE,
                            overdue: accessTarget * MS_PER_MINUTE,
                          }}
                          hideFlagWord
                          hideDirection
                        />
                        <span className="sr-only"> waiting</span>
                      </span>
                    </span>
                    <span className={flow.needsReason} title={reason}>
                      {legalReason ? <StatusGlyph tone="danger" size={9} className={flow.needsGlyph} /> : null}
                      {reason}
                      {outsideService ? (
                        <span
                          data-testid={`movements-attention-outside-${movement.id}`}
                        >{` · Outside ${service}`}</span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronRight size={16} className={flow.needsChevron} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
