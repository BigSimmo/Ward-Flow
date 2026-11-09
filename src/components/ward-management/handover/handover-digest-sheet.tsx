"use client";

import { useId, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCopy } from "lucide-react";

import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { Button, Icon, Sheet, StatusGlyph, useOptionalToast } from "@/components/wf";

import {
  buildHandoverDigest,
  handoverDigestText,
  type HandoverDigestInput,
  type HandoverDigestAction,
  type HandoverDigestLine,
} from "./handover-digest-model";
import styles from "./handover-digest-sheet.module.css";

/**
 * The Shift digest sheet (feature 15): three short groups read in half a minute at shift change,
 * each line linking to where to act. Loaded on demand from `handover-page.tsx`, so the Handover
 * page's first load does not carry it. A bottom sheet on a phone.
 */
export function HandoverDigestSheet({
  open,
  input,
  onClose,
  onAction,
}: {
  open: boolean;
  /** The hero's own figures; the digest is built here so the page's first load does not carry it. */
  input: HandoverDigestInput;
  onClose: () => void;
  /** Pills, replies and patients act on the page; promises are plain links to their referral. */
  onAction: (action: HandoverDigestAction) => void;
}) {
  const baseId = useId();
  const digest = useMemo(() => buildHandoverDigest(input), [input]);
  const toast = useOptionalToast();
  const copy = () => {
    void copyTextToClipboard(handoverDigestText(digest)).then(
      () => {
        const title = "Digest copied. No patient names included.";
        if (toast) toast.push({ tone: "success", title });
        else announceToWardShell(title);
      },
      () => {
        const title = "Copy was blocked by the browser.";
        if (toast) toast.push({ tone: "warning", title });
        else announceToWardShell(title);
      },
    );
  };

  const lines = (items: readonly HandoverDigestLine[], testId: string) =>
    items.length === 0 ? (
      <p className={styles.none}>None</p>
    ) : (
      <ul className={styles.list} data-testid={testId}>
        {items.map((line) => {
          const body = (
            <>
              <span className={styles.figure}>
                {line.tone === "danger" || line.tone === "warning" ? <StatusGlyph tone={line.tone} size={8} /> : null}
                {line.value === null ? null : <b className={styles.num}>{line.value}</b>}
              </span>
              <span className={styles.text}>
                {line.value === null ? <LongestText text={line.text} /> : line.text}
                {line.detail ? <span className={styles.detail}>{line.detail}</span> : null}
              </span>
              {line.action ? (
                <span className={styles.go}>
                  {line.action.kind === "replies" ? "Show replies" : line.action.kind === "patient" ? "Open" : "Show"}
                  <Icon icon={ChevronRight} size={14} />
                </span>
              ) : null}
            </>
          );
          const action = line.action;
          return (
            <li key={line.id} data-testid={`ward-handover-digest-${line.id}`}>
              {action ? (
                <button type="button" className={styles.row} onClick={() => onAction(action)}>
                  {body}
                </button>
              ) : (
                <div className={styles.row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Shift digest"
      description={`${digest.shiftLabel}, ${digest.shiftClock} · ${digest.scopeLabel}`}
      testId="ward-handover-digest"
      footer={
        <Button variant="pri" icon={ClipboardCopy} onClick={copy} data-testid="ward-handover-digest-copy">
          Copy digest
        </Button>
      }
    >
      <div className={styles.digest}>
        <section aria-labelledby={`${baseId}-changed`}>
          <h3 id={`${baseId}-changed`} className={styles.head}>
            What changed since <span className={styles.clock}>{digest.sinceClock}</span>
          </h3>
          {lines(digest.changed, "ward-handover-digest-changed")}
        </section>
        <section aria-labelledby={`${baseId}-pending`}>
          <h3 id={`${baseId}-pending`} className={styles.head}>
            Still pending
          </h3>
          {lines(digest.pending, "ward-handover-digest-pending")}
        </section>
        <section aria-labelledby={`${baseId}-promises`}>
          <h3 id={`${baseId}-promises`} className={styles.head}>
            Promises due by <span className={styles.clock}>{digest.dueClock}</span>
          </h3>
          {digest.promises.length === 0 ? (
            <p className={styles.none}>None</p>
          ) : (
            <ul className={styles.list} data-testid="ward-handover-digest-promises">
              {digest.promises.map((promise) => (
                <li key={promise.id}>
                  <Link href={referralBoardHref(promise.referralId)} className={styles.row} onClick={onClose}>
                    <span className={styles.figure}>
                      {promise.overdue ? <StatusGlyph tone="danger" size={8} /> : null}
                      <b className={styles.num}>{promise.when}</b>
                    </span>
                    <span className={styles.text}>
                      {promise.what}
                      {promise.overdue ? <span className={styles.overdue}>Overdue</span> : null}
                    </span>
                    <span className={styles.go}>
                      Open
                      <Icon icon={ChevronRight} size={14} />
                    </span>
                  </Link>
                </li>
              ))}
              {digest.promisesMore > 0 ? (
                <li className={styles.more}>
                  <button type="button" className={styles.moreButton} onClick={() => onAction({ kind: "replies" })}>
                    and {digest.promisesMore} more
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </section>
        <p className={styles.note}>Copied text leaves out patient names and record numbers.</p>
      </div>
    </Sheet>
  );
}

/** "Longest wait 7d 1h": the wait set in mono. */
function LongestText({ text }: { text: string }) {
  const match = /^(Longest wait) (.+)$/.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      {match[1]} <b className={styles.num}>{match[2]}</b>
    </>
  );
}
