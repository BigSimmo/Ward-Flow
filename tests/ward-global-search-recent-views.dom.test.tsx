// Ported from #1434 (WF-RUN-02): recent screens resolve from the catalogue with route permission.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ward-management/search/ward-smart-search", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/search/ward-smart-search")>();
  return { ...actual, searchWardFlow: vi.fn(actual.searchWardFlow) };
});

import { WardGlobalSearch, clearGlobalSearchRecents } from "@/components/ward-management/ward-global-search";
import { rememberRecent } from "@/components/ward-management/ward-global-search-recents";
import { CORE_SEARCH_VIEWS, searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const target = wardPatients[0];
const lifetime = "audit-search-lifetime";
const allow = () => true;
const deny = () => false;

function Search({ revision = 0, registered = false, generation = 0, permitted = true, present = true }) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride value={{ ...flow, worldGeneration: generation }}>
      <WardGlobalSearch
        patients={present ? (registered ? [...wardPatients] : [target]) : []}
        movements={[]}
        units={[]}
        now={NOW_ANCHOR + revision}
        accessLifetime={lifetime}
        canOpenHref={permitted ? allow : deny}
        onNavigate={() => {}}
      />
    </WardFlowOverride>
  );
}

function host(props: Parameters<typeof Search>[0] = {}) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Search {...props} />
    </WardFlowProvider>
  );
}

afterEach(() => {
  cleanup();
  clearGlobalSearchRecents();
  vi.clearAllMocks();
});

describe("audit recent screen reconstruction", () => {
  it("looks up all recent screens directly, and removes any whose route permission is revoked", () => {
    const view = render(host());
    fireEvent.focus(screen.getByTestId("ward-global-search-input"));
    const screens = CORE_SEARCH_VIEWS.slice(0, 4);
    act(() => {
      for (const screen of screens)
        rememberRecent(
          {
            kind: "view",
            kindLabel: "View",
            id: screen.key,
            title: screen.title,
            meta: screen.description ?? "View",
            href: screen.href,
          },
          lifetime,
        );
    });
    const recent = screen.getByRole("listbox", { name: "Recent" });
    for (const item of screens) expect(within(recent).getByText(item.title)).toBeInTheDocument();
    expect(searchWardFlow).not.toHaveBeenCalled();
    view.rerender(host({ permitted: false }));
    expect(screen.queryByTestId("ward-global-search-group-recent")).toBeNull();
    expect(searchWardFlow).not.toHaveBeenCalled();
  });
});
