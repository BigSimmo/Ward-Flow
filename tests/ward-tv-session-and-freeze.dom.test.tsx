import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/bed-meeting" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { WardRecoveryNotice, WardRecoveryNoticeContext } from "@/components/ward-management/shell/ward-recovery-notice";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  WardSessionEndingNotice,
  WardSharedAccess,
  type WardSharedConnection,
} from "@/components/ward-management/ward-shared-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  route.pathname = "/ward-flow/bed-meeting";
});

function signedOut(): WardSharedConnection {
  return {
    enabled: true,
    signedIn: false,
    status: "not-authorised",
    error: null,
    receivedAt: 0,
    snapshot: null,
    dispatch: vi.fn(),
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  };
}

describe("TV session end (TV-13, H-0787)", () => {
  it("says at TV size that the TV is signed out, with the way back", () => {
    render(
      <WardSharedAccess connection={signedOut()}>
        <p>Synthetic TV</p>
      </WardSharedAccess>,
    );
    const notice = screen.getByRole("main", { name: "TV signed out" });
    expect(notice).toHaveAttribute("data-testid", "ward-tv-signed-out");
    expect(notice).toHaveTextContent("This TV is signed out");
    expect(screen.getByRole("button", { name: "Sign in with email" })).toBeVisible();
  });

  it("keeps the desk sign-in page off the TV route", () => {
    route.pathname = "/ward-flow/capacity";
    render(
      <WardSharedAccess connection={signedOut()}>
        <p>Synthetic desk</p>
      </WardSharedAccess>,
    );
    expect(screen.getByRole("main", { name: "Ward Flow sign-in" })).toBeVisible();
    expect(screen.queryByTestId("ward-tv-signed-out")).toBeNull();
  });

  it("puts the sign-out warning inside the element shown full screen", () => {
    const tv = document.createElement("main");
    document.body.append(tv);
    // jsdom has no Fullscreen API, so the element shown full screen is set by hand.
    let shown: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => shown });
    try {
      render(<WardSessionEndingNotice endsAt={Date.now() + 5 * 60_000} />);
      expect(tv.contains(screen.getByTestId("ward-session-ending"))).toBe(false);
      shown = tv;
      act(() => {
        document.dispatchEvent(new Event("fullscreenchange"));
      });
      expect(tv.contains(screen.getByTestId("ward-session-ending"))).toBe(true);
    } finally {
      Reflect.deleteProperty(document, "fullscreenElement");
      tv.remove();
    }
  });
});

describe("TV notices (TV-14, H-0791)", () => {
  it("shows no recovery notice on the TV", () => {
    const { container } = render(
      <WardRecoveryNoticeContext.Provider value="Restored the last successful save.">
        <WardRecoveryNotice />
      </WardRecoveryNoticeContext.Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TV freezes its records while not updating (TV-06, H-0223)", () => {
  it("keeps every figure from the last live moment when records change offline", () => {
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    let clear!: () => void;
    function NoMovements({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      const [empty, setEmpty] = useState(false);
      clear = () => setEmpty(true);
      return <WardFlowOverride value={empty ? { ...value, movements: [] } : value}>{children}</WardFlowOverride>;
    }
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <NoMovements>
            <BedMeetingTvScreen />
          </NoMovements>
        </WardFlowProvider>,
      );
      const longest = () => screen.getByTestId("bed-meeting-tv-longest").textContent;
      const before = longest();
      online.mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
      act(() => clear());
      expect(longest()).toBe(before);
      online.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(longest()).not.toBe(before);
    } finally {
      online.mockRestore();
    }
  });
});
