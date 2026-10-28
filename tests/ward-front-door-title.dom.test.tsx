// P190: after sign-out the tab title must not keep naming the page that was open (for example Referrals).
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FrontDoor } from "../src/components/ward-management/front-door/front-door";

afterEach(() => {
  document.title = "";
});

describe("front door tab title", () => {
  it("replaces a leftover page title with the sign-in title", () => {
    document.title = "Referrals — Ward Flow";
    render(<FrontDoor form={undefined} demoUrl={null} />);
    expect(document.title).toBe("Sign in — Ward Flow");
  });

  it("puts the page's title back when the sign-in screen goes, as after signing back in at the same address", () => {
    document.title = "Patients — Ward Flow";
    const view = render(<FrontDoor form={undefined} demoUrl={null} />);
    expect(document.title).toBe("Sign in — Ward Flow");
    view.unmount();
    expect(document.title).toBe("Patients — Ward Flow");
  });

  it("leaves a title the next page has already set", () => {
    document.title = "Patients — Ward Flow";
    const view = render(<FrontDoor form={undefined} demoUrl={null} />);
    document.title = "Referrals — Ward Flow";
    view.unmount();
    expect(document.title).toBe("Referrals — Ward Flow");
  });
});
