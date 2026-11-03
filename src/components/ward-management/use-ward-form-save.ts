"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";
import { wardCommandFailure } from "./ward/use-ward-command-completion";
import { SAVE_NOT_CONFIRMED } from "./ward-save-failure";
import { useWardShellPublic } from "./shell/ward-shell-public-context";

export type WardFormSave = ReturnType<typeof useWardFormSave>;
type Flight = { key: string; scope: object; generation: number };
type Held = Flight & { outcome: WardCommandOutcome };

/** A draft clears only after its own command accepts; uncertain commands retain their identity. */
export function useWardFormSave(scope: string) {
  const accessLifetime = useWardShellPublic()?.accessLifetime;
  // The stable key owns a command even if its form closes and returns to this same subject.
  // The visit token separately prevents that old command from clearing the newly opened draft.
  const key = JSON.stringify([scope, accessLifetime]);
  const scopeToken = useMemo(() => ({ id: scope, lifetime: accessLifetime }), [scope, accessLifetime]);
  const currentScope = useRef<object | null>(scopeToken);
  const lastLifetime = useRef(accessLifetime);
  const flights = useRef(new Map<string, Flight>());
  const held = useRef(new Map<string, Held>());
  const generation = useRef(0);
  const [view, setView] = useState<{ flights: ReadonlyMap<string, Flight>; held: ReadonlyMap<string, Held> }>(() => ({
    flights: new Map(),
    held: new Map(),
  }));
  const [error, setError] = useState<{ scope: object; message: string }>();
  useLayoutEffect(() => {
    currentScope.current = scopeToken;
    if (lastLifetime.current !== accessLifetime) {
      lastLifetime.current = accessLifetime;
      flights.current.clear();
      held.current.clear();
    }
    return () => {
      currentScope.current = null;
    };
  }, [scopeToken, accessLifetime]);
  const publish = () => {
    if (currentScope.current) setView({ flights: new Map(flights.current), held: new Map(held.current) });
  };
  const holding = (entry: Held | undefined) => entry !== undefined && entry.outcome.isCurrent?.() !== false;
  function submit(record: () => ReturnType<WardCommandDispatch> | undefined, onAccepted: () => void) {
    if (flights.current.has(key) || holding(held.current.get(key))) return;
    const flight: Flight = { key, scope: scopeToken, generation: generation.current };
    flights.current.set(key, flight);
    held.current.delete(key);
    setError(undefined);
    publish();
    const answer = (outcome?: WardCommandOutcome | void) => {
      if (currentScope.current !== flight.scope || generation.current !== flight.generation) return;
      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) {
        setError(undefined);
        onAccepted();
      } else
        setError({
          scope: flight.scope,
          message:
            (outcome?.status === "accepted" ? undefined : wardCommandFailure(outcome || undefined)) ??
            SAVE_NOT_CONFIRMED,
        });
    };
    const finish = (outcome?: WardCommandOutcome | void) => {
      if (flights.current.get(key) !== flight) return;
      flights.current.delete(key);
      answer(outcome);
      if (outcome?.status === "failed" && outcome.confirmation) {
        const entry: Held = { ...flight, outcome };
        held.current.set(key, entry);
        void outcome.confirmation.then(
          (confirmed) => {
            if (held.current.get(key) !== entry || confirmed.commandId !== outcome.commandId) return;
            held.current.delete(key);
            answer(confirmed);
            publish();
          },
          () => {
            if (held.current.get(key) === entry) {
              held.current.delete(key);
              publish();
            }
          },
        );
      }
      publish();
    };
    try {
      const completion = record();
      if (completion && "then" in completion) void completion.then(finish, () => finish());
      else finish(completion);
    } catch {
      finish();
    }
  }
  const awaiting = view.held.get(key);
  return {
    pending: view.flights.has(key) || holding(awaiting),
    error: error?.scope === scopeToken ? error.message : holding(awaiting) ? SAVE_NOT_CONFIRMED : undefined,
    clearError: () => setError(undefined),
    forget: () => {
      generation.current += 1;
      setError(undefined);
    },
    submit,
  };
}
