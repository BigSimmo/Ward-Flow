"use client";

/*
 * Patient and carer page (Batch 5, item 40): "Print for patient or carer" on an accepted movement.
 * One A4 page about the receiving ward in plain words. It is printed or saved by a person only;
 * nothing is sent. Draft wording, awaiting consumer, carer and cultural review (see the text file).
 *
 * The paper takes the ward and its hospital only (`patientCarerPageModel`), so no diagnosis, risk,
 * legal form, staff name, UMRN or patient name can reach it.
 *
 * Print isolation is the handover pack's (patient-handover-pack-button.tsx): everything off the
 * paper's own ancestor line is taken out, so the patient page behind the dialog (name, UMRN, legal
 * status) can never print with it. The shared `[data-print-output]` rule only hides by visibility,
 * which the patient page's own print rules override, so it is not used here.
 */

import { useEffect, useSyncExternalStore } from "react";
import { Printer } from "lucide-react";

import { Button, Dialog } from "@/components/wf";

import type { Movement, Unit } from "../ward-model";
import { siteByCode } from "../ward-sites";
import { PATIENT_CARER_TEXT as T, patientCarerPageModel, type PatientCarerPage } from "./patient-carer-page-text";
import styles from "./patient-carer-page.module.css";

/** Stages after a ward has accepted and before arrival: the page is useful while the move is ahead. */
const ACCEPTED_STAGES: ReadonlySet<Movement["stage"]> = new Set([
  "accepted_awaiting_bed",
  "pulled",
  "handover_ready",
  "moving",
]);

/** The page for this movement, or undefined when no ward has accepted it or it is closed or done. */
export function patientCarerPageFor(
  movement: Pick<Movement, "acceptedUnitId" | "stage" | "closure">,
  units: readonly Unit[],
): PatientCarerPage | undefined {
  if (movement.closure || !ACCEPTED_STAGES.has(movement.stage) || !movement.acceptedUnitId) return undefined;
  const unit = units.find((entry) => entry.id === movement.acceptedUnitId);
  if (!unit) return undefined;
  return patientCarerPageModel(unit, siteByCode(unit.siteCode));
}

/** The printed page itself. Fixed words come from `patient-carer-page-text.ts`. */
export function PatientCarerPaper({ page }: { page: PatientCarerPage }) {
  return (
    <article className={styles.paper} data-wf-print-carer aria-label={T.dialogTitle} data-testid="patient-carer-paper">
      <style>{PRINT_CSS}</style>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{T.eyebrow}</p>
        <h3 className={styles.title}>
          {T.titleLead} <span className={styles.ward}>{page.wardName}</span>
        </h3>
        <p className={styles.hospital}>{page.hospitalName}</p>
      </div>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{T.addressLabel}</dt>
          <dd>{page.address}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{T.phoneLabel}</dt>
          <dd>{page.phone}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{T.visitingLabel}</dt>
          <dd>{page.visitingHours}</dd>
        </div>
      </dl>
      <section className={styles.section} aria-labelledby="patient-carer-arrive">
        <h4 id="patient-carer-arrive" className={styles.sectionHead}>
          {T.arriveHeading}
        </h4>
        <ul className={styles.list}>
          {T.arriveSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-labelledby="patient-carer-support">
        <h4 id="patient-carer-support" className={styles.sectionHead}>
          {T.supportHeading}
        </h4>
        <ul className={styles.list}>
          {T.supportSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>
      <footer className={styles.footer}>
        <p className={styles.draft} data-testid="patient-carer-draft-footer">
          {T.draftFooter}
        </p>
        <p>{T.prototypeFooter}</p>
      </footer>
    </article>
  );
}

/*
 * Which movement's page is open, held in this tab's memory only (D-72: nothing on the device). The
 * patient page lays itself out again at the print width (a tablet-width layout), which remounts this
 * entry; keeping the open state here, not in the component, keeps the page in the dialog for print.
 */
let openMovementId: string | null = null;
const listeners = new Set<() => void>();
function setOpenMovement(id: string | null) {
  openMovementId = id;
  for (const listener of listeners) listener();
}
/** Entries on screen per movement: leaving the page (no entry left a moment later) closes it. */
const mounted = new Map<string, number>();
function useMountedEntry(id: string) {
  useEffect(() => {
    mounted.set(id, (mounted.get(id) ?? 0) + 1);
    return () => {
      mounted.set(id, (mounted.get(id) ?? 1) - 1);
      window.setTimeout(() => {
        if (!mounted.get(id) && openMovementId === id) setOpenMovement(null);
      }, 1000);
    };
  }, [id]);
}
function subscribeOpen(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The entry on an accepted movement, opening the page with Print. Shows nothing otherwise. */
export function PatientCarerPageButton({
  movement,
  units,
}: {
  movement: Pick<Movement, "id" | "acceptedUnitId" | "stage" | "closure">;
  units: readonly Unit[];
}) {
  const open = useSyncExternalStore(
    subscribeOpen,
    () => openMovementId === movement.id,
    () => false,
  );
  useMountedEntry(movement.id);
  const page = patientCarerPageFor(movement, units);
  if (!page) return null;
  return (
    <section className={styles.entry} aria-labelledby="patient-carer-head" data-testid="patient-carer-page">
      <div className={styles.entryText}>
        <h2 id="patient-carer-head" className={styles.entryTitle}>
          {T.entryTitle}
        </h2>
        <p className={styles.entrySub}>{T.entrySub}</p>
      </div>
      <Button
        variant="sec"
        size="sm"
        icon={Printer}
        onClick={() => setOpenMovement(movement.id)}
        data-testid="patient-carer-page-open"
      >
        {T.button}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpenMovement(null)}
        title={T.dialogTitle}
        description={T.dialogDescription}
        size="lg"
        primary={{ label: T.printAction, onAction: () => window.print() }}
        data-testid="patient-carer-page-dialog"
      >
        <PatientCarerPaper page={page} />
      </Dialog>
    </section>
  );
}

/** A4 portrait, the paper alone. Keyed by the paper's data attribute, as on the handover pack. */
const PRINT_CSS = `@page { size: A4 portrait; margin: 18mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body *:not(:has([data-wf-print-carer])):not([data-wf-print-carer]):not([data-wf-print-carer] *) { display: none !important; }
  body *:has([data-wf-print-carer]) { position: static !important; transform: none !important; overflow: visible !important; height: auto !important; max-height: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; contain: none !important; background: none !important; visibility: visible !important; display: block !important; }
  [data-wf-print-carer], [data-wf-print-carer] * { visibility: visible !important; }
  [data-wf-print-carer], [data-wf-print-carer] *, body *:has([data-wf-print-carer]) { opacity: 1 !important; animation: none !important; transition: none !important; }
  [data-wf-print-carer] { display: grid !important; position: static !important; width: 100% !important; color: #000 !important; background: #fff !important; }
}`;
