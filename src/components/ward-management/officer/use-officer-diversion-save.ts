"use client";

import { useState, type SetStateAction } from "react";
import { useWardShellPublic } from "../shell/ward-shell-public-context";
import { useDirtyStateGuard } from "../use-dirty-state-guard";
import { useHoldOpenForm } from "../use-hold-open-form";
import { useWardFormSave } from "../use-ward-form-save";
import type { DiversionReason, TransportWhereabouts } from "../ward-change-reasons";
import type { WardRaise } from "../ward-flow-raise";
import type { Movement } from "../ward-model";

type Draft = { open: boolean; reason?: DiversionReason; place?: TransportWhereabouts };

/** Diversion answers and completion belong to this booking and this workspace opening. */
export function useOfficerDiversionSave(
  movement: Movement | undefined,
  raise: WardRaise,
  onRecorded: (movement: Movement) => void,
) {
  const lifetime = useWardShellPublic()?.accessLifetime;
  const scope = JSON.stringify([lifetime, movement?.id, movement?.transport?.id]);
  const [view, setView] = useState<{ scope: string; draft: Draft }>(() => ({ scope, draft: { open: false } }));
  const draft: Draft = view.scope === scope ? view.draft : { open: false };
  const save = useWardFormSave(`diversion:${scope}`);
  useHoldOpenForm(draft.open);
  useDirtyStateGuard({
    isDirty: save.pending || (draft.open && (draft.reason !== undefined || draft.place !== undefined)),
    value: JSON.stringify([scope, draft]),
    confirmMessage: "The diversion has unsaved answers. Leave without recording them?",
  });
  function set<K extends keyof Draft>(field: K, next: SetStateAction<Draft[K]>) {
    setView((current) => {
      const before: Draft = current.scope === scope ? current.draft : { open: false };
      const value = typeof next === "function" ? (next as (value: Draft[K]) => Draft[K])(before[field]) : next;
      return { scope, draft: { ...before, [field]: value } };
    });
  }
  function cancelDiversion() {
    save.forget();
    setView({ scope, draft: { open: false } });
  }
  return {
    diversionOpen: draft.open,
    diversionReason: draft.reason,
    diversionPlace: draft.place,
    diversionPending: save.pending,
    diversionError: save.error,
    setDiversionOpen: (next: SetStateAction<boolean>) => set("open", next),
    setDiversionReason: (next: SetStateAction<DiversionReason | undefined>) => set("reason", next),
    setDiversionPlace: (next: SetStateAction<TransportWhereabouts | undefined>) => set("place", next),
    toggleDiversion: () => {
      save.forget();
      set("open", !draft.open);
    },
    cancelDiversion,
    recordDiversion: (subject: Movement) => {
      if (
        !draft.reason ||
        !draft.place ||
        subject.id !== movement?.id ||
        subject.transport?.id !== movement?.transport?.id
      )
        return;
      save.submit(
        () =>
          raise("RECORD_DIVERSION", {
            movementId: subject.id,
            reason: draft.reason!,
            place: draft.place!,
          }),
        () => {
          cancelDiversion();
          onRecorded(subject);
        },
      );
    },
  };
}
