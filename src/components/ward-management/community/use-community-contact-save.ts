"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WardFlowContextValue } from "../ward-flow-provider";
import type { Instant } from "../ward-clock";
import type { WardCommandOutcome } from "../ward-shared-client";
import { confirmedWardCommand } from "../ward-command-completion";
import { wardCommandFailure, WARD_STILL_SAVING } from "../ward/use-ward-command-completion";

type Source = "modal" | "quick";
type ContactRecord = { role: "community"; at: Instant; teamId: string };
type Attempt = {
  record: ContactRecord;
  source: Source;
  generation: number;
  sequence: number;
  outcome?: WardCommandOutcome;
};

type Options = Pick<WardFlowContextValue, "dispatch" | "shared" | "eventLog"> & {
  now: Instant;
  teamId: string;
  generation: number;
  onAccepted: (source: Source) => void;
  onQuickMessage: (message: string) => void;
};

/** A contact is recorded only by this command's answer, including its original-ID Retry. */
export function useCommunityContactSave(options: Options) {
  const { dispatch, now, teamId, generation, shared, eventLog } = options;
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  }, [options]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const active = useRef<Attempt | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [recorded, setRecorded] = useState<{ record: ContactRecord; generation: number } | null>(null);
  const [contactSaveMessage, setMessage] = useState<string>();

  const current = useCallback((started: Attempt) => {
    return (
      mounted.current &&
      active.current === started &&
      latest.current.teamId === started.record.teamId &&
      latest.current.generation === started.generation
    );
  }, []);
  const release = useCallback(() => {
    active.current = null;
    setAttempt(null);
  }, []);
  const say = useCallback((started: Attempt, message: string | undefined) => {
    setMessage(message);
    if (message && started.source === "quick") latest.current.onQuickMessage(message);
  }, []);
  const accept = useCallback(
    (started: Attempt) => {
      if (!current(started)) return;
      setRecorded({ record: started.record, generation: started.generation });
      release();
      setMessage(undefined);
      latest.current.onAccepted(started.source);
    },
    [current, release],
  );

  useEffect(() => {
    if (!attempt) return;
    if (
      attempt.generation !== generation ||
      attempt.record.teamId !== teamId ||
      (attempt.outcome?.isCurrent && !attempt.outcome.isCurrent()) ||
      (shared?.enabled && !["ready", "saving", "unavailable"].includes(shared.status))
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The external workspace ended this form's save lifetime.
      release();
      setMessage("The workspace changed. Review this team before recording contact.");
      return;
    }
    if (attempt.outcome?.status !== "failed" || shared?.status !== "ready") return;
    // This log contains this tab's command replies, not contacts found in a polled snapshot.
    // No team/time guess from another desk can turn an unconfirmed save into success.
    const commandId = attempt.outcome.commandId;
    const receipt = eventLog?.find(
      (entry) => entry.sequence > attempt.sequence && Reflect.get(entry, "commandId") === commandId && commandId !== "",
    );
    if (receipt && !receipt.accepted) {
      release();
      say(attempt, shared.error ?? "Contact was not recorded. Review this team and try again.");
    } else if (receipt?.accepted) accept(attempt);
  }, [attempt, generation, teamId, shared?.enabled, shared?.status, shared?.error, eventLog, release, say, accept]);

  function saveContact(source: Source) {
    if (active.current || (shared?.enabled && shared.status !== "ready")) {
      const message =
        active.current?.outcome?.status === "failed"
          ? "Save is not confirmed. Use Retry before recording another contact."
          : WARD_STILL_SAVING;
      setMessage(message);
      if (source === "quick") latest.current.onQuickMessage(message);
      return;
    }
    const started: Attempt = {
      record: { role: "community", at: now, teamId },
      source,
      generation,
      sequence: eventLog?.at(-1)?.sequence ?? -1,
    };
    active.current = started; // Synchronous: a second click cannot enqueue another command.
    setAttempt(started);
    say(started, "Saving contact…");
    const finish = (outcome: WardCommandOutcome) => {
      if (!current(started)) return;
      if (outcome.isCurrent && !outcome.isCurrent()) {
        release();
        say(started, "The workspace changed. Review this team before recording contact.");
        return;
      }
      if (outcome.status === "accepted") {
        accept(started);
        return;
      }
      say(started, wardCommandFailure(outcome));
      if (outcome.status === "failed" && outcome.commandId && latest.current.shared?.enabled) {
        const failed = { ...started, outcome };
        active.current = failed;
        setAttempt(failed);
      } else release();
    };
    const failed = () => finish({ commandId: "", status: "failed" });
    try {
      const completion = confirmedWardCommand(
        dispatch({ type: "RECORD_CLINICAL_CONTACT", role: "community", now, teamId }),
      );
      if ("then" in completion) void completion.then(finish, failed);
      else finish(completion);
    } catch {
      failed();
    }
  }

  return {
    contactRecord: recorded?.generation === generation && recorded.record.teamId === teamId ? recorded.record : null,
    contactSaveMessage,
    contactSaveDisabled: attempt !== null || (shared?.enabled === true && shared.status !== "ready"),
    saveContact,
  };
}
