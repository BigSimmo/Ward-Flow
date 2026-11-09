import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// NA2-01 (numbers-agree audit, 24 Oct 2026): at 23:57 desktop said "0 to hand over" beside 14 Act
// now rows while the phone counted them. Both titles now count Act now + Flagged urgent + Due by.
const LATE = NOW_ANCHOR + 13 * 60 + 15;

function renderAt() {
  return render(
    <WardFlowProvider initialNow={LATE}>
      <HandoverPage />
    </WardFlowProvider>,
  );
}

const titleCount = (testId: string) => {
  const match = /(\d+) to hand over/.exec(screen.getByTestId(testId).textContent ?? "");
  expect(match, `${testId} has no "N to hand over" title`).not.toBeNull();
  return Number(match![1]);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Handover title count (NA2-01)", () => {
  it("is the same number on desktop and phone, and counts the Act now rows", () => {
    renderAt();
    const desktop = titleCount("ward-handover-hero");
    cleanup();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 46.4375rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderAt();
    const phone = titleCount("ward-handover-phone-hero");
    expect(desktop).toBe(phone);
    expect(desktop).toBeGreaterThan(0);
  });

  // Audit 24-4 decision 5 (Josh): Act now counts people, Alerts counts alerts. Both are named.
  it("names the people and the alerts on the Act now count", () => {
    renderAt();
    // 1 Nov 2026 redesign: the count's spoken name is "n Act now (n people, m alerts)"; its face shows n.
    // CB-3 (axe 4.14): the name starts with the face's own "n Act now".
    // Page tops (9 Nov 2026): the top's "act now" figure; its value sits beside the label, whose
    // spoken name adds the people and the alerts.
    const pill = within(screen.getByTestId("ward-handover-hero")).getByRole("button", { name: /^act now ?\(/ });
    const match = /^act now \((\d+) (?:person|people), (\d+) alerts?\)$/.exec(pill.textContent ?? "");
    expect(match, pill.textContent ?? "").not.toBeNull();
    const [, people, alerts] = match!.map(Number);
    const count = Number(screen.getByTestId("ward-handover-figure-act").querySelector("b")?.textContent);
    expect(people).toBe(count);
    expect(people).toBeGreaterThan(0);
    // One person can carry more than one alert, never the other way round on the whole network.
    expect(alerts).toBeGreaterThanOrEqual(people!);
  });
});
