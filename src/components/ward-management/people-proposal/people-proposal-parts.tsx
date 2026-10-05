import type { ReactNode } from "react";

import styles from "./people-proposal.module.css";

/** The four screens this proposal covers, each beside its current route. */
export type PeopleProposalScreen = "hub" | "patients" | "patient" | "add";

const SCREENS: { id: PeopleProposalScreen; label: string; href: string; current: string }[] = [
  {
    id: "hub",
    label: "Search hub",
    href: "/mockups/ward-flow/hub/proposal",
    current: "/mockups/ward-flow/hub",
  },
  {
    id: "patients",
    label: "Patients",
    href: "/mockups/ward-flow/search/proposal",
    current: "/mockups/ward-flow/search",
  },
  {
    id: "patient",
    label: "One patient",
    href: "/mockups/ward-flow/people/proposal?id=PT-001",
    // The patient preview always passes its own current link; this is only the fallback.
    current: "/mockups/ward-flow/search",
  },
  {
    id: "add",
    label: "Add a patient",
    href: "/mockups/ward-flow/people/new/proposal",
    current: "/mockups/ward-flow/people/new",
  },
];

/** Preview-only frame: says this is a proposal and links each screen to its current version. */
export function PeopleProposalBar({ active, current }: { active: PeopleProposalScreen; current?: string }) {
  const screen = SCREENS.find((entry) => entry.id === active) ?? SCREENS[0];
  return (
    <div className={styles.previewBar} data-testid="people-proposal-preview-bar">
      <strong>Proposed redesign (preview)</strong>
      <nav className={styles.previewTabs} aria-label="Proposed search and patient screens">
        {SCREENS.map((entry) => (
          <a key={entry.id} href={entry.href} aria-current={entry.id === active ? "page" : undefined}>
            {entry.label}
          </a>
        ))}
      </nav>
      <a className={styles.textLink} href={current ?? screen.current}>
        Current {screen.label.toLowerCase()} ›
      </a>
    </div>
  );
}

export function ProposalHeader({
  crumbs,
  title,
  asAt,
  children,
}: {
  crumbs?: { label: string; href?: string }[];
  title: ReactNode;
  asAt: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <p className={styles.crumbs}>
              {crumbs.map((crumb, index) => (
                <span key={crumb.label}>
                  {index > 0 ? "› " : ""}
                  {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : crumb.label}
                </span>
              ))}
            </p>
          </nav>
        ) : null}
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.headerMeta}>
        <span>As at {asAt}</span>
        <span className={styles.chip}>
          <span className={styles.chipDot} aria-hidden="true" />
          Synthetic data
        </span>
        {children}
      </div>
    </header>
  );
}

export function Panel({
  title,
  question,
  meta,
  foot,
  children,
  id,
}: {
  title: string;
  question?: string;
  meta?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className={styles.panel} aria-label={title} id={id}>
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {question ? <p className={styles.panelQuestion}>{question}</p> : null}
        </div>
        {meta !== undefined ? <span className={styles.panelMeta}>{meta}</span> : null}
      </div>
      {children}
      {foot ? <div className={styles.panelFoot}>{foot}</div> : null}
    </section>
  );
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
