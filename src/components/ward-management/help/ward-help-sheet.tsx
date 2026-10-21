"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Sheet } from "@/components/wf/sheet";
import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";

import { filterGlossary, screenHelpFor, tourFor } from "./ward-help-content";
import { markTourSeen, type HelpView } from "./ward-help-store";
import styles from "./ward-help.module.css";

const VIEWS: readonly { id: HelpView; label: string }[] = [
  { id: "screen", label: "This screen" },
  { id: "glossary", label: "Glossary" },
  { id: "tour", label: "Tour" },
];

/**
 * HELP: what this screen is for, a glossary and the desk's tour, in one sheet (fix plan item 12).
 * Closing the sheet while on the tour counts as dismissing it, so the "New" marker goes away
 * either way. The glossary filter is held in this component only and is never saved.
 */
export function WardHelpSheet({
  view,
  onView,
  onClose,
}: {
  view: HelpView;
  onView: (view: HelpView) => void;
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const role = useShellPersonaRole();
  const help = useMemo(() => screenHelpFor(pathname, railEntries()), [pathname]);
  const steps = useMemo(() => tourFor(role), [role]);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const terms = filterGlossary(query);
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  function close() {
    if (view === "tour") markTourSeen(role);
    onClose();
  }

  return (
    <Sheet
      id="ward-help-sheet"
      testId="ward-help-sheet"
      open
      onClose={close}
      title="Help"
      description="Synthetic prototype, not approved for clinical use."
      placement="right"
      bodyClassName={styles.body}
    >
      <div className={styles.views} role="group" aria-label="Help sections">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.viewButton}
            aria-pressed={view === item.id}
            onClick={() => onView(item.id)}
            data-testid={`ward-help-view-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "screen" ? (
        help ? (
          <section aria-labelledby="ward-help-screen-title" data-testid="ward-help-screen">
            <h3 id="ward-help-screen-title" className={styles.title}>
              {help.title}
            </h3>
            <p className={styles.text}>{help.purpose}</p>
            <h4 className={styles.subTitle}>Main actions</h4>
            <ul className={styles.list}>
              {help.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </section>
        ) : (
          <p className={styles.text} data-testid="ward-help-screen-none">
            This screen has no help page yet. The glossary and tour still apply.
          </p>
        )
      ) : null}

      {view === "glossary" ? (
        <section aria-label="Glossary" data-testid="ward-help-glossary">
          <label className={styles.searchLabel}>
            Find a word or code
            <input
              type="search"
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              data-testid="ward-help-glossary-filter"
            />
          </label>
          {terms.length === 0 ? (
            <p className={styles.text}>No word or code matches.</p>
          ) : (
            <dl className={styles.glossary}>
              {terms.map((entry) => (
                <div key={entry.term} className={styles.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ) : null}

      {view === "tour" && current ? (
        <section aria-labelledby="ward-help-tour-title" data-testid="ward-help-tour">
          <p className={styles.stepCount}>
            {`${CHROME_ROLE_LABELS[role]} tour, step ${Math.min(step, steps.length - 1) + 1} of ${steps.length}`}
          </p>
          <h3 id="ward-help-tour-title" className={styles.title}>
            {current.title}
          </h3>
          <p className={styles.text} aria-live="polite">
            {current.body}
          </p>
          <div className={styles.tourActions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Back
            </button>
            {last ? (
              <button type="button" className={styles.primary} onClick={close} data-testid="ward-help-tour-done">
                Done
              </button>
            ) : (
              <button
                type="button"
                className={styles.primary}
                onClick={() => setStep((value) => value + 1)}
                data-testid="ward-help-tour-next"
              >
                Next
              </button>
            )}
          </div>
        </section>
      ) : null}
    </Sheet>
  );
}
