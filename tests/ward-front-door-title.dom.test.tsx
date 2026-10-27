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
});
