"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Sheet } from "@/components/wf/sheet";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";

import { filterGlossary, glossaryForSites, screenHelpFor } from "./ward-help-content";
import { useWardNetwork } from "../ward-flow-provider";
import type { HelpView } from "./ward-help-events";
import styles from "./ward-help.module.css";

const VIEWS: readonly { id: Exclude<HelpView, "tour">; label: string }[] = [
  { id: "screen", label: "This screen" },
  { id: "glossary", label: "Glossary" },
];

/**
 * HELP: what this screen is for and a glossary, in one sheet (fix plan item 12), with the way into
 * the desk's tour, which runs over the screen itself (`ward-tour.tsx`). The glossary filter is held
 * in this component only and is never saved.
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
  const { sites } = useWardNetwork();
  const help = useMemo(() => screenHelpFor(pathname, railEntries()), [pathname]);
  const [query, setQuery] = useState("");
  const terms = filterGlossary(query, glossaryForSites(sites));

  return (
    <Sheet
      id="ward-help-sheet"
      testId="ward-help-sheet"
      open
      onClose={onClose}
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
        <button
          type="button"
          className={styles.viewButton}
          onClick={() => onView("tour")}
          data-testid="ward-help-view-tour"
        >
          Take the tour
        </button>
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
    </Sheet>
  );
}
