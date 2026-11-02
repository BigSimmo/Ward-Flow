"use client";

import { ArrowLeft, ArrowRight, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Button, buttonClass, Checkbox, useIsPhone } from "@/components/wf";

import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";

import {
  CHECKLIST_TICKS_STORAGE_KEY,
  checklistForDesk,
  checklistTickId,
  parseChecklistTicks,
  serialiseChecklistTicks,
} from "./ward-help-checklists";
import { howToHref } from "./ward-help-href";
import { canShowMe, HOW_TOS } from "./ward-help-howto";
import type { WardTourRole } from "./ward-help-store";
import s from "./ward-help-checklists.module.css";

/** This tab's ticks, known ids only. Storage can be blocked (private windows), so a failure reads as none. */
function readTicks(): ReadonlySet<string> {
  try {
    return parseChecklistTicks(window.sessionStorage.getItem(CHECKLIST_TICKS_STORAGE_KEY));
  } catch {
    return new Set();
  }
}

/** Writes fixed "checklistId:stepIndex" ids only; nothing is written when there is nothing ticked. */
function writeTicks(ticks: ReadonlySet<string>) {
  try {
    const value = serialiseChecklistTicks(ticks);
    if (value) window.sessionStorage.setItem(CHECKLIST_TICKS_STORAGE_KEY, value);
    else window.sessionStorage.removeItem(CHECKLIST_TICKS_STORAGE_KEY);
  } catch {
    // The ticks still work on screen for as long as Help stays open.
  }
}

/** The name a "Go to" link uses when the host passes none: the rail's own label. */
function defaultScreenName(go: string): string {
  if (go === "home") return "your home screen";
  if (go.startsWith("settings#")) return "Settings";
  return railEntries().find((entry) => entry.id === go)?.label ?? "that screen";
}

/**
 * ONE GUIDED CHECKLIST, as a view inside Help (Josh, 2 Nov 2026): the steps with real tick boxes,
 * a Show me and a Go to link where this desk may use them, and Clear ticks. Ticks are reminders for
 * this browser tab only and never record an event.
 */
export function WardHelpChecklistView({
  id,
  role,
  home,
  onBack,
  onClose,
  onShowMe,
  screenName,
  showMeOn = true,
}: {
  id: string;
  role: WardTourRole;
  home: string | undefined;
  onBack: () => void;
  /** Closes Help, as a Go to link leaves it. */
  onClose: () => void;
  onShowMe: (howToId: string) => void;
  /** The host's name for a screen by its address (the Help sheet's `screenName`); the rail label otherwise. */
  screenName?: (href: string) => string;
  /** False while Show me is switched off, so no Show me is offered. */
  showMeOn?: boolean;
}) {
  const phone = useIsPhone();
  const checklist = checklistForDesk(id, role);
  const [ticks, setTicks] = useState<ReadonlySet<string>>(readTicks);
  const titleId = useId();
  const back = (
    <Button variant="ghost" icon={ArrowLeft} onClick={onBack} className={s.back}>
      Back to Help
    </Button>
  );
  if (!checklist) {
    return (
      <>
        {back}
        <p className={s.note}>This checklist is not for this desk.</p>
      </>
    );
  }
  const ids = checklist.steps.map((step) => checklistTickId(checklist.id, step.index));
  const ticked = ids.filter((tick) => ticks.has(tick)).length;

  function update(next: ReadonlySet<string>) {
    setTicks(next);
    writeTicks(next);
  }

  function toggle(tick: string, on: boolean) {
    const next = new Set(ticks);
    if (on) next.add(tick);
    else next.delete(tick);
    update(next);
  }

  function clear() {
    update(new Set([...ticks].filter((tick) => !ids.includes(tick))));
  }

  return (
    <>
      {back}
      <div>
        <h3 id={titleId} className={s.viewTitle}>
          {checklist.title}
        </h3>
        <p className={s.subtitle}>{checklist.subtitle}</p>
      </div>
      <section className={s.section} aria-labelledby={titleId} data-testid={`ward-help-checklist-${checklist.id}`}>
        <div className={s.headRow}>
          <h4 className={s.sectionHead}>Steps</h4>
          {/* Shown, not announced: each tick box already says whether it is ticked. */}
          <p className={s.count} data-testid="ward-help-checklist-count">
            {ticked} of {ids.length} ticked
          </p>
        </div>
        <ol className={s.card}>
          {checklist.steps.map((step) => {
            const tick = checklistTickId(checklist.id, step.index);
            const href = step.go ? howToHref(step.go, role, home) : undefined;
            const howTo = step.showMe ? HOW_TOS.find((each) => each.id === step.showMe) : undefined;
            const showMe = showMeOn && howTo && canShowMe(howTo, phone) ? howTo.id : undefined;
            const noteId = `${titleId}-note-${step.index}`;
            return (
              <li key={tick} className={s.step} data-ticked={ticks.has(tick) ? "" : undefined}>
                <Checkbox
                  className={s.tick}
                  label={<span className={s.stepText}>{step.text}</span>}
                  checked={ticks.has(tick)}
                  onChange={(event) => toggle(tick, event.currentTarget.checked)}
                  aria-describedby={step.note ? noteId : undefined}
                  data-testid={`ward-help-checklist-tick-${tick}`}
                />
                {step.note ? (
                  <p id={noteId} className={s.stepNote}>
                    {step.note}
                  </p>
                ) : null}
                {showMe || href ? (
                  <div className={s.stepActions}>
                    {showMe ? (
                      <Button
                        variant="ghost"
                        icon={PlayCircle}
                        onClick={() => onShowMe(showMe)}
                        data-testid={`ward-help-checklist-show-${tick}`}
                      >
                        Show me
                      </Button>
                    ) : null}
                    {href && step.go ? (
                      <Link
                        href={href}
                        onClick={onClose}
                        className={buttonClass({ variant: "ghost" })}
                        data-testid={`ward-help-checklist-go-${tick}`}
                      >
                        Go to {screenName ? screenName(href) : defaultScreenName(step.go)}
                        <ArrowRight aria-hidden="true" size={14} strokeWidth={1.75} />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className={s.footRow}>
          <Button onClick={clear} disabled={ticked === 0} data-testid="ward-help-checklist-clear">
            Clear ticks
          </Button>
        </div>
      </section>
    </>
  );
}
