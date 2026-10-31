import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithToasts as render } from "./helpers/with-toasts";

import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import { BoardToastView } from "@/components/ward-management/board/ward-board-toast";
import { useWardPageToast, WardPageActionToast } from "@/components/ward-management/ward/ward-page-action-toast";

// Notifications pass (30 Oct 2026): the board and ward page toasts moved to the shared toast region.
// Their old components stay as thin wrappers for screens that still use them; each now shows its
// outcome in the shared region, with the same test id as before. Synthetic text only.
describe("kept toast wrappers show their outcome in the shared region", () => {
  it("BoardToastView shows a refusal with the warning tone", () => {
    const { rerender } = render(<BoardToastView toast={null} />);
    expect(screen.queryByTestId("ward-board-toast")).toBeNull();
    rerender(<BoardToastView toast={{ warning: "Not recorded: no bed. Nothing was changed." }} />);
    const toast = screen.getByTestId("ward-board-toast");
    expect(toast).toHaveAttribute("data-tone", "warning");
    expect(screen.getByTestId("toast-region")).toContainElement(toast);
  });

  it("useWardPageToast and WardPageActionToast show a recorded step that closes itself", () => {
    function Page({ say }: { say: ActionToast }) {
      const [toast, setToast] = useWardPageToast();
      return (
        <>
          <button type="button" onClick={() => setToast(say)}>
            Record
          </button>
          <WardPageActionToast toast={toast} onClose={() => setToast(null)} />
        </>
      );
    }
    render(<Page say="Synthetic step recorded." />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    const toast = screen.getByTestId("ward-action-toast");
    expect(toast).toHaveTextContent("Synthetic step recorded.");
    expect(toast).toHaveAttribute("data-auto-dismiss", "true");
    expect(screen.getAllByTestId("ward-action-toast")).toHaveLength(1);
  });

  it("WardPageActionToast shows a value a screen keeps in its own state", () => {
    render(<WardPageActionToast toast={{ warning: "Not recorded: synthetic refusal." }} />);
    expect(screen.getByTestId("ward-action-toast")).toHaveAttribute("data-tone", "warning");
  });
});
