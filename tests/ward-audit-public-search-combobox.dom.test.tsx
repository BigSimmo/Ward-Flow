import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WardPublicSearch } from "@/components/ward-management/ward-public-search";
import { installMatchMediaStub } from "./setup/jsdom.setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

it("exposes its visible result list as an expandable keyboard combobox", () => {
  installMatchMediaStub(false);
  render(
    <WardPublicSearch
      accessLifetime="synthetic-search"
      canOpenHref={() => true}
      catalogue={{
        wards: [],
        emergencyDepartments: [],
        teams: [],
        services: [],
        catalogue: { sites: [] },
        openableEmergencyDepartmentIds: [],
        openableCommunityTeamIds: [],
        openableServiceIds: [],
      }}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Search" });
  expect(input).toHaveAttribute("aria-expanded", "false");
  fireEvent.focus(input);
  const list = screen.getByRole("listbox");
  expect(input).toHaveAttribute("aria-expanded", "true");
  expect(input).toHaveAttribute("aria-controls", list.id);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(document.getElementById(input.getAttribute("aria-activedescendant")!)).toHaveAttribute("role", "option");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
