"use client";
// Simplify Settings (Josh, 8 Nov 2026): the things few people need on a visit (the rules file, the
// reference tables, what each feature switch is for) sit closed under one plain row. Nothing is
// removed: the row opens them, and Find a setting opens the fold before it shows a row inside.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import rx from "./settings-layout.module.css";

export function SettingsFold({
  title,
  sub,
  testId,
  children,
}: {
  title: string;
  /** One short line on what is inside. */
  sub?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <details className={rx.fold} data-testid={testId}>
      <summary className={rx.foldSummary}>
        <span className={rx.foldWords}>
          <span className={rx.foldTitle}>{title}</span>
          {sub ? <span className={rx.foldSub}>{sub}</span> : null}
        </span>
        <ChevronDown size={16} aria-hidden="true" className={rx.foldChevron} />
      </summary>
      <div className={rx.foldBody}>{children}</div>
    </details>
  );
}
