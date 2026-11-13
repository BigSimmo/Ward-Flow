import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceNameTag } from "@/components/ward-management/service-name-tag";
import { Badge } from "@/components/wf";

/**
 * F-78 (shared design parts, 13 Nov 2026): a health service is named, never coloured. Where a row
 * does not already write its service, the short name sits in the kit Badge's neutral `tag` look.
 */
describe("ServiceNameTag", () => {
  it("writes the short name in a neutral tag with no colour of its own", () => {
    render(<ServiceNameTag service="North Metro" />);
    const tag = screen.getByText("NMHS").parentElement as HTMLElement;
    expect(tag.className).toMatch(/tag/);
    expect(tag.getAttribute("style")).toBeNull();
    expect(tag).toHaveAttribute("title", "North Metro");
    expect(tag.querySelector("svg")).toBeNull();
  });

  it("keeps names that are already short", () => {
    render(<ServiceNameTag service="WACHS" />);
    const tag = screen.getByText("WACHS").parentElement as HTMLElement;
    expect(tag).not.toHaveAttribute("title");
  });

  it("is a kit Badge variant, not a screen-local style", () => {
    render(<Badge variant="tag">EMHS</Badge>);
    expect((screen.getByText("EMHS").parentElement as HTMLElement).className).toMatch(/tag/);
  });
});
