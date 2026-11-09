// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { reportText } from "@/components/ward-management/help/ward-help-report";
import {
  keepInPicture,
  overlap,
  pictureLine,
  pictureRoot,
  READABLE_SELECTOR,
  readableBoxes,
} from "@/components/ward-management/help/ward-help-report-picture";

const CONTEXT = {
  screen: "Home",
  path: "/ward-flow",
  desk: "Bed manager",
  browser: "Chrome 131 on Android",
  time: "now",
};

describe("Report a problem: picture of the screen", () => {
  it("says whether a picture is attached, and only when asked", () => {
    expect(pictureLine(true)).toEqual(["Picture attached", "yes"]);
    expect(
      reportText("It froze.", { ...CONTEXT, picture: true })
        .split("\n")
        .at(-1),
    ).toBe("Picture attached: yes");
    expect(
      reportText("It froze.", { ...CONTEXT, picture: false })
        .split("\n")
        .at(-1),
    ).toBe("Picture attached: no");
    expect(reportText("It froze.", CONTEXT)).not.toContain("Picture");
  });

  it("keeps only the sidebar's page menu readable", () => {
    document.body.innerHTML = `
      <div id="row"><aside><nav aria-label="Ward Flow views">Home</nav></aside>
      <div data-wf-scroller><header>Bed 4</header><main>Patient</main>
      <nav data-testid="ward-phone-dock">Quick</nav></div></div>`;
    const readable = Array.from(document.querySelectorAll(READABLE_SELECTOR)).map((node) => node.textContent);
    expect(readable).toEqual(["Home"]);
    expect(pictureRoot(document).id).toBe("row");
  });

  it("draws the body when the app shell is not there", () => {
    document.body.innerHTML = "<main>Page</main>";
    expect(pictureRoot(document)).toBe(document.body);
  });

  it("leaves Help, dialogs and scripts out of the drawing", () => {
    document.body.innerHTML = `
      <div data-testid="ward-help-sheet"><p id="in-help">Help</p></div>
      <div role="dialog" id="dialog"></div><dialog id="native"></dialog><script id="s"></script>
      <main id="main"><p id="text">Words</p></main>`;
    const byId = (id: string) => document.getElementById(id);
    expect(keepInPicture(byId("in-help"))).toBe(false);
    expect(keepInPicture(byId("dialog"))).toBe(false);
    expect(keepInPicture(byId("native"))).toBe(false);
    expect(keepInPicture(byId("s"))).toBe(false);
    expect(keepInPicture(byId("main"))).toBe(true);
    expect(keepInPicture(byId("text")?.firstChild)).toBe(true);
  });

  it("moves readable boxes into the picture, clips them and drops ones outside", () => {
    const root = { x: 10, y: 20, width: 800, height: 600 };
    const size = { width: 800, height: 600 };
    expect(
      readableBoxes(
        root,
        [
          { x: 10, y: 20, width: 240.4, height: 500 },
          { x: 700, y: 500, width: 300, height: 300 },
          { x: 900, y: 20, width: 50, height: 50 },
          { x: 10, y: 20, width: 0, height: 10 },
        ],
        size,
      ),
    ).toEqual([
      { x: 0, y: 0, width: 241, height: 500 },
      { x: 690, y: 480, width: 110, height: 120 },
    ]);
  });

  it("holds a box inside its column", () => {
    expect(overlap({ x: 0, y: -50, width: 240, height: 900 }, { x: 0, y: 0, width: 260, height: 800 })).toEqual({
      x: 0,
      y: 0,
      width: 240,
      height: 800,
    });
    expect(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 10, height: 10 }).width).toBe(0);
  });
});
