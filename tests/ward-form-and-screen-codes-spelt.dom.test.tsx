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
function bareCodes(root: HTMLElement): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("abbr, script, style, .sr-only")) continue;
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
  it("the ED board shows the register title under each form chip", () => {
    const view = renderInProvider(<EdScreen edId="arm-ed" />);
    const titles = [...view.container.querySelectorAll('[data-testid^="ward-ed-form-title-"]')];
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(title.textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe("H-0187: codes on Home and Capacity are spelt out", () => {
  it("Capacity shows no known code without its full name", () => {
    const view = renderInProvider(<CapacityScreen />);
    expect(bareCodes(view.container)).toEqual([]);
  });

  it("Home shows no known code without its full name, apart from the two held strings", () => {
    const view = renderInProvider(<CoordinatorScreen />);
    // Held: both strings live in coordinator-screen.tsx, which another branch has signed out.
    const held = (entry: string) =>
      entry.includes("CAHS inpatient wards, not modelled") || entry.includes("Demo coordinator view");
    expect(bareCodes(view.container).filter((entry) => !held(entry))).toEqual([]);
  });
});
