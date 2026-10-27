"use client";

import { useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";

import { FrontDoor, FrontDoorStatus, publicDemoUrl } from "./front-door";
import { Arrow, DoorBanner, DoorScreen, SessionNote, Spinner } from "./front-door-parts";
import { useFrontDoorAuth } from "./use-front-door-auth";
import styles from "./front-door.module.css";

/**
 * The /sign-in page, reached only when the front door is switched on. The signed-in site signs in
 * with an account; the public demo opens with a demo code. Either way the page then opens `next`,
 * which the server has already checked is a Ward Flow address.
 */
export function FrontDoorPage({ next, mode, tv }: { next: string; mode: "account" | "demo-code"; tv: boolean }) {
  return mode === "demo-code" ? <DemoCodeDoor next={next} /> : <AccountDoor next={next} tv={tv} />;
}

function AccountDoor({ next, tv }: { next: string; tv: boolean }) {
  const { phase, form } = useFrontDoorAuth(next);
  if (phase !== "ready")
    return (
      <FrontDoorStatus
        title="Opening Ward Flow"
        status={phase === "checking" ? "Checking your sign-in." : "Signed in. Opening your home page."}
      />
    );
  return <FrontDoor form={form} tv={tv} demoUrl={tv ? null : publicDemoUrl()} />;
}

function DemoCodeDoor({ next }: { next: string }) {
  const uid = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ title: string; body: string } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  return (
    <DoorScreen label="Ward Flow demo" note={problem !== null} focusTarget={codeRef}>
      <div className={styles.card}>
        <form
          className={styles.form}
          aria-busy={busy || undefined}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setProblem(null);
            const response = await fetch("/api/session", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ demoCode: code }),
            }).catch(() => null);
            if (response?.ok) {
              window.location.replace(next);
              return;
            }
            const said = (await response?.json().catch(() => null)) as { error?: unknown } | null;
            setBusy(false);
            setProblem(
              response?.status === 401
                ? { title: "That demo code is not right.", body: "Check it and try again." }
                : {
                    title: response ? "The demo did not open." : "No connection.",
                    body:
                      typeof said?.error === "string"
                        ? said.error
                        : "Check your connection, then try again in a moment.",
                  },
            );
          }}
        >
          <span className={styles.demoBadge}>
            <i aria-hidden="true" />
            Public demo
          </span>
          <header className={styles.cardHead}>
            <h1>Explore the demo</h1>
            <p>Enter the demo code you were given. The demo runs on made-up records across the network.</p>
          </header>
          {problem && <DoorBanner tone="danger" icon="alert" title={problem.title} body={problem.body} />}
          <div className={styles.field}>
            <label htmlFor={`${uid}-code`}>Demo code</label>
            <div className={styles.inwrap}>
              <span className={styles.lead}>
                <KeyRound aria-hidden="true" />
              </span>
              <input
                ref={codeRef}
                className={`${styles.input} ${styles.mono}`}
                id={`${uid}-code`}
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                maxLength={64}
                disabled={busy}
                aria-invalid={problem !== null || undefined}
              />
            </div>
          </div>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
            {busy ? (
              <>
                <Spinner />
                Opening…
              </>
            ) : (
              <>
                Open the demo
                <Arrow />
              </>
            )}
          </button>
          <SessionNote>A code opens the demo in this browser for 8 hours. Changes reset when you reload.</SessionNote>
        </form>
      </div>
    </DoorScreen>
  );
}
