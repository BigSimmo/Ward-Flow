import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/mockups/ward-flow", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

import {
  ACT_NOW_NOTIFICATIONS_STORAGE_KEY,
  setActNowNotificationPreference,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import { WardActNowNotifier } from "@/components/ward-management/shell/ward-act-now-notifier";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Stream A, 9 Oct 2026: the act-now notifier follows the Tasks drawer's role gate, so a ward, ED,
 * officer or community route is never notified of the coordinator's rows.
 */
const NOW = NOW_ANCHOR;
const shown: string[] = [];

function BreachAForm() {
  const { movements, dispatch } = useWardFlow();
  const movement = movements.find((m) => !m.closure && m.legalForm && m.legalForm.dueAt === undefined);
  return (
    <button
      type="button"
      onClick={() => {
        if (!movement) return;
        dispatch({
          type: "RECORD_LEGAL_FORM_EXPIRY",
          role: "coordinator",
          now: NOW,
          movementId: movement.id,
          dueAt: NOW - 30,
        });
      }}
    >
      Breach a form
    </button>
  );
}

async function renderAt(pathname: string) {
  navigation.pathname = pathname;
  render(
    <WardFlowProvider initialNow={NOW}>
      <BreachAForm />
      <WardActNowNotifier />
    </WardFlowProvider>,
  );
  // Let the provider adopt (or decline) the saved session, which sets the notifier's baseline.
  await act(async () => {});
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Breach a form" }));
  });
}

beforeEach(() => {
  shown.length = 0;
  const Fake = function (this: { onclick: null; close: () => void }, title: string, options: NotificationOptions) {
    shown.push(`${title}: ${options.body}`);
    this.onclick = null;
    this.close = () => {};
  } as unknown as { permission: NotificationPermission };
  Fake.permission = "granted";
  vi.stubGlobal("Notification", Fake);
  setActNowNotificationPreference(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY);
  window.sessionStorage.clear();
});

describe("act-now notifier", () => {
  it("notifies the coordinator's route of a new act-now alert, once, with no patient name", async () => {
    await renderAt("/mockups/ward-flow");
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatch(/^Ward Flow: act now: .*Synthetic demo data\.$/);
  });

  it.each(["/mockups/ward-flow/ward/rph-adult-secure", "/mockups/ward-flow/community"])(
    "stays silent on %s, whose Tasks drawer carries no coordinator rows",
    async (pathname) => {
      await renderAt(pathname);
      expect(shown).toEqual([]);
    },
  );
});
