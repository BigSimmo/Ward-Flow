// Search audit (8 Nov 2026): role-led place order, forgiving ward and site matching, and Escape in a
// page search clearing its words rather than closing the sheet around it. Synthetic data only.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchField } from "@/components/wf/search-field";
import { wardMatchesQuery } from "@/components/ward-management/referrals/find-a-ward";
import { communityTeamsMatching } from "@/components/ward-management/referrals/community-short-form";
import { searchGroupOrder } from "@/components/ward-management/search/ward-smart-search";
import { PatientChronologySearch } from "@/components/ward-management/reports/patient-chronology-search";
import type { Patient } from "@/components/ward-management/ward-patients";

afterEach(cleanup);

describe("role-led search group order", () => {
  it("keeps the fixed order when no role is given", () => {
    expect(searchGroupOrder("place", "graylands ward").slice(0, 3)).toEqual(["beds", "wards", "eds"]);
  });

  it("leads with the desk's own kind of place for a place query", () => {
    expect(searchGroupOrder("place", "graylands ward", "ed")[0]).toBe("eds");
    expect(searchGroupOrder("place", "graylands ward", "community").slice(0, 2)).toEqual(["teams", "suburbs"]);
  });

  it("keeps Help first for a how-to question about a place", () => {
    const order = searchGroupOrder("place", "how do I find a ward", "ed");
    expect(order.slice(0, 2)).toEqual(["help", "eds"]);
  });

  it("never moves people ahead of a person query, whatever the role", () => {
    for (const role of ["ed", "community", "ward", "bed_manager", "coordinator", "officer"]) {
      expect(searchGroupOrder("person", "smith", role)[0]).toBe("people");
    }
  });

  it("only reorders: every group is still listed once", () => {
    const order = searchGroupOrder("general", "x1", "community");
    expect(order[0]).toBe("teams");
    expect(new Set(order).size).toBe(order.length);
    expect([...order].sort()).toEqual([...searchGroupOrder("general", "x1")].sort());
  });
});

describe("ward finder matching", () => {
  it("finds a ward by its site code and by words in any order", () => {
    expect(wardMatchesQuery("RPH", { name: "Ward 1", siteCode: "RPH" })).toBe(true);
    expect(wardMatchesQuery("1 ward", { name: "Ward 1", siteCode: "RPH" })).toBe(true);
    expect(wardMatchesQuery("", { name: "Ward 1", siteCode: "RPH" })).toBe(true);
    expect(wardMatchesQuery("-", { name: "Ward 1", siteCode: "RPH" })).toBe(true);
    expect(wardMatchesQuery("graylands", { name: "Ward 1", siteCode: "RPH" })).toBe(false);
  });

  it("gives the same community teams for a repeated query", () => {
    const teams = ["Alpha CMHS", "Beta CMHS"];
    expect(communityTeamsMatching(teams, "alpha")).toEqual(communityTeamsMatching(teams, "alpha"));
    expect(communityTeamsMatching(teams, "")).toBe(teams);
  });
});

function Harness({ onOuterEscape }: { onOuterEscape: () => void }) {
  const [value, setValue] = useState("smith");
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) onOuterEscape();
      }}
    >
      <SearchField label="Find a person" value={value} onValueChange={setValue} count={{ shown: 1, total: 2 }} />
    </div>
  );
}

describe("SearchField Escape", () => {
  it("clears typed words without reaching the panel around it, then lets Escape through", () => {
    const outer = vi.fn();
    render(<Harness onOuterEscape={outer} />);
    const input = screen.getByRole("searchbox", { name: "Find a person" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("links its count line even without an id", () => {
    render(<Harness onOuterEscape={() => {}} />);
    const input = screen.getByRole("searchbox", { name: "Find a person" });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain("2");
  });
});

describe("chronology patient search", () => {
  const people = [
    { id: "p1", familyName: "Quellmoor", givenName: "Ivo", umrn: "UM900001" },
    { id: "p2", familyName: "Brakewell", givenName: "Sena", umrn: "UM900002" },
  ] as unknown as Patient[];

  it.each(["Quellmoor, Ivo", "ivo quellmoor", "quellmoor ivo", "UM 900001"])("%s finds the one person", (typed) => {
    render(
      <PatientChronologySearch
        people={people}
        chosenId=""
        onChoose={() => {}}
        nameOf={(p) => `${p.familyName}, ${p.givenName}`}
        size="hero"
        label="Find a patient"
      />,
    );
    const box = screen.getByRole("combobox");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: typed } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    cleanup();
  });
});
