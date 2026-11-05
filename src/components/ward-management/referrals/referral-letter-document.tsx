"use client";

import { referralLetterModel, type ReferralLetterRow, type ReferralTextInput } from "./referral-letter";
import styles from "./referral-letter-document.module.css";

/**
 * RF2 (Current Issues, 4 Nov 2026): the referral as a styled letter. The same paper shows in the
 * preview and prints to A4, so "Print or save as PDF" gives exactly what the referrer read. Built from
 * `referralLetterModel`, the source of the copy text too. Synthetic prototype, not a medical device.
 */
export function ReferralLetterDocument({
  input,
  stamp,
}: {
  readonly input: ReferralTextInput;
  /** "Draft 10:42 AWST" before sending, or "RF-024 · sent 10:47 AWST" after. */
  readonly stamp: string;
}) {
  const model = referralLetterModel(input);
  return (
    <article className={styles.paper} data-wf-print-letter aria-label="Referral letter">
      <style>{PRINT_CSS}</style>
      {/* A div, not <header>: app print rules hide page headers. */}
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Ward Flow · Synthetic prototype</p>
          <h3 className={styles.title}>{model.title}</h3>
        </div>
        <p className={styles.stamp}>{stamp}</p>
      </div>

      {model.toConfirm.length ? (
        <p className={styles.toConfirm}>
          <strong>Still to confirm</strong> {model.toConfirm.join(" · ")}
        </p>
      ) : null}

      <section className={styles.patient} aria-label="Patient">
        <p className={styles.name}>{model.patient.name}</p>
        <p className={styles.patientMeta}>
          <span className={styles.mono}>UMRN {model.patient.umrn}</span>
          <span>{model.patient.ageSex}</span>
          {model.patient.suburb ? <span>{model.patient.suburb}</span> : null}
        </p>
      </section>

      <dl className={styles.keyStrip}>
        {model.key
          .filter((item) => !item.missing)
          .map((item) => (
            <LetterRow key={item.label} item={item} />
          ))}
      </dl>

      <dl className={styles.details}>
        {model.details
          .filter((item) => !item.missing)
          .map((item) => (
            <LetterRow key={item.label} item={item} />
          ))}
      </dl>

      {/* Answered fields only, the same rule as the copied text. */}
      {model.reason || model.history ? (
        <section className={styles.prose}>
          {model.reason ? (
            <>
              <h4>Reason for referral</h4>
              <p>{model.reason}</p>
            </>
          ) : null}
          {model.history ? (
            <>
              <h4>History</h4>
              <p>{model.history}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <footer className={styles.signoff}>
        <p className={styles.eyebrow}>Referred by</p>
        <p className={styles.referrer}>
          <strong>{model.referrer.name || "Not recorded"}</strong>
          {model.referrer.role ? <span>{model.referrer.role}</span> : null}
          {model.referrer.phone ? <span className={styles.mono}>{model.referrer.phone}</span> : null}
        </p>
      </footer>
    </article>
  );
}

function LetterRow({ item }: { readonly item: ReferralLetterRow }) {
  return (
    <div>
      <dt>{item.label}</dt>
      <dd className={item.missing ? styles.missing : undefined}>{item.value}</dd>
    </div>
  );
}

/** Print isolation, keyed by the paper's data attribute (the same pattern as the handover sheet). */
const PRINT_CSS = `@page { size: A4 portrait; margin: 18mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: none !important; }
  body * { visibility: hidden !important; }
  [data-wf-print-letter], [data-wf-print-letter] * { visibility: visible !important; }
  body *:not(:has([data-wf-print-letter])):not([data-wf-print-letter]):not([data-wf-print-letter] *) { display: none !important; }
  body *:has([data-wf-print-letter]) { position: static !important; transform: none !important; overflow: visible !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; contain: none !important; background: none !important; }
  [data-wf-print-letter] { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}`;
