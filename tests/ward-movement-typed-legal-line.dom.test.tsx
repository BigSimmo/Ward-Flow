import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { MovementDrawer } from "@/components/ward-management/movements/movement-drawer";
import { StageRow } from "@/components/ward-management/movements/movements-stage-row";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { ED_ACCESS_TARGET_MINUTES, type LegalForm, type Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

// Legal times only as typed (D-93, Josh 31 Oct 2026): the Movements row and pop-up show the typed
// time in words with the standing word from the user's warning settings, a glyph for the colour and
// the "(limits not legally checked)" tag. Never a countdown. Synthetic seed data only.

afterEach(cleanup);

const { urgentMinutes, soonMinutes } = DEFAULT_DUE_SOON_THRESHOLDS;

function withForm(legalForm: LegalForm): Movement {
  const base = seedWardFlowState().movements[0];
  return { ...base, legalStatus: "Involuntary inpatient", legalForm, closure: undefined, blocker: "" };
}

function renderRow(movement: Movement) {
  const state = seedWardFlowState();
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ul>
        <StageRow
          movement={movement}
          now={NOW_ANCHOR}
          units={state.units}
          accessTargetMinutes={ED_ACCESS_TARGET_MINUTES}
          reveal={null}
          consumeReveal={() => false}
          onOpenDetail={() => {}}
          onFocusMovement={() => {}}
          marked={false}
          selected={false}
        />
      </ul>
    </WardFlowProvider>,
  );
  const title = legalFormName(movement.legalForm!);
  // Movements redesign (1 Nov 2026): legal status has its own column, titled with the full form
  // name; the typed time is the line under the short status.
  const cell = [...view.container.querySelectorAll<HTMLElement>("[title]")].find(
    (el) => el.getAttribute("title") === title,
  );
  const line = cell?.children[1] as HTMLElement | undefined;
  if (!line) throw new Error("legal line not found");
  return line;
}

describe("Movements row legal line, as typed", () => {
  it("shows a near typed time with its standing word, a danger glyph first and the tag after", () => {
    const line = renderRow(withForm({ code: "3B", kind: "detention", dueAt: NOW_ANCHOR + urgentMinutes / 2 }));
    expect(line.textContent).toMatch(/^ends \S+ as typed · within \S+/u);
    expect(line.firstElementChild).toHaveAttribute("data-wf-glyph", "danger");
    expect(line.querySelector('[data-testid="legal-limits-not-checked"]')).toBeInTheDocument();
    expect(line.textContent).not.toMatch(/ - |left|ago|overdue/u);
  });

  it("uses a warning glyph inside the second warning window", () => {
    const line = renderRow(
      withForm({ code: "3B", kind: "detention", dueAt: NOW_ANCHOR + Math.round((urgentMinutes + soonMinutes) / 2) }),
    );
    expect(line.firstElementChild).toHaveAttribute("data-wf-glyph", "warning");
    expect(line).toHaveAttribute("data-tone", "warn");
  });

  it("says ended, as typed, once the typed time has gone by", () => {
    const line = renderRow(withForm({ code: "3B", kind: "detention", dueAt: NOW_ANCHOR - 30 }));
    expect(line.textContent).toMatch(/^ended \S+ as typed · passed/u);
    expect(line.firstElementChild).toHaveAttribute("data-wf-glyph", "danger");
    expect(line.textContent).not.toContain("30m");
  });

  it("shows no glyph for a far typed time, and says when no expiry is recorded", () => {
    const far = renderRow(withForm({ code: "3B", kind: "detention", dueAt: NOW_ANCHOR + soonMinutes * 4 }));
    expect(far.querySelector("[data-wf-glyph]")).toBeNull();
    expect(far.querySelector('[data-testid="legal-limits-not-checked"]')).toBeInTheDocument();
    cleanup();
    const none = renderRow(withForm({ code: "3B", kind: "detention" }));
    expect(none.textContent).toBe("No expiry recorded");
    expect(none.querySelector('[data-testid="legal-limits-not-checked"]')).toBeNull();
  });
});

describe.each([false, true])("Movement pop-up legal line, as typed (phone=%s)", (phone) => {
  it("shows the typed time with its standing word and the tag", () => {
    installMatchMediaStub(phone);
    render(
      <MovementDrawer
        movement={withForm({ code: "3B", kind: "detention", dueAt: NOW_ANCHOR + urgentMinutes / 2 })}
        now={NOW_ANCHOR}
        units={[]}
        referrals={[]}
        patients={[]}
        edAccessTargetMinutes={ED_ACCESS_TARGET_MINUTES}
        dispatch={() => {}}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/ends \S+ as typed · within \S+/u);
    expect(dialog.querySelector('[data-testid="legal-limits-not-checked"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-wf-glyph="danger"]')).toBeInTheDocument();
  });
});
