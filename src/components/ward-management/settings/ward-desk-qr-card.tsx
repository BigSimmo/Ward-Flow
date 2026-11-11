"use client";

/*
 * Ward desk QR code card (Batch 5, item 42). Shown in Settings only on a ward desk: one row per ward
 * the desk holds, in the network's fixed ward order, each with "Print desk QR code". The printed page
 * carries a QR code of that ward's web address only (`wardDeskUrl`), so scanning it opens the ward's
 * screen after the normal sign-in. No token, code or patient detail is ever in it.
 */

import { useEffect, useSyncExternalStore } from "react";
import { Printer, QrCode } from "lucide-react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { Button, Card, CardHead, Dialog } from "@/components/wf";

import { SettingRow } from "./settings-rows";
import { encodeWardDeskQr, qrPath, wardDeskUrl, type QrMatrix } from "./ward-desk-qr";
import styles from "./ward-desk-qr-card.module.css";

type Printing = { unit: Unit; url: string; matrix: QrMatrix | null; failed: boolean };

/*
 * The open print page, held in this tab's memory only. Settings draws separate phone and desktop
 * trees, and printing can cross the phone width, which remounts this card; keeping the state here,
 * not in the component, keeps the page in the dialog for print (as the patient or carer page does).
 */
let printingNow: Printing | null = null;
const listeners = new Set<() => void>();
function setPrinting(next: Printing | null | ((now: Printing | null) => Printing | null)) {
  printingNow = typeof next === "function" ? next(printingNow) : next;
  for (const listener of listeners) listener();
}
function subscribePrinting(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
let mountedCards = 0;
/** Leaving Settings (no card left a moment later) closes the page. */
function useMountedCard() {
  useEffect(() => {
    mountedCards += 1;
    return () => {
      mountedCards -= 1;
      window.setTimeout(() => {
        if (mountedCards === 0) setPrinting(null);
      }, 1000);
    };
  }, []);
}

/**
 * `demoUnitId`: with role access off, the access in force is the whole network, so Settings passes
 * the ward desk being tried in the demo ("Go to a desk"), and the card offers that ward only.
 */
export function WardDeskQrCard({ demoUnitId }: { demoUnitId?: string } = {}) {
  const access = useEffectiveWardAccess();
  const { units } = useWardFlowSelect("units");
  const printing = useSyncExternalStore(
    subscribePrinting,
    () => printingNow,
    () => null,
  );
  useMountedCard();
  const heldIds =
    access.role === "ward" && access.scope.kind === "ward"
      ? access.scope.unitIds
      : access.role === "coordinator" && demoUnitId !== undefined
        ? [demoUnitId]
        : [];
  const held = new Set(heldIds);
  // A ward that left the desk's scope (cover ended) while its page was open closes that page.
  const stale = printing !== null && !held.has(printing.unit.id);
  useEffect(() => {
    if (stale) setPrinting(null);
  }, [stale]);
  // The network's own fixed ward order (D-126), never the order the desk's scope lists them.
  const wards = units.filter((unit) => held.has(unit.id));
  if (wards.length === 0) return null;
  const shown = stale ? null : printing;

  const openFor = (unit: Unit) => {
    const url = wardDeskUrl(window.location.origin, unit.id);
    setPrinting({ unit, url, matrix: null, failed: false });
    encodeWardDeskQr(url).then(
      (matrix) => setPrinting((now) => (now?.url === url ? { ...now, matrix } : now)),
      () => setPrinting((now) => (now?.url === url ? { ...now, failed: true } : now)),
    );
  };

  return (
    <Card aria-labelledby="desk-qr-title" data-testid="ward-settings-desk-qr-card">
      <CardHead iconPlain id="desk-qr-title" icon={QrCode} title="Desk QR code" />
      {wards.map((unit) => (
        <SettingRow
          key={unit.id}
          setting="desk-qr"
          title={unit.name}
          sub="Scan to open this ward after sign-in"
          testId={`ward-settings-desk-qr-${unit.id}`}
        >
          <Button variant="sec" size="sm" icon={Printer} onClick={() => openFor(unit)}>
            Print desk QR code
          </Button>
        </SettingRow>
      ))}
      <Dialog
        open={shown !== null}
        onClose={() => setPrinting(null)}
        title="Desk QR code"
        description="The code holds this ward's web address only. Ward Flow does not send it anywhere."
        size="md"
        primary={{
          label: "Print or save PDF",
          onAction: () => window.print(),
          loading: shown !== null && !shown.matrix && !shown.failed,
          disabledReason: shown?.failed ? "The code could not be made. Close and try again." : undefined,
        }}
        data-testid="ward-settings-desk-qr-dialog"
      >
        {shown ? <DeskQrPaper printing={shown} /> : null}
      </Dialog>
    </Card>
  );
}

function DeskQrPaper({ printing }: { printing: Printing }) {
  const { unit, url, matrix, failed } = printing;
  const hospital = siteByCode(unit.siteCode)?.name;
  return (
    <article
      className={styles.paper}
      data-print-output
      data-wf-print-doc="desk-qr"
      aria-label={`Desk QR code for ${unit.name}`}
      data-testid="ward-desk-qr-paper"
    >
      <h3 className={styles.ward}>{unit.name}</h3>
      {hospital ? <p className={styles.hospital}>{hospital}</p> : null}
      <div className={styles.code}>
        {matrix ? (
          <svg
            viewBox={`0 0 ${matrix.size} ${matrix.size}`}
            role="img"
            aria-label={`QR code for ${url}`}
            shapeRendering="crispEdges"
            data-testid="ward-desk-qr-svg"
          >
            <rect width={matrix.size} height={matrix.size} fill="#fff" />
            <path d={qrPath(matrix)} fill="#000" />
          </svg>
        ) : (
          <p className={styles.wait} role="status">
            {failed ? "The code could not be made. Close and try again." : "Making the code"}
          </p>
        )}
      </div>
      <p className={styles.say}>Scan to open this ward in Ward Flow. You will be asked to sign in.</p>
      <p className={styles.url} data-testid="ward-desk-qr-url">
        {url}
      </p>
      <p className={styles.foot}>Ward Flow prototype. Synthetic data only.</p>
    </article>
  );
}
