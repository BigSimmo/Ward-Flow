"use client";

/*
 * ED-to-ward handover pack (item 17): one button where an accepted patient is seen, opening one
 * printable A4 page with Copy and Print. The page and the copy text both come from
 * `handoverPackModel`. Nothing is sent: no email, no message, only print or copy by a person, and
 * the copy goes through `ward-clipboard`, which drops the UMRN.
 */

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Button, Dialog } from "@/components/wf";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { handoverPackModel, handoverPackText, type HandoverPackInput } from "./patient-handover-pack";
import styles from "./patient-handover-pack.module.css";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

/** Sections whose single row label repeats the heading; others keep it (what is outstanding, whose contact). */
const HEADING_LABELLED_SECTIONS: ReadonlySet<string> = new Set(["risks", "clearance", "medication"]);

export function PatientHandoverPackButton({ input, dayZero }: { input: HandoverPackInput; dayZero: Date }) {
  const zone = useClockZoneLabel();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pack = handoverPackModel(input, dayZero);
  // A printed pack outlives its day, so it carries the full date, never a bare clock face.
  const stamp = formatSheetMoment(input.now, dayZero, { includeYearAndZone: true, zone });
  async function copy() {
    try {
      await copyTextToClipboard(handoverPackText(pack, stamp));
      setNotice("Copied. The UMRN is left off copied text.");
    } catch {
      setNotice("Copy unavailable in this browser");
    }
  }
  return (
    <section className={styles.entry} aria-labelledby="pn-handover-head" data-testid="pn-handover-pack">
      <div className={styles.entryText}>
        <h2 id="pn-handover-head" className={styles.entryTitle}>
          Handover pack
        </h2>
        <p className={styles.entrySub}>
          One page for the receiving ward: legal, risks, clearance, chart, contacts, outstanding items.
        </p>
      </div>
      <Button
        variant="sec"
        size="sm"
        icon={ClipboardList}
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
        data-testid="pn-handover-pack-open"
      >
        Handover pack
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Handover pack"
        description={<span role="status">{notice ?? "Print it or copy it. Ward Flow does not send it anywhere."}</span>}
        size="lg"
        secondary={[{ label: "Copy", onAction: () => void copy() }]}
        primary={{ label: "Print or save PDF", onAction: () => window.print() }}
        data-testid="pn-handover-pack-dialog"
      >
        <article className={styles.paper} data-wf-print-handover aria-label="Handover pack">
          <style>{PRINT_CSS}</style>
          <div className={styles.head}>
            <div>
              <p className={styles.eyebrow}>Ward Flow · Synthetic prototype</p>
              <h3 className={styles.title}>{pack.title}</h3>
            </div>
            <p className={styles.stamp}>{stamp}</p>
          </div>
          <div className={styles.sections}>
            {pack.sections.map((section) => {
              // A one-fact section whose label only repeats the heading drops that label.
              const single = section.rows.length === 1 && HEADING_LABELLED_SECTIONS.has(section.id);
              return (
                <section
                  key={section.id}
                  className={`${styles.section} ${section.rows.length > 3 ? styles.wide : ""}`}
                  aria-label={section.heading}
                >
                  <h4 className={styles.sectionHead}>{section.heading}</h4>
                  <dl className={styles.rows}>
                    {section.rows.map((row, index) => (
                      <div key={`${row.label}-${index}`} className={single ? styles.rowSingle : styles.row}>
                        <dt className={single ? "sr-only" : undefined}>{row.label}</dt>
                        <dd className={row.missing ? styles.missing : undefined}>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {section.note ? <p className={styles.note}>{section.note}</p> : null}
                </section>
              );
            })}
          </div>
          <p className={styles.note}>Printed or copied by hand only. Not sent by Ward Flow.</p>
        </article>
      </Dialog>
    </section>
  );
}

/** Print isolation, keyed by the paper's data attribute (the referral letter's pattern). */
const PRINT_CSS = `@page { size: A4 portrait; margin: 16mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: none !important; }
  body * { visibility: hidden !important; }
  [data-wf-print-handover], [data-wf-print-handover] * { visibility: visible !important; }
  body *:not(:has([data-wf-print-handover])):not([data-wf-print-handover]):not([data-wf-print-handover] *) { display: none !important; }
  body *:has([data-wf-print-handover]) { position: static !important; transform: none !important; overflow: visible !important; height: auto !important; max-height: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; contain: none !important; background: none !important; }
  [data-wf-print-handover] { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; color: #000 !important; background: #fff !important; }
  [data-wf-print-handover] section { break-inside: avoid; }
}`;
