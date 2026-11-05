import React, { type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WF_PHONE_QUERY, WF_TABLET_PORTRAIT_QUERY } from "@/components/wf/use-is-phone";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/ward-flow/handover",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each(["desktop", "phone", "portrait"])(
  "explains a journey leaving an open %s sheet without substituting Sign off",
  async (layout) => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches:
          layout === "phone"
            ? query === WF_PHONE_QUERY
            : layout === "portrait"
              ? query === WF_TABLET_PORTRAIT_QUERY
              : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    let selectedId!: string;
    let remove!: (id: string) => void;
    function Bridge() {
      const base = useWardFlow();
      const [removed, setRemoved] = React.useState<string>();
      remove = setRemoved;
      const first = base.movements.filter(isOpen)[0]!;
      selectedId = first.id;
      return (
        <WardFlowOverride value={{ ...base, movements: removed ? [] : [first] }}>
          <HandoverPage />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Bridge />
      </WardFlowProvider>,
    );
    if (layout === "phone")
      document
        .querySelectorAll<HTMLButtonElement>('[aria-controls^="ward-handover-phone-group-"][aria-expanded="false"]')
        .forEach((button) => fireEvent.click(button));
    const row =
      layout === "portrait"
        ? within(screen.getByTestId("wf-portrait-list")).getByRole("button", { name: /next:/ })
        : layout === "phone"
          ? screen.getAllByTestId("ward-handover-phone-row")[0]!
          : within(screen.getByTestId("ward-handover-sheet"))
              .getAllByRole("row")
              .find((row) => row.hasAttribute("data-row-id"))!;
    fireEvent.click(row);
    if (layout !== "phone") {
      expect(screen.getByRole("link", { name: "Movements" })).toHaveAttribute("href", movementHref(selectedId));
    }
    await act(async () => remove(selectedId));
    const notice = screen.getByText(/This journey is no longer open in Handover/);
    expect(notice).toBeInTheDocument();
    if (layout === "desktop") expect(notice).toHaveFocus();
    else
      expect(screen.getByRole("dialog", { name: "Journey no longer open" })).toContainElement(
        document.activeElement as HTMLElement,
      );
    expect(screen.queryByRole("dialog", { name: "Sign off" })).toBeNull();
  },
);
