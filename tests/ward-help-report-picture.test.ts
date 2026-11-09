// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { reportText } from "@/components/ward-management/help/ward-help-report";
import {
  keepInPicture,
  makeReportPicture,
  overlap,
  pictureLine,
  pictureRoot,
  READABLE_SELECTOR,
  readableBoxes,
  visibleBoxOf,
} from "@/components/ward-management/help/ward-help-report-picture";

const toCanvas = vi.hoisted(() => vi.fn());
vi.mock("html-to-image", () => ({ toCanvas }));

type Box = { x: number; y: number; width: number; height: number };

/** jsdom has no layout: each element with an id reads the box given here. */
function stubBoxes(boxes: Record<string, Box>) {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const box = boxes[this.id] ?? { x: 0, y: 0, width: 0, height: 0 };
    return {
      ...box,
      left: box.x,
      top: box.y,
      right: box.x + box.width,
      bottom: box.y + box.height,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

/** A synthetic sidebar whose page menu sits in its own scroller, scrolled part way. */
const SHELL = `
  <div id="row"><aside id="rail"><header>Ward Flow</header>
    <div id="menu-scroll" style="overflow-y: auto"><nav id="menu" aria-label="Ward Flow views">Home</nav></div>
    <footer>Profile</footer></aside>
  <div data-wf-scroller><main>Bed 4, synthetic</main></div></div>`;

const SHELL_BOXES: Record<string, Box> = {
  row: { x: 0, y: 0, width: 800, height: 600 },
  rail: { x: 0, y: 0, width: 200, height: 600 },
  // The menu's scroller sits between the rail's header (60px) and footer (60px).
  "menu-scroll": { x: 0, y: 60, width: 200, height: 480 },
  // Scrolled: the menu runs above and below its scroller.
  menu: { x: 0, y: -100, width: 200, height: 900 },
};

afterEach(() => {
  vi.restoreAllMocks();
  toCanvas.mockReset();
  document.body.innerHTML = "";
});

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

  it("holds a scrolled menu inside its own scroller, so the rail's header and footer stay pixelated", () => {
    document.body.innerHTML = SHELL;
    stubBoxes(SHELL_BOXES);
    const menu = document.getElementById("menu")!;
    expect(visibleBoxOf(menu, document.getElementById("row")!)).toEqual({ x: 0, y: 60, width: 200, height: 480 });
  });

  it("pixelates the drawing, restores only the clipped menu and clears the sharp drawing", async () => {
    document.body.innerHTML = SHELL;
    stubBoxes(SHELL_BOXES);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(768);

    type FakeContext = {
      imageSmoothingEnabled: boolean;
      imageSmoothingQuality: string;
      drawImage: ReturnType<typeof vi.fn>;
      clearRect: ReturnType<typeof vi.fn>;
    };
    const contexts = new Map<HTMLCanvasElement, FakeContext>();
    const contextOf = (canvas: HTMLCanvasElement) => {
      let context = contexts.get(canvas);
      if (!context) {
        context = { imageSmoothingEnabled: true, imageSmoothingQuality: "low", drawImage: vi.fn(), clearRect: vi.fn() };
        contexts.set(canvas, context);
      }
      return context;
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return contextOf(this) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" })),
    );
    const sharp = document.createElement("canvas");
    sharp.width = 800;
    sharp.height = 600;
    toCanvas.mockResolvedValue(sharp);

    const picture = await makeReportPicture(document);

    expect(picture.type).toBe("image/png");
    expect(toCanvas).toHaveBeenCalledWith(
      document.getElementById("row"),
      expect.objectContaining({ width: 800, height: 600, pixelRatio: 1, filter: keepInPicture }),
    );
    const others = [...contexts.entries()].filter(([canvas]) => canvas !== sharp);
    const small = others.find(([canvas]) => canvas.width === Math.ceil(800 / 14))!;
    const out = others.find(([canvas]) => canvas.width === 800)!;
    // Shrunk to one pixel per 14px block, then stretched back with no smoothing.
    expect(small[0].height).toBe(Math.ceil(600 / 14));
    expect(small[1].drawImage).toHaveBeenCalledWith(sharp, 0, 0, 58, 43);
    expect(out[1].imageSmoothingEnabled).toBe(false);
    expect(out[1].drawImage).toHaveBeenNthCalledWith(1, small[0], 0, 0, 58 * 14, 43 * 14);
    // Only the menu's visible part is copied sharp: never the rail's header or footer.
    expect(out[1].drawImage).toHaveBeenCalledTimes(2);
    expect(out[1].drawImage).toHaveBeenNthCalledWith(2, sharp, 0, 60, 200, 480, 0, 60, 200, 480);
    // The sharp drawing is wiped and emptied before the picture leaves.
    expect(contexts.get(sharp)?.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(sharp.width).toBe(0);
    expect(sharp.height).toBe(0);
  });
});
