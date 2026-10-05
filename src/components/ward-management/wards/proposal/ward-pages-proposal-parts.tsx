"use client";

import { useState, type ReactNode } from "react";

import { ignoreUnavailableActivation } from "@/components/primitive-recipes/recipes";

import styles from "./ward-pages-proposal.module.css";

export type WardPagesScreen = "hub" | "ward" | "answer" | "board";

/** Preview routes today; on approval these become `/wards`, `/ward/<id>`, `/ward/<id>/answer`, `/board/<id>`. */
export function wardPagesHref(screen: WardPagesScreen, unitId?: string): string {
  const query = new URLSearchParams({ screen });
  if (unitId) query.set("id", unitId);
  return `/mockups/ward-flow/wards/proposal?${query.toString()}`;
}

export const NOT_WIRED = "Not wired in this prototype.";

export function PageHeader({
  crumbs,
  title,
  dotColour,
  subline,
  asAt,
  action,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  dotColour?: string;
  subline?: ReactNode;
  asAt: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headTop}>
        <div>
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
          <h1 className={styles.title}>
            {dotColour ? <span className={styles.dot} style={{ background: dotColour }} aria-hidden="true" /> : null}
            {title}
          </h1>
          {subline ? <p className={styles.subline}>{subline}</p> : null}
        </div>
        <div className={styles.headSide}>
          <span>{asAt}</span>
          <span className={styles.synthetic}>Synthetic data</span>
          {action}
        </div>
      </div>
    </header>
  );
}

/** One sub-navigation for the three per-ward pages, replacing ten header buttons. */
export function WardSubnav({
  unitId,
  active,
  requests,
  beds,
}: {
  unitId: string;
  active: "ward" | "answer" | "board";
  requests: number;
  beds: number;
}) {
  const items = [
    { id: "ward" as const, label: "Ward today", count: null },
    { id: "answer" as const, label: "Bed requests", count: requests },
    { id: "board" as const, label: "Bed board", count: beds },
  ];
  return (
    <nav className={styles.subnav} aria-label="This ward">
      {items.map((item) => (
        <a key={item.id} href={wardPagesHref(item.id, unitId)} aria-current={item.id === active ? "page" : undefined}>
          {item.label}
          {item.count !== null ? <span className={styles.count}>{item.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}

export type Attention = { tone: "danger" | "warn" | "good" | "info"; label: string; href?: string };

export function Answer({ children, attention = [] }: { children: ReactNode; attention?: Attention[] }) {
  return (
    <section className={styles.answer} aria-label="Summary">
      <p className={styles.answerText}>{children}</p>
      {attention.length ? (
        <ul className={styles.attention} aria-label="Needs attention now">
          {attention.map((item) => (
            <li key={item.label} data-tone={item.tone}>
              <span className={styles.srOnly}>
                {item.tone === "danger" ? "Urgent: " : item.tone === "warn" ? "Check: " : ""}
              </span>
              {item.href ? <a href={item.href}>{item.label}</a> : item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export type Figure = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  keyClass?: string;
  tone?: "good" | "warn" | "danger";
};

export function Figures({ items, label }: { items: Figure[]; label: string }) {
  return (
    <dl className={styles.figures} aria-label={label}>
      {items.map((item) => (
        <div className={styles.figure} key={item.label}>
          <dt>
            {item.keyClass ? <span className={`${styles.key} ${item.keyClass}`} aria-hidden="true" /> : null}
            {item.label}
          </dt>
          <dd>
            <span
              className={`${styles.figureValue} ${
                item.tone === "good"
                  ? styles.goodText
                  : item.tone === "warn"
                    ? styles.warnText
                    : item.tone === "danger"
                      ? styles.dangerText
                      : ""
              }`}
            >
              {item.value}
            </span>
            {item.note ? <span className={styles.figureNote}>{item.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({
  title,
  meta,
  children,
  sheet = false,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  sheet?: boolean;
}) {
  return (
    <section className={`${styles.section} ${sheet ? styles.sheet : ""}`} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Row({ title, sub, end }: { title: ReactNode; sub?: ReactNode; end?: ReactNode }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <p className={styles.rowTitle}>{title}</p>
        {sub ? <p className={styles.rowSub}>{sub}</p> : null}
      </div>
      {end ? <div className={styles.rowEnd}>{end}</div> : null}
    </li>
  );
}

/** A control the prototype does not connect. Says so on screen when used, per D4, and does nothing. */
export function NotWiredButton({ children }: { children: ReactNode }) {
  const [said, setSaid] = useState(false);
  return (
    <span className={styles.notWired}>
      <button
        type="button"
        className={styles.textButton}
        aria-disabled="true"
        title={NOT_WIRED}
        onClick={(event) => {
          ignoreUnavailableActivation(event);
          setSaid(true);
        }}
      >
        {children}
        {said ? null : <span className={styles.srOnly}> ({NOT_WIRED})</span>}
      </button>
      {said ? (
        <span className={styles.notWiredNote} role="status">
          {NOT_WIRED}
        </span>
      ) : null}
    </span>
  );
}

export function WardNotFound() {
  return (
    <main id="main-content" className={styles.page}>
      <h1 className={styles.title}>Ward not found</h1>
      <p className={styles.empty}>
        No ward in this network has that link.{" "}
        <a className={styles.link} href={wardPagesHref("hub")}>
          Back to Ward Hub
        </a>
      </p>
    </main>
  );
}

/** The engine's refusal in plain words, without journey numbers or unit ids. */
export function refusalSentence(reason: string, wardName: string): string {
  const plain = reason
    .replace(/\bmovement\s+WF-\d+\b/gi, "this request")
    .replace(/\bWF-\d+\b/g, "this request")
    .replace(/\b[a-z]+(?:-[a-z]+)+\b(?= does not| is )/g, wardName);
  return `Not recorded. ${plain.charAt(0).toUpperCase()}${plain.slice(1)}${/[.!?]$/.test(plain) ? "" : "."}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
