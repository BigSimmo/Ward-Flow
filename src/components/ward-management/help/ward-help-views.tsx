"use client";

import { ArrowLeft, ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonClass } from "@/components/wf";

import { SHORTCUT_GROUPS, shortcutsForDesk } from "./ward-help-content";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "./ward-help-guide";
import type { WardTourRole } from "./ward-help-store";
import type { WhatsNewEntry } from "./ward-whats-new";

import { howToHref } from "./ward-help-href";
import s from "./ward-help-panel.module.css";

/* ── What's new ─────────────────────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sat 31 Oct" from "2026-10-31", read as a calendar day with no time zone shift. */
function dayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = DAYS[new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay()];
  return `${weekday} ${day} ${MONTHS[(month ?? 1) - 1] ?? ""}`;
}

/** "Ward: …" at the start of a line becomes the line's area tag. */
function splitArea(line: string): { area?: string; text: string } {
  const match = /^([A-Z][A-Za-z' ]{2,24}):\s*(.*)$/u.exec(line);
  if (!match) return { text: line };
  const text = match[2] ?? "";
  return { area: match[1], text: text.charAt(0).toUpperCase() + text.slice(1) };
}

const FIRST_NEWS = 10;

/**
 * WHAT'S NEW: newest first, by day, with a dot on each change this device has not seen. "Mark all as
 * seen" clears the dots (in the app it moves the device's saved "seen" id, as the corner card does).
 */
export function HelpNews({
  entries,
  unread,
  onSeen,
}: {
  entries: readonly WhatsNewEntry[];
  unread: number;
  onSeen: () => void;
}) {
  const [all, setAll] = useState(false);
  const newest = entries.toReversed();
  const shown = all ? newest : newest.slice(0, FIRST_NEWS);
  return (
    <>
      <div className={`${s.card} ${s.newHead}`}>
        <span className={s.hereIcon} aria-hidden="true">
          <Sparkles aria-hidden="true" strokeWidth={1.75} />
        </span>
        <p>
          {unread ? (
            <>
              <b>{unread} new</b> since you last looked.
            </>
          ) : (
            "You are up to date."
          )}
        </p>
        {unread ? (
          <Button variant="ghost" onClick={onSeen}>
            Mark all as seen
          </Button>
        ) : null}
      </div>
      <section className={s.card} aria-label="Recent changes" data-testid="ward-help-new">
        {shown.map((entry, index) => {
          const { area, text } = splitArea(entry.line);
          const head =
            entry.date !== shown[index - 1]?.date ? (
              <div className={s.day}>
                {index === 0 ? "Latest · " : ""}
                {dayName(entry.date)}
              </div>
            ) : null;
          return (
            <div key={entry.id}>
              {head}
              <div className={s.item}>
                <span className={s.dot} data-seen={index < unread ? undefined : ""} aria-hidden="true" />
                <p>
                  {index < unread ? <span className="sr-only">New: </span> : null}
                  {area ? <span className={s.area}>{area}</span> : null}
                  {text}
                </p>
              </div>
            </div>
          );
        })}
        {newest.length > shown.length ? (
          <button type="button" className={s.more} onClick={() => setAll(true)}>
            Show {newest.length - shown.length} earlier
            <ChevronDown aria-hidden="true" strokeWidth={1.75} />
          </button>
        ) : null}
      </section>
      <p className={s.note}>The live site updates once a day, early in the morning.</p>
    </>
  );
}

/* ── Shortcuts, inside Help ─────────────────────────────────────────────────────────────────── */

/** "Shift+T" as two key caps. */
function Caps({ keys }: { keys: string }) {
  const parts = keys === "+" ? ["+"] : keys.split("+");
  return (
    <span className={s.keyCaps}>
      {parts.map((part) => (
        <kbd key={part}>{part}</kbd>
      ))}
    </span>
  );
}

/** KEYBOARD SHORTCUTS as a view inside Help: the keys this desk can use, in three groups. */
export function HelpKeys({ role, onBack }: { role: WardTourRole; onBack: () => void }) {
  const keys = shortcutsForDesk(role);
  return (
    <>
      <Button variant="ghost" icon={ArrowLeft} onClick={onBack} className={s.back}>
        Back to Help
      </Button>
      <h3 className={s.viewTitle}>Keyboard shortcuts</h3>
      {SHORTCUT_GROUPS.map((group) => {
        const rows = keys.filter((item) => item.group === group);
        if (!rows.length) return null;
        return (
          <section key={group} className={s.section} aria-label={group}>
            <h4 className={s.sectionHead}>{group}</h4>
            <div className={s.card}>
              {rows.map((item) => (
                <div key={item.keys} className={s.keyRow} title={item.action}>
                  <span>{item.short}</span>
                  <Caps keys={item.keys} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <p className={s.note}>On a Mac, use Cmd for Ctrl and Option for Alt. Settings can turn single keys off.</p>
    </>
  );
}

/* ── Your desk, inside Help ─────────────────────────────────────────────────────────────────── */

/** YOUR DESK: what this desk is for, where it starts, its main jobs and what it cannot do. */
export function HelpDesk({
  role,
  deskName,
  home,
  onBack,
  onClose,
  screenName,
}: {
  role: WardTourRole;
  deskName: string;
  home: string | undefined;
  onBack: () => void;
  onClose: () => void;
  screenName: (href: string) => string;
}) {
  const guide = DESK_GUIDES[role];
  return (
    <>
      <Button variant="ghost" icon={ArrowLeft} onClick={onBack} className={s.back}>
        Back to Help
      </Button>
      <div>
        <h3 className={s.viewTitle}>{deskName}</h3>
        <p className={s.herePurpose}>{guide.summary}</p>
      </div>
      <section className={s.section} aria-label="Where you start">
        <h4 className={s.sectionHead}>Where you start</h4>
        <p className={`${s.card} ${s.answerText} ${s.startsAt}`}>{guide.startsAt}</p>
      </section>
      <section className={s.section} aria-label="Jobs you do most">
        <h4 className={s.sectionHead}>Jobs you do most</h4>
        <ol className={`${s.card} ${s.jobs}`}>
          {guide.jobs.map((job) => {
            const href = job.go === "home" ? home : howToHref(job.go, role, home);
            return (
              <li key={job.job}>
                <div>
                  <b>{job.job}</b>
                  <span>{job.how}</span>
                  {href ? (
                    <Link href={href} onClick={onClose} className={`${buttonClass({ variant: "ghost" })} ${s.jobGo}`}>
                      Go to {screenName(href)}
                      <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      {(
        [
          ["Good to know", guide.limits],
          ["Is it saved?", SAVED_OR_NOT],
          ["If Ward Flow is down", WHEN_IT_IS_DOWN],
        ] as const
      ).map(([heading, points]) => (
        <section key={heading} className={s.section} aria-label={heading}>
          <h4 className={s.sectionHead}>{heading}</h4>
          <ul className={`${s.card} ${s.points}`}>
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
