/** @vitest-environment jsdom */

import { useEffect, useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModalFocus } from "@/components/wf/use-modal-focus";
import { PhoneSheet } from "@/components/wf/phone";
import { OverlayPortal, OverlayRoot } from "@/components/wf/overlay-root";
import { commandSheetHandles, holdOpenForm, openSheetHandles } from "@/components/wf/sheet-focus";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

function Guide({ target, onClose }: { target: HTMLElement | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { rootRef } = useModalFocus({ open: true, onClose, panelRef, interactionRoots: [target] });
  return (
    <OverlayPortal layer="modal" name="Guide">
      <div ref={rootRef}>
        <div role="dialog" aria-label="Guide" ref={panelRef}>
          <button type="button">Guide start</button>
          <button type="button">Guide end</button>
        </div>
      </div>
    </OverlayPortal>
  );
}

function Harness() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [guide, setGuide] = useState(false);
  const [child, setChild] = useState(false);
  return (
    <>
      <OverlayRoot />
      <button type="button" onClick={() => setGuide(true)}>
        Open guide
      </button>
      <section aria-label="Work area">
        <button ref={setTarget} type="button" onClick={() => setChild(true)}>
          Highlighted action
        </button>
        <button type="button">Unrelated action</button>
      </section>
      {guide ? <Guide target={target} onClose={() => setGuide(false)} /> : null}
      <PhoneSheet open={child} title="Child action" onClose={() => setChild(false)}>
        <button type="button">Child control</button>
      </PhoneSheet>
    </>
  );
}

describe("guided interaction boundaries", () => {
  it("treats highlighted forms as part of the guide when holding forms and checking command scopes", () => {
    function GuidedForm() {
      const [target, setTarget] = useState<HTMLElement | null>(null);
      useEffect(() => holdOpenForm("other-work"), []);
      return (
        <>
          <form ref={setTarget} data-held-form="current-work">
            <label>
              Highlighted field
              <input />
            </label>
            <button type="button">Highlighted command</button>
          </form>
          <Guide target={target} onClose={() => {}} />
        </>
      );
    }
    render(<GuidedForm />);
    expect(openSheetHandles()).toHaveLength(2);
    screen.getByRole("textbox", { name: "Highlighted field" }).focus();
    expect(openSheetHandles()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Highlighted command" }));
    expect(commandSheetHandles()).toHaveLength(2);
  });

  it("retargets below a child modal without changing stack priority, including target ancestors in another portal", () => {
    const onClose = vi.fn();
    function RetargetingGuide() {
      const [first, setFirst] = useState<HTMLElement | null>(null);
      const [second, setSecond] = useState<HTMLElement | null>(null);
      const [useSecond, setUseSecond] = useState(false);
      const [child, setChild] = useState(false);
      return (
        <>
          <OverlayRoot />
          <OverlayPortal layer="modal" name="Work panel">
            <div>
              <button
                ref={setFirst}
                type="button"
                onClick={() => {
                  setChild(true);
                  setUseSecond(true);
                }}
              >
                First target
              </button>
              <button ref={setSecond} type="button">
                Second target
              </button>
              <button type="button">Portal sibling</button>
            </div>
          </OverlayPortal>
          <Guide target={useSecond ? second : first} onClose={onClose} />
          <PhoneSheet open={child} title="Nested action" onClose={() => setChild(false)}>
            <p>Nested contents</p>
          </PhoneSheet>
        </>
      );
    }
    render(<RetargetingGuide />);
    const first = screen.getByRole("button", { name: "First target", hidden: true });
    const second = screen.getByRole("button", { name: "Second target", hidden: true });
    expect(first.closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Portal sibling", hidden: true }).closest("[inert]")).not.toBeNull();
    fireEvent.click(first);
    expect(second.closest("[inert]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Nested action" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(first.closest("[inert]")).not.toBeNull();
    expect(second.closest("[inert]")).toBeNull();
  });

  it("keeps only the highlighted subtree available and includes a target button in both Tab directions", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open guide" }));
    const target = screen.getByRole("button", { name: "Highlighted action", hidden: true });
    expect(target.closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Unrelated action", hidden: true }).closest("[inert]")).not.toBeNull();
    screen.getByRole("button", { name: "Guide end" }).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(target).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Guide start" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(target).toHaveFocus();
  });

  it("lets a child modal own inertness and Escape then restores the highlighted opener", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open guide" }));
    const target = screen.getByRole("button", { name: "Highlighted action", hidden: true });
    target.focus();
    fireEvent.click(target);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    expect(target.closest("[inert]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Child action" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Guide" })).toBeInTheDocument();
    expect(target.closest("[inert]")).toBeNull();
    expect(target).toHaveFocus();
  });
});

it("offers a named keyboard scroll region only when a PhoneSheet opts in", () => {
  const { rerender } = render(
    <PhoneSheet open title="Figures" onClose={() => {}} bodyScrollLabel="More figures">
      <p>Figures</p>
    </PhoneSheet>,
  );
  const region = screen.getByRole("region", { name: "More figures" });
  expect(region).toHaveAttribute("tabindex", "0");
  screen.getByRole("button", { name: "Close" }).focus();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(region).toHaveFocus();
  rerender(
    <PhoneSheet open title="Figures" onClose={() => {}}>
      <p>Figures</p>
    </PhoneSheet>,
  );
  expect(screen.queryByRole("region")).toBeNull();
  expect(document.querySelector("[data-phone-sheet-body]")).not.toHaveAttribute("tabindex");
});
