"use client";

import { useEffect, useRef, useState } from "react";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import { wardCommandFailure } from "../ward/use-ward-command-completion";
import { DEFAULT_DRAFT } from "./ed-screen-model";
import type { useEdReferralDraft } from "./use-ed-screen-state";

type Attempt = {
  draft: ReturnType<typeof useEdReferralDraft>["draft"];
  referralId: string | undefined;
  world: number | undefined;
  outcome?: WardCommandOutcome;
  confirmed?: WardCommandOutcome;
  shared: boolean;
  before?: ReadonlySet<string>;
  scope?: string;
};

/** An accepted command confirms a raise; a newly visible movement alone never does. */
export function useEdReferralSave(draftState: ReturnType<typeof useEdReferralDraft>, scope?: string) {
  const snapshot = useOptionalWardFlowSelect("worldGeneration", "shared");
  const { draft, raisingFromReferralId, setDraft, setReferralOpen, setRaisingFromReferralId } = draftState;
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [message, setMessage] = useState<string>();
  const [accepted, setAccepted] = useState(0);
  const [acceptedLocalBefore, setAcceptedLocalBefore] = useState<ReadonlySet<string>>();
  const active = useRef<Attempt | null>(null);
  const latest = useRef({ draft, raisingFromReferralId });
  const world = useRef(snapshot?.worldGeneration);
  const scopeLifetime = useRef(scope);
  const mounted = useRef(true);
  useEffect(() => {
    latest.current = { draft, raisingFromReferralId };
  }, [draft, raisingFromReferralId]);
  useEffect(() => {
    world.current = snapshot?.worldGeneration;
  }, [snapshot?.worldGeneration]);
  useEffect(() => {
    scopeLifetime.current = scope;
  }, [scope]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function finish(started: Attempt, outcome: WardCommandOutcome) {
    if (!mounted.current || active.current !== started) return;
    if (
      world.current !== started.world ||
      scopeLifetime.current !== started.scope ||
      (outcome.isCurrent && !outcome.isCurrent())
    ) {
      active.current = null;
      setAttempt(null);
      setMessage(undefined);
      return;
    }
    if (outcome.status === "accepted") {
      active.current = null;
      setAttempt(null);
      setMessage(undefined);
      // A late answer belongs to the captured form, not a fresh draft opened meanwhile.
      if (latest.current.draft === started.draft && latest.current.raisingFromReferralId === started.referralId) {
        setDraft(DEFAULT_DRAFT);
        setReferralOpen(false);
        setRaisingFromReferralId(undefined);
      }
      setAcceptedLocalBefore(started.shared ? undefined : started.before);
      setAccepted((count) => count + 1);
    } else if (outcome.status === "failed" && outcome.commandId) {
      started.outcome = outcome;
      setAttempt({ ...started });
      setMessage(wardCommandFailure(outcome));
      // Scoped desks deliberately cannot read command history. This private channel belongs to
      // the original command and settles only when Retry or lifecycle cleanup is definitive.
      if (outcome.confirmation) {
        void outcome.confirmation.then(
          (confirmed) => {
            if (!mounted.current || active.current !== started || confirmed.commandId !== outcome.commandId) return;
            if (confirmed.status === "accepted") {
              started.confirmed = confirmed;
              setAttempt({ ...started });
            } else if (confirmed.status !== "failed") finish(started, confirmed);
          },
          () => {
            // Keep the existing unconfirmed warning and draft if the confirmation channel fails.
          },
        );
      }
    } else {
      active.current = null;
      setAttempt(null);
      setMessage(wardCommandFailure(outcome));
    }
  }

  useEffect(() => {
    const started = active.current;
    if (!started) return;
    if (
      started.world !== snapshot?.worldGeneration ||
      started.scope !== scope ||
      (started.outcome?.isCurrent && !started.outcome.isCurrent())
    ) {
      active.current = null;
      // The external workspace ended this save's lifetime.
      setAttempt(null);
      setMessage(undefined);
      return;
    }
    if (started.confirmed && (!snapshot?.shared?.enabled || snapshot.shared.status === "ready")) {
      finish(started, started.confirmed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish uses this render's setters; terminal/lifetime/adoption changes drive reconciliation.
  }, [attempt, scope, snapshot?.worldGeneration, snapshot?.shared?.enabled, snapshot?.shared?.status]);

  function saveReferral(record: () => ReturnType<WardCommandDispatch>, _now: number, before?: ReadonlySet<string>) {
    if (active.current || (snapshot?.shared?.enabled && snapshot.shared.status !== "ready")) return false;
    const started: Attempt = {
      draft,
      referralId: raisingFromReferralId,
      world: snapshot?.worldGeneration,
      shared: snapshot?.shared?.enabled === true,
      before,
      scope,
    };
    active.current = started;
    setAttempt(started);
    setMessage("Saving referral…");
    try {
      const completion = record();
      if (completion && "then" in completion) {
        void completion.then(
          (outcome) => finish(started, outcome),
          () => finish(started, { commandId: "", status: "failed" }),
        );
      } else if (completion) finish(started, completion);
      else finish(started, { commandId: "", status: "failed" });
    } catch {
      finish(started, { commandId: "", status: "failed" });
    }
    return true;
  }
  return {
    saveReferral,
    referralSaveMessage: message,
    accepted,
    acceptedLocalBefore,
    referralFieldsDisabled:
      attempt !== null || Boolean(snapshot?.shared?.enabled && snapshot.shared.status !== "ready"),
  };
}
