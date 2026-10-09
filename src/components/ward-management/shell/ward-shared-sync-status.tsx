"use client";

import { type FormEvent, useId, useState } from "react";

import type { SharedNetwork } from "../shared/use-ward-flow-shared-sync";
import type { SharedSyncView } from "../shared/ward-flow-shared-sync";

import styles from "./ward-shared-sync-status.module.css";

/**
 * Feature 3's one piece of UI: a small status line saying whether this browser is on the shared
 * board. Rendered only in shared mode (`DATABASE_URL` set on the server), so the local prototype is
 * unchanged. When the server wants the access code, it carries a two-control form; nothing else.
 */

type Tone = "live" | "busy" | "warning";

function describe(view: SharedSyncView, network: SharedNetwork): { tone: Tone; text: string } {
  if (view.status === "joining") return { tone: "busy", text: "Joining the shared board…" };
  if (view.status === "locked") return { tone: "warning", text: "The shared board needs the access code." };
  if (view.status === "unavailable")
    return { tone: "warning", text: "Shared board unavailable. Changes stay on this device." };
  if (view.status === "detached") {
    if (view.detachedReason === "typed-text")
      return {
        tone: "warning",
        text: "Left the shared board: typed text is not shared. Changes stay on this device until you reload.",
      };
    if (view.detachedReason === "scenario-file")
      return {
        tone: "warning",
        text: "Left the shared board: a scenario file was loaded. Changes stay on this device until you reload.",
      };
    return { tone: "warning", text: "A newer version is running. Reload to rejoin the shared board." };
  }
  const changes = `${view.pendingCount} change${view.pendingCount === 1 ? "" : "s"}`;
  if (network === "offline")
    return {
      tone: "warning",
      text: view.pendingCount > 0 ? `Shared board offline. ${changes} waiting.` : "Shared board offline.",
    };
  if (view.notice === "refused-by-board")
    return { tone: "warning", text: "The shared board refused a change. The board was reloaded." };
  if (view.notice === "new-world") return { tone: "live", text: "Shared board reloaded." };
  if (view.pendingCount > 0) return { tone: "busy", text: `Sharing ${changes}…` };
  return { tone: "live", text: "Shared board" };
}

export function WardSharedSyncStatus({
  view,
  network,
  onSubmitCode,
  onRetry,
}: {
  view: SharedSyncView;
  network: SharedNetwork;
  onSubmitCode: (code: string) => Promise<string>;
  onRetry: () => void;
}) {
  const { tone, text } = describe(view, network);
  const [code, setCode] = useState("");
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    const result = await onSubmitCode(code.trim());
    setSubmitting(false);
    if (result === "ok") {
      setCode("");
      setCodeMessage(null);
    } else {
      setCodeMessage(
        result === "wrong-code" ? "That code was not accepted." : "The shared board could not be reached.",
      );
    }
  }

  return (
    <div className={styles.status} data-tone={tone} data-ward-shared-status={view.status}>
      <p className={styles.line} role="status">
        <span className={styles.dot} aria-hidden="true" />
        {text}
      </p>
      {view.status === "locked" ? (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label} htmlFor={inputId}>
            Access code
          </label>
          <input
            id={inputId}
            className={styles.input}
            type="password"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button className={styles.button} type="submit" disabled={submitting}>
            Join
          </button>
          {codeMessage ? (
            <p className={styles.message} role="alert">
              {codeMessage}
            </p>
          ) : null}
        </form>
      ) : null}
      {view.status === "unavailable" ? (
        <button className={styles.button} type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
