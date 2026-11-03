import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

// Refined Handover A (9 Oct 2026). The owner's three scope conditions (2026-09-09) still hold:
// the scope is always named, the excluded count is always stated, and anything that needs action
// now outside the scope is still named, by patient and UMRN, never by journey number.
const realSeed = seedWardFlowState();
const realOpen = realSeed.movements.filter(isOpen);
const scghEdCount = realOpen.filter((movement) => movement.originEdId === "scgh-ed").length;
const wf018 = realSeed.movements.find((movement) => movement.id === "WF-018")!;
const wf018Identity = resolveSubjectPatient(wf018, realSeed);

function renderHandover() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
}

async function selectScope(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: /^Filter the sheet:/ }));
  await user.click(screen.getByRole("menuitemradio", { name: label }));
}

describe("Handover scope control", () => {
  it("defaults to Whole network, grouped by service, ward, emergency department and community team", async () => {
    const user = userEvent.setup();
    renderHandover();
    const trigger = screen.getByRole("button", { name: "Filter the sheet: Whole network" });
    expect(trigger).toHaveAttribute("data-value", "network");
    await user.click(trigger);
    const menu = screen.getByRole("menu", { name: "Filter the sheet" });
    expect(within(menu).getByRole("menuitemradio", { name: "Whole network" })).toHaveAttribute("aria-checked", "true");
    const groups = Array.from(menu.querySelectorAll('[role="presentation"]')).map((node) => node.textContent);
    expect(groups).toEqual(["Service", "Ward", "Emergency department", "Community team"]);
  });

  it("names the scope and states the real open count at mount", () => {
    renderHandover();
    // 1 Nov 2026 redesign: the whole network needs no scope line; the control and the Patients tab
    // name the scope and its real open count.
    expect(screen.queryByTestId("ward-handover-scope-summary")).toBeNull();
    expect(screen.getByTestId("ward-handover-scope-select")).toHaveAccessibleName("Filter the sheet: Whole network");
    expect(screen.getByRole("tab", { name: /Patients/ })).toHaveTextContent(String(realOpen.length));
  });

  it("renames itself to the chosen ED and states how many are outside the scope", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Sir Charles Gairdner Hospital Emergency Department");
    expect(screen.getByTestId("ward-handover-scope-summary")).toHaveTextContent(
      `${scghEdCount} of ${realOpen.length} open in Sir Charles Gairdner Hospital Emergency Department`,
    );
  });
});

describe("Act now outside the scope", () => {
  it("lists nothing outside the scope at the whole network", () => {
    renderHandover();
    expect(screen.queryByTestId("ward-handover-urgent-outside-filter")).not.toBeInTheDocument();
  });

  it("names the flagged-urgent patient by name and UMRN once the scope excludes their department, never the journey number", async () => {
    expect(wf018.flaggedUrgent).toBe(true);
    expect(wf018.originEdId).toBe("scgh-ed");
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Royal Perth Hospital Emergency Department");
    const footer = screen.getByTestId("ward-handover-urgent-outside-filter").textContent ?? "";
    expect(footer).toContain(wf018Identity.formalName);
    expect(footer).toContain(wf018Identity.umrn);
    expect(footer).not.toContain("WF-018");
  });

  it("stops naming that patient once the scope includes their department", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Sir Charles Gairdner Hospital Emergency Department");
    const footer = screen.queryByTestId("ward-handover-urgent-outside-filter")?.textContent ?? "";
    expect(footer).not.toContain(wf018Identity.formalName);
  });
});
