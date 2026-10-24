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
  sequence: number;
  now: number;
  outcome?: WardCommandOutcome;
  local?: boolean;
  shared: boolean;
  before?: ReadonlySet<string>;
};

/** An accepted command confirms a raise; a newly visible movement alone never does. */
export function useEdReferralSave(draftState: ReturnType<typeof useEdReferralDraft>) {
  const snapshot = useOptionalWardFlowSelect("worldGeneration", "shared", "eventLog");
  const { draft, raisingFromReferralId, setDraft, setReferralOpen, setRaisingFromReferralId } = draftState;
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [message, setMessage] = useState<string>();
  const [accepted, setAccepted] = useState(0);
  const [acceptedLocalBefore, setAcceptedLocalBefore] = useState<ReadonlySet<string>>();
  const active = useRef<Attempt | null>(null);
  const latest = useRef({ draft, raisingFromReferralId });
  const world = useRef(snapshot?.worldGeneration);
  const mounted = useRef(true);
  useEffect(() => {
    latest.current = { draft, raisingFromReferralId };
  }, [draft, raisingFromReferralId]);
  useEffect(() => {
    world.current = snapshot?.worldGeneration;
  }, [snapshot?.worldGeneration]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function finish(started: Attempt, outcome: WardCommandOutcome) {
    if (!mounted.current || active.current !== started) return;
    if (world.current !== started.world || (outcome.isCurrent && !outcome.isCurrent())) {
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
    } else {
      active.current = null;
      setAttempt(null);
      setMessage(wardCommandFailure(outcome));
    }
  }

  useEffect(() => {
    const started = active.current;
    if (!started) return;
    if (started.world !== snapshot?.worldGeneration || (started.outcome?.isCurrent && !started.outcome.isCurrent())) {
      active.current = null;
      // The external workspace ended this save's lifetime.
      setAttempt(null);
      setMessage(undefined);
      return;
    }
    const receipt = snapshot?.eventLog?.find(
      (entry) =>
        entry.sequence > started.sequence &&
        entry.type === "RAISE_REFERRAL" &&
        entry.role === "ed" &&
        entry.now === started.now &&
        (started.local ||
          (started.outcome?.commandId && Reflect.get(entry, "commandId") === started.outcome.commandId)),
    );
    if (!receipt) return;
    if (receipt.accepted && snapshot?.shared?.enabled && snapshot.shared.status !== "ready") return;
    finish(started, {
      commandId: started.outcome?.commandId ?? "",
      status: receipt.accepted ? "accepted" : "refused",
      message: receipt.accepted
        ? undefined
        : (snapshot?.shared?.error ?? "The referral was not raised. Review the details before trying again."),
      isCurrent: started.outcome?.isCurrent,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish uses this render's setters; receipt/world changes drive reconciliation.
  }, [
    attempt,
    snapshot?.worldGeneration,
    snapshot?.eventLog,
    snapshot?.shared?.enabled,
    snapshot?.shared?.status,
    snapshot?.shared?.error,
  ]);

  function saveReferral(record: () => ReturnType<WardCommandDispatch>, now: number, before?: ReadonlySet<string>) {
    if (active.current || (snapshot?.shared?.enabled && snapshot.shared.status !== "ready")) return false;
    const started: Attempt = {
      draft,
      referralId: raisingFromReferralId,
      world: snapshot?.worldGeneration,
      sequence: snapshot?.eventLog?.at(-1)?.sequence ?? -1,
      now,
      shared: snapshot?.shared?.enabled === true,
      before,
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
      else {
        started.local = true;
        setAttempt({ ...started });
      }
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
