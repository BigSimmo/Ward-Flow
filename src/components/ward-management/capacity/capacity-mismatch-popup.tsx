"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { DrawerFootRow, Menu, PanelDrawer, buttonClass, durMinutes } from "@/components/wf";
import { SpelledCodes, codeName } from "@/components/ward-management/ward-abbreviations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { movementStatusLabel } from "@/components/ward-management/ward-stage-copy";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import {
  REFERENCE_DISTANCE_CAVEAT,
  referenceDistance,
} from "@/components/ward-management/reference/ward-reference-distances";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import type { KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";
import type { EmergencyDepartment, Movement, Unit } from "@/components/ward-management/ward-model";

import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { bedKindBreakdown, type BedKindGap } from "./capacity-derivations";
import { FREE_THE_RIGHT_BED_NOTE, dischargesThatFree, freeTheRightBedTitle } from "./free-the-right-bed";
import { HowWorkedOut } from "./capacity-how-worked-out";
import { MismatchFigure } from "./capacity-mismatch-figure";
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
    () => (row ? bedKindBreakdown(row.id, movements, [...units], admissions, referrals, bedReleases) : null),
    [row, movements, units, admissions, referrals, bedReleases],
  );
  // Option B (Josh, 8 Nov 2026): drive times sit on the wards that fit, measured from the ED where
  // most of these people wait (ties: the longest wait), until the coordinator picks another.
  const waitingAt = useMemo(() => countByEd(detail?.waiting ?? []), [detail]);
  const [chosenEdId, setChosenEdId] = useState<string | undefined>(undefined);
  const fromEd = edById(chosenEdId ?? waitingAt[0]?.edId) ?? allEmergencyDepartments()[0];
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
      subtitle={row?.who}
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
          <MismatchFigure
            gap={row.gap}
            waiting={row.waiting}
            bedsThatFit={row.bedsThatFit}
            freeingToday={freeing.length}
            tomorrow={tomorrow}
          />

          <section aria-labelledby="mm-pop-wards" className={styles.popSection}>
            <div className={styles.mmWardsHead}>
              <h3 id="mm-pop-wards" className={styles.popHead}>
                Ready beds that fit <span className={styles.popCount}>{detail.wards.length} wards</span>
              </h3>
              {detail.wards.length > 0 ? (
                <DriveFromPicker edId={fromEd?.id} waitingAt={waitingAt} onChoose={setChosenEdId} />
              ) : null}
            </div>
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
                      <span className={styles.mmDrive}>{driveWords(fromEd, unit)}</span>
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
            {detail.wards.length > 0 ? (
              <HowWorkedOut label="Drive time is distance only, not suitability">
                <p>{REFERENCE_DISTANCE_CAVEAT}</p>
              </HowWorkedOut>
            ) : null}
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

/** EDs where people wait for this bed, most first; a tie keeps the ED of the longer wait first. */
function countByEd(waiting: readonly Movement[]): { edId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const movement of waiting) {
    if (movement.originEdId) counts.set(movement.originEdId, (counts.get(movement.originEdId) ?? 0) + 1);
  }
  return [...counts].map(([edId, count]) => ({ edId, count })).sort((a, b) => b.count - a.count);
}

/** "27 min drive", "On site" or "No route": distance only, from the reference table. */
function driveWords(ed: EmergencyDepartment | undefined, unit: Unit): string {
  const route = referenceDistance(ed?.referenceEdId, siteByCode(unit.siteCode)?.referenceSiteId);
  if (route === null) return "No route";
  return route.min === 0 ? "On site" : `${Math.round(route.min)} min`;
}

function DriveFromPicker({
  edId,
  waitingAt,
  onChoose,
}: {
  edId: string | undefined;
  waitingAt: readonly { edId: string; count: number }[];
  onChoose: (edId: string) => void;
}) {
  const departments = allEmergencyDepartments();
  const counts = new Map(waitingAt.map((entry) => [entry.edId, entry.count]));
  const ed = departments.find((d) => d.id === edId);
  const waitingHere = ed ? (counts.get(ed.id) ?? 0) : 0;
  return (
    <Menu
      label="Drive time from"
      align="end"
      items={departments.map((d) => ({
        id: d.id,
        label: codeName(d.siteCode) ?? d.siteCode,
        meta: counts.get(d.id) ? `${counts.get(d.id)} waiting` : `${d.siteCode} ED`,
        checked: d.id === edId,
        checkable: "radio" as const,
        onSelect: () => onChoose(d.id),
      }))}
      trigger={(props) => (
        <button type="button" {...props} className={styles.rtPicker}>
          <span className={styles.rtPickerFrom}>From</span>
          {ed === undefined ? "Choose ED" : <SpelledCodes text={`${ed.siteCode} ED`} />}
          {waitingHere > 0 ? <span className={styles.rtPickerFrom}>· {waitingHere} waiting</span> : null}
          <ChevronDown strokeWidth={1.75} size={14} aria-hidden="true" />
        </button>
      )}
    />
  );
}
