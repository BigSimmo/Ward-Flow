import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordFormSheet, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import {
  clearSessionDrafts,
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function LegalDraft({ save, close }: { save: () => Promise<boolean>; close: () => void }) {
  const [draft, onDraft] = useState<RecordDraft>({ form: "1A", movement: "" });
  return (
    <RecordFormSheet
      open
      onClose={close}
      draft={draft}
      onDraft={onDraft}
      openMovements={wardMovements}
      labelOf={(movement) => movement.id}
      now={NOW_ANCHOR}
      onSaveForm={save}
    />
  );
}

describe("legal save session ownership edge", () => {
  beforeEach(() => {
    clearSessionDrafts();
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    clearSessionDrafts();
    vi.useRealTimers();
  });
  it.each([true, false])(
    "releases saving after an old-session completion (%s) without clearing the new draft",
    async (accepted) => {
      let complete!: (accepted: boolean) => void;
      const save = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            complete = resolve;
          }),
      );
      const close = vi.fn();
      render(<LegalDraft save={save} close={close} />);
      fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
      fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Save form" }));
      expect(screen.getByLabelText("Time on form")).toBeDisabled();
      act(() => clearSessionDrafts());
      const nextKey = sessionDraftKey("standard/0", "legal-record", "new");
      writeSessionDraft(nextKey, "synthetic newer owner draft", draftSessionVersion());
      await act(async () => complete(accepted));
      expect(screen.getByLabelText("Time on form")).not.toBeDisabled();
      expect(screen.getByLabelText("Time on form")).toHaveValue("00:00");
      expect(readSessionDraft(nextKey)).toBe("synthetic newer owner draft");
      expect(close).not.toHaveBeenCalled();
    },
  );
  it("does not release a newer save when a cleared older request completes", async () => {
    const completions: Array<(accepted: boolean) => void> = [];
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          completions.push(resolve);
        }),
    );
    const close = vi.fn();
    render(<LegalDraft save={save} close={close} />);
    const fill = (time: string) => {
      fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
      fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: time } });
      fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    };
    fill("00:00");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fill("00:01");
    await act(async () => completions[0]!(true));
    expect(screen.getByLabelText("Time on form")).toBeDisabled();
    expect(screen.getByLabelText("Time on form")).toHaveValue("00:01");
    expect(close).not.toHaveBeenCalled();
    await act(async () => completions[1]!(false));
    expect(screen.getByLabelText("Time on form")).not.toBeDisabled();
    expect(screen.getByLabelText("Time on form")).toHaveValue("00:01");
  });
});
