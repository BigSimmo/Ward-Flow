import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search-lazy";
import { installMatchMediaStub } from "./setup/jsdom.setup";
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/ward-global-search-help", () => {
  throw new Error("Synthetic unavailable search chunk");
});
afterEach(cleanup);
it("announces a failed phone search load and keeps typed text for retry", async () => {
  installMatchMediaStub(true);
  render(<WardGlobalSearch movements={[]} patients={[]} units={[]} />);
  const field = screen.getByTestId("ward-global-search-input");
  fireEvent.change(field, { target: { value: "synthetic query" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Search did not load");
  expect(screen.getByRole("alert")).toHaveTextContent("tap the search field to try again");
  expect(field).toHaveValue("synthetic query");
  fireEvent.pointerDown(field);
  expect(field).toHaveValue("synthetic query");
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});
