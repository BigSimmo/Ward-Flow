// H-0842 and H-0187 (27 Oct 2026): a form code reads with its register title, and the codes on
// Home and Capacity carry their full names (DA-17 `SpelledCodes`).
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { codeName } from "@/components/ward-management/ward-abbreviations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { stayLegalShort } from "@/components/ward-management/ward-stay-legal";
import { formTitleForCode } from "@/lib/form-register";

afterEach(cleanup);

/** Known codes shown as visible text with no `<abbr>` and no full name in the same text. */
function bareCodes(root: HTMLElement, held = ""): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("abbr, script, style, .sr-only")) continue;
    if (held && parent.closest(held)) continue;
    const text = node.textContent ?? "";
    for (const match of text.matchAll(/\b(SYN-[A-Z]+|[A-Z]{2,6})\b/gu)) {
      const name = codeName(match[1]!);
      if (name !== undefined && !(parent.textContent ?? "").includes(name))
        found.push(`${match[1]} in "${text.trim()}"`);
    }
  }
  return found;
}

function renderInProvider(screen: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{screen}</WardFlowProvider>);
}

describe("H-0842: form codes carry their register titles", () => {
  it("a stay on a form reads the code with its title", () => {
    const state = seedWardFlowStateAt(0);
    const stay = { ...state.admissions.find((a) => a.state === "occupied")!, movementId: state.movements[0]!.id };
    const onForm = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === stay.movementId
          ? {
              ...m,
              legalStatus: "Involuntary inpatient" as const,
              legalForm: { ...m.legalForm, code: "6A" } as NonNullable<typeof m.legalForm>,
            }
          : m,
      ),
    };
    expect(formTitleForCode("6A")).not.toBeNull();
    expect(stayLegalShort(stay, onForm)).toBe(`Form 6A (${formTitleForCode("6A")})`);
  });
  // Josh (31 Oct 2026): no line under the chip; the chip names the register title on tap, on
  // keyboard focus and to screen readers, never on hover only.
  it("the ED handover table's Form choice names its register title to screen readers and on hover", () => {
    // ED handover table (1 Nov 2026): the Form column's choice replaced the old form chip and its tip.
    const view = renderInProvider(<EdScreen edId="arm-ed" />);
    const picks = [...view.container.querySelectorAll<HTMLButtonElement>('[data-testid^="ward-ed-form-pick-"]')];
    const withForm = picks.filter((pick) => /Form \w+,/u.test(pick.getAttribute("aria-label") ?? ""));
    expect(withForm.length).toBeGreaterThan(0);
    for (const pick of withForm) {
      const code = /Form (\w+),/u.exec(pick.getAttribute("aria-label") ?? "")![1]!;
      const title = formTitleForCode(code);
      expect(title).toBeTruthy();
      expect(pick).toHaveAccessibleName(expect.stringContaining(title!));
      expect(pick).toHaveAttribute("title", title!);
    }
  });
});

describe("H-0187: codes on Home and Capacity are spelt out", () => {
  it("Capacity shows no known code without its full name", () => {
    const view = renderInProvider(<CapacityScreen />);
    // Held: the CAHS footer note is left as it is. The old bed map and freeing list held here for
    // PR #1013 went with the Capacity redesign (31 Oct 2026), so the new bed map is checked too.
    expect(bareCodes(view.container, "footer")).toEqual([]);
  });

  it("Home shows no known code without its full name, apart from the two held strings", () => {
    const view = renderInProvider(<CoordinatorScreen />);
    // Held: home-ed-pressure.tsx (its button names must keep matching the visible text, WCAG 2.5.3).
    // Held: both strings live in coordinator-screen.tsx, which another branch has signed out.
    const held = (entry: string) =>
      entry.includes("CAHS inpatient wards, not modelled") || entry.includes("Demo coordinator view");
    expect(
      bareCodes(view.container, '[data-testid="ward-home-ed-pressure"], footer').filter((entry) => !held(entry)),
    ).toEqual([]);
  });
});
