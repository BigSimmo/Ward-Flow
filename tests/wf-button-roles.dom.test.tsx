import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BUTTON_ROLE_VARIANTS, Button, buttonClass, type ButtonVariant } from "@/components/wf/button";

/**
 * P127 (audit 27 Oct 2026): three button roles are defined with no visible change. The class
 * strings every existing variant and size renders are pinned to the values read off main
 * (d34b5f2b), so a role definition that changed any existing button's look fails here.
 */
const VARIANTS: ButtonVariant[] = ["pri", "sec", "tint", "ghost", "danger", "onHero", "light"];
const SIZES = ["sm", "md", "lg"] as const;
const MAIN_CLASSES: Record<string, string> = {
  "pri/sm": "_b_ff4691 _pri_ff4691 _sm_ff4691",
  "pri/md": "_b_ff4691 _pri_ff4691",
  "pri/lg": "_b_ff4691 _pri_ff4691 _lg_ff4691",
  "sec/sm": "_b_ff4691 _sec_ff4691 _sm_ff4691",
  "sec/md": "_b_ff4691 _sec_ff4691",
  "sec/lg": "_b_ff4691 _sec_ff4691 _lg_ff4691",
  "tint/sm": "_b_ff4691 _tint_ff4691 _sm_ff4691",
  "tint/md": "_b_ff4691 _tint_ff4691",
  "tint/lg": "_b_ff4691 _tint_ff4691 _lg_ff4691",
  "ghost/sm": "_b_ff4691 _ghost_ff4691 _sm_ff4691",
  "ghost/md": "_b_ff4691 _ghost_ff4691",
  "ghost/lg": "_b_ff4691 _ghost_ff4691 _lg_ff4691",
  "danger/sm": "_b_ff4691 _danger_ff4691 _sm_ff4691",
  "danger/md": "_b_ff4691 _danger_ff4691",
  "danger/lg": "_b_ff4691 _danger_ff4691 _lg_ff4691",
  "onHero/sm": "_b_ff4691 _onHero_ff4691 _sm_ff4691",
  "onHero/md": "_b_ff4691 _onHero_ff4691",
  "onHero/lg": "_b_ff4691 _onHero_ff4691 _lg_ff4691",
  "light/sm": "_b_ff4691 _light_ff4691 _sm_ff4691",
  "light/md": "_b_ff4691 _light_ff4691",
  "light/lg": "_b_ff4691 _light_ff4691 _lg_ff4691",
  default: "_b_ff4691 _sec_ff4691",
};

describe("P127: button roles are defined without changing any rendered button", () => {
  it("maps the three roles onto existing variants only", () => {
    expect(BUTTON_ROLE_VARIANTS).toEqual({ primary: "pri", secondary: "sec", destructive: "danger" });
  });

  it("keeps every existing variant and size's class string identical to main", () => {
    const now: Record<string, string> = {};
    for (const variant of VARIANTS)
      for (const size of SIZES) now[`${variant}/${size}`] = buttonClass({ variant, size });
    now["default"] = buttonClass();
    expect(now).toEqual(MAIN_CLASSES);
  });

  it("renders a default Button with the same markup as main", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toBe(MAIN_CLASSES["default"]);
    expect(button.outerHTML).toBe(
      '<button type="button" class="_b_ff4691 _sec_ff4691"><span class="_label_ff4691">Save</span></button>',
    );
  });
});
