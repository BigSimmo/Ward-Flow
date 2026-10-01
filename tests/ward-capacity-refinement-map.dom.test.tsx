import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BedMap } from "@/components/ward-management/capacity/bed-map";
import { allUnits } from "@/components/ward-management/ward-sites";
import { bedReleases } from "@/components/ward-management/ward-movements";

const units = allUnits();
beforeEach(() => {
  window.localStorage.clear();
});

describe("Capacity map refinement", () => {
  it("finds an off-screen ward and transfers keyboard focus without selecting or hiding wards", () => {
    const onSelect = vi.fn();
    const scroll = vi.fn();
    const target = units[units.length - 1];
    render(<BedMap units={units} bedReleases={bedReleases} onSelectWard={onSelect} initialLayout="row" />);
    const card = screen.getByTestId(`ward-bed-map-ward-${target.id}`);
    Object.defineProperty(card, "scrollIntoView", { value: scroll });
    fireEvent.change(screen.getByRole("searchbox", { name: "Find ward" }), { target: { value: target.name } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(within(card).getByRole("button", { name: target.name })).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(`Found ${target.name}`);
    for (const unit of units) expect(screen.getByTestId(`ward-bed-map-ward-${unit.id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("searchbox", { name: "Find ward" })).toHaveFocus();
    expect(screen.getByRole("searchbox", { name: "Find ward" })).toHaveValue("");
  });

  it("keeps unmatched text transient and reports no match without removing wards", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const { unmount } = render(<BedMap units={units} bedReleases={bedReleases} initialLayout="grid" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "synthetic unmatched ward" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(screen.getByRole("status")).toHaveTextContent("No matching ward");
    expect(screen.getAllByTestId(/^ward-bed-map-ward-/u)).toHaveLength(units.length);
    expect(write).not.toHaveBeenCalled();
    unmount();
    render(<BedMap units={units} bedReleases={bedReleases} />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    write.mockRestore();
  });

  it("restores a saved view ahead of Capacity's initial grid and overview defaults", () => {
    const { unmount } = render(
      <BedMap units={units} bedReleases={bedReleases} initialLayout="grid" initialBedDetail={false} />,
    );
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Row view" }));
    fireEvent.click(screen.getByRole("button", { name: "Bed detail" }));
    unmount();
    render(<BedMap units={units} bedReleases={bedReleases} initialLayout="grid" initialBedDetail={false} />);
    expect(screen.getByRole("button", { name: "Row view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bed detail" })).toHaveAttribute("aria-pressed", "true");
  });

  it("remembers only view enums and retains ward and bed keyboard access when changing views", () => {
    const { unmount } = render(<BedMap units={units} bedReleases={bedReleases} onSelectWard={vi.fn()} />);
    const ward = units[0];
    const card = screen.getByTestId(`ward-bed-map-ward-${ward.id}`);
    const firstBed = within(card).getAllByRole("img")[0];
    fireEvent.focus(firstBed);
    expect(within(card).getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(firstBed);
    expect(within(card).queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(window.localStorage.getItem("ward-flow-capacity-map-view")).toBe("grid:overview");
    unmount();
    render(<BedMap units={units} bedReleases={bedReleases} onSelectWard={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: ward.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bed detail" }));
    expect(within(screen.getByTestId(`ward-bed-map-ward-${ward.id}`)).getAllByRole("img")[0]).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
