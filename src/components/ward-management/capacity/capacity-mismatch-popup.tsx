"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { DrawerFootRow, PanelDrawer, buttonClass, durMinutes } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { movementStatusLabel } from "@/components/ward-management/ward-stage-copy";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import type { KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";
import type { Unit } from "@/components/ward-management/ward-model";

import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { bedKindBreakdown, type BedKindGap } from "./capacity-derivations";
import { FREE_THE_RIGHT_BED_NOTE, dischargesThatFree, freeTheRightBedTitle } from "./free-the-right-bed";
import { gapWords } from "./capacity-range-line";
import styles from "./capacity-page.module.css";

const WAITING_HREF = "/ward-flow/waiting";

/**
 * Capacity issue 1 (Josh, 3 Nov 2026): a Mismatch card opens on what can be acted on. The figures
 * across the top repeat the card, then the wards holding a ready bed of this type (each opens its
 * ward), then the people waiting for one, longest wait first. Nothing here ranks a ward for a
 * person: the two lists sit side by side and the coordinator matches them.
 */
export function MismatchPopup({
  row,
  title,
  tomorrow,
  now,
  onClose,
  onWard,
  units,
}: {
  row: BedKindGap | null;
  title: string;
  tomorrow: Pick<KindForecast, "low" | "likely" | "high"> | undefined;
  now: number;
  onClose: () => void;
  onWard?: (unitId: string) => void;
  /** The same wards the card's figures count, so the ready-bed list adds up to "Ready that fit". */
  units: readonly Unit[];
}) {
  const { movements, admissions, referrals, bedReleases } = useWardFlowSelect(
    "movements",
    "admissions",
    "referrals",
    "bedReleases",
  );
  const patientOf = usePatientOf();
  const canOpen = useCanOpenHref();
  const detail = useMemo(
    () => (row ? bedKindBreakdown(row.id, movements, [...units], admissions, referrals) : null),
    [row, movements, units, admissions, referrals],
  );
  const short = (row?.gap ?? 0) < 0;
  // Free the right bed (Josh, 8 Nov 2026): a short type lists today's discharges that free one.
  const freeing = useMemo(
    () => (row && short ? dischargesThatFree(row.id, bedReleases, units, admissions, now) : []),
    [row, short, bedReleases, units, admissions, now],
  );
  return (
    <PanelDrawer
      open={row !== null}
      onClose={onClose}
      eyebrow="Mismatch"
      title={`${title} beds`}
      testId="capacity-mismatch-popup"
      bodyClassName={styles.drawerPad}
      foot={
        canOpen(WAITING_HREF) ? (
          <DrawerFootRow>
            <Link href={WAITING_HREF} className={buttonClass({ variant: "pri" })}>
              Open Waiting
            </Link>
          </DrawerFootRow>
        ) : undefined
      }
    >
      {row && detail ? (
        <div className={styles.popBody}>
          <p className={styles.popLead}>{row.who}</p>
          <dl className={styles.popFigs}>
            <div>
              <dt>Now</dt>
              <dd className={short ? styles.warnInk : styles.okInk}>{gapWords(row.gap)}</dd>
            </div>
            <div>
              <dt>Waiting</dt>
              <dd>{row.waiting}</dd>
            </div>
            <div>
              <dt>Ready that fit</dt>
              <dd>{row.bedsThatFit}</dd>
            </div>
            {tomorrow ? (
              <div>
                <dt>Tomorrow</dt>
                <dd className={tomorrow.likely < 0 ? styles.warnInk : styles.okInk}>{gapWords(tomorrow.likely)}</dd>
                <span className={styles.popFigSub}>
                  {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
                </span>
              </div>
            ) : null}
          </dl>

          <section aria-labelledby="mm-pop-wards" className={styles.popSection}>
            <h3 id="mm-pop-wards" className={styles.popHead}>
              Ready beds that fit <span className={styles.popCount}>{detail.wards.length} wards</span>
            </h3>
            {detail.wards.length === 0 ? (
              <p className={styles.popEmpty}>No ward has a ready {title.toLowerCase()} bed now.</p>
            ) : (
              <ul className={styles.popList}>
                {detail.wards.map(({ unit, beds }) => {
                  const site = siteByCode(unit.siteCode);
                  const inner = (
                    <>
                      <span className={styles.popMain}>
                        <span className={styles.popName}>
                          <SpelledCodes text={unit.name} />
                        </span>
                        <span className={styles.mutedXs}>
                          {siteLabel(unit.siteCode, site?.name)} · {site?.service ?? "Service not recorded"}
                        </span>
                      </span>
                      <span className={styles.popBeds}>
                        <b>{beds}</b> ready
                      </span>
                    </>
                  );
                  return (
                    <li key={unit.id}>
                      {onWard ? (
                        <button type="button" className={styles.popRow} onClick={() => onWard(unit.id)}>
                          {inner}
                          <ChevronRight
                            strokeWidth={1.75}
                            size={14}
                            aria-hidden="true"
                            className={styles.helpChevron}
                          />
                        </button>
                      ) : (
                        <span className={styles.popRow}>{inner}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {short ? (
            <section aria-labelledby="mm-pop-freeing" className={styles.popSection}>
              <h3 id="mm-pop-freeing" className={styles.popHead}>
                {freeTheRightBedTitle(title)} <span className={styles.popCount}>{freeing.length}</span>
              </h3>
              {freeing.length === 0 ? (
                <p className={styles.popEmpty}>None planned for the rest of today.</p>
              ) : (
                <ul className={styles.popList} data-testid="capacity-free-the-right-bed">
                  {freeing.map((item) => (
                    <li key={item.releaseId}>
                      <span className={styles.popRow}>
                        <span className={styles.popMain}>
                          <span className={styles.popName}>
                            <SpelledCodes text={item.unit.name} />
                          </span>
                          <span className={styles.mutedXs}>
                            {item.heldUp
                              ? `Held up: ${item.heldUp}`
                              : (item.waitingOn ??
                                (item.confirmed ? "Confirmed by the ward" : "Expected, nothing outstanding"))}{" "}
                            · reported {formatInstantWithDay(item.reportedAt, now)}
                          </span>
                        </span>
                        <span className={styles.popWait}>{formatInstantWithDay(item.expectedAt, now)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.popEmpty}>{FREE_THE_RIGHT_BED_NOTE}</p>
            </section>
          ) : null}

          <section aria-labelledby="mm-pop-waiting" className={styles.popSection}>
            <h3 id="mm-pop-waiting" className={styles.popHead}>
              Waiting for this bed <span className={styles.popCount}>{detail.waiting.length} people</span>
            </h3>
            {detail.waiting.length === 0 ? (
              <p className={styles.popEmpty}>Nobody is waiting for a {title.toLowerCase()} bed.</p>
            ) : (
              <ul className={styles.popList}>
                {detail.waiting.map((movement) => {
                  const who = patientOf(movement);
                  const href = who.patient ? patientHref(who.patient.id) : null;
                  const inner = (
                    <>
                      <span className={styles.popMain}>
                        <span className={styles.popName}>{who.formalName}</span>
                        <span className={styles.mutedXs}>
                          <SpelledCodes text={movementOriginLabel(movement, edById(movement.originEdId)?.name)} /> ·{" "}
                          {movementStatusLabel(movement)}
                        </span>
                      </span>
                      <span className={styles.popWait}>{durMinutes(Math.max(0, now - movement.openedAt))}</span>
                    </>
                  );
                  return (
                    <li key={movement.id}>
                      {href && canOpen(href) ? (
                        <Link href={href} className={styles.popRow}>
                          {inner}
                          <ChevronRight
                            strokeWidth={1.75}
                            size={14}
                            aria-hidden="true"
                            className={styles.helpChevron}
                          />
                        </Link>
                      ) : (
                        <span className={styles.popRow}>{inner}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </PanelDrawer>
  );
}
