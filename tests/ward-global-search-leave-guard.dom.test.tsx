import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { WARD_PERSONA_SYNC_EVENT } from "@/components/ward-management/settings/operator-switcher-modal";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

type GuardedWindow = typeof window & { __wardFlowConfirmNavigation?: () => boolean };

afterEach(() => {
  cleanup();
  delete (window as GuardedWindow).__wardFlowConfirmNavigation;
});

function Host({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { movements, patients, referrals, units } = useWardFlow();
  return (
    <WardGlobalSearch
      movements={movements}
      patients={patients}
      referrals={referrals}
      units={units}
      now={NOW_ANCHOR}
      onNavigate={onNavigate}
    />
  );
}

function openCommands() {
  const input = screen.getByTestId("ward-global-search-input");
  fireEvent.focus(input);
  return input;
}

const COMMANDS = [
  ["ward-global-search-cmd-desk-coordinator", "/mockups/ward-flow"],
  ["ward-global-search-cmd-desk-ward", "/mockups/ward-flow/wards"],
  ["ward-global-search-cmd-desk-ed", "/mockups/ward-flow/ed"],
  ["ward-global-search-cmd-desk-officer", "/mockups/ward-flow/transport/officer"],
  ["ward-global-search-cmd-handover", "/mockups/ward-flow/handover"],
] as const;

describe("global search quick commands respect the unsaved-changes guard", () => {
  for (const [testId, href] of COMMANDS) {
    it(`${testId} stays put, and changes no desk, when the person cancels`, () => {
      const confirm = vi.fn(() => false);
      (window as GuardedWindow).__wardFlowConfirmNavigation = confirm;
      const onNavigate = vi.fn();
      const personaSync = vi.fn();
      window.addEventListener(WARD_PERSONA_SYNC_EVENT, personaSync);

      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Host onNavigate={onNavigate} />
        </WardFlowProvider>,
      );
      openCommands();
      fireEvent.click(screen.getByTestId(testId));

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(personaSync).not.toHaveBeenCalled();
      window.removeEventListener(WARD_PERSONA_SYNC_EVENT, personaSync);
    });

    it(`${testId} goes ahead, asking only once, when the person agrees`, () => {
      const confirm = vi.fn(() => true);
      (window as GuardedWindow).__wardFlowConfirmNavigation = confirm;
      const onNavigate = vi.fn();

      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Host onNavigate={onNavigate} />
        </WardFlowProvider>,
      );
      openCommands();
      fireEvent.click(screen.getByTestId(testId));

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(href);
    });
  }
});
