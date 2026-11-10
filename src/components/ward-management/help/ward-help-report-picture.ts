/**
 * REPORT A PROBLEM: AN OPTIONAL PICTURE OF THE SCREEN (feature 48, 9 Nov 2026). The reporter may add
 * a picture of the page behind Help. It must never show patient details, so nothing tries to find
 * names: every pixel of the page is pixelated into coarse blocks except the sidebar's page menu
 * ("Ward Flow views"), which only ever names pages. The phone's dock is not kept: it hides under Help,
 * so its box would show the page beneath. The live
 * page is never changed: the page is drawn to a canvas off screen, and the canvas is what is
 * pixelated, so text, typed values, images, pictures in canvases and CSS-drawn words are all covered
 * whatever element they sit in.
 *
 * The picture stays on this device. It goes only to the clipboard or a saved file the reporter asks
 * for; it is never sent, logged, put in an address or stored. `html-to-image` is loaded only when the
 * reporter asks for a picture, so no screen's first load grows.
 */

import { copyPngToClipboard } from "@/components/ward-management/ward-clipboard";

/** The menu that stays readable: it names pages, never patients. */
export const READABLE_SELECTOR = 'nav[aria-label="Ward Flow views"]';

/** Each block of the pixelated page, in CSS pixels: far coarser than any heading's letters. */
const PICTURE_BLOCK_PX = 14;

/** M124 (10 Nov 2026): the file is named synthetic, like every other download. */
export const PICTURE_FILENAME = "ward-flow-synthetic-report-screen.png";

/** M124: drawn across the foot of the picture, so it stays marked wherever it is pasted. */
export const PICTURE_MARKER = "Synthetic prototype";

/** The marker's band, in CSS pixels; its words are 13px, above the 12px floor. */
const MARKER_BAND_PX = 24;

export type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** "Picture attached: yes" or "no", for the report text. */
export function pictureLine(attached: boolean): readonly [string, string] {
  return ["Picture attached", attached ? "yes" : "no"];
}

/**
 * Whether the drawing keeps an element: Help itself, any dialog or popup, and the skip and loading
 * notes stay out. Text and other non-element nodes are kept (they are pixelated with the page).
 */
export function keepInPicture(node: unknown): boolean {
  if (typeof Element === "undefined" || !(node instanceof Element)) return true;
  if (node.tagName === "DIALOG" || node.tagName === "SCRIPT") return false;
  const role = node.getAttribute("role");
  if (role === "dialog" || role === "alertdialog") return false;
  return !node.closest('[data-testid="ward-help-sheet"]');
}

/** The part of the page to draw: the app's shell row (sidebar and page), or the whole body. */
export function pictureRoot(doc: Document): HTMLElement {
  return doc.querySelector<HTMLElement>("[data-wf-scroller]")?.parentElement ?? doc.body;
}

/**
 * The readable boxes in picture coordinates: each box moved by the root's corner, clipped to the
 * picture, and dropped when nothing of it is left. Rounded outwards to whole pixels.
 */
export function readableBoxes(root: Box, boxes: readonly Box[], size: { width: number; height: number }): Box[] {
  return boxes.flatMap((box) => {
    const left = Math.max(0, Math.floor(box.x - root.x));
    const top = Math.max(0, Math.floor(box.y - root.y));
    const right = Math.min(size.width, Math.ceil(box.x - root.x + box.width));
    const bottom = Math.min(size.height, Math.ceil(box.y - root.y + box.height));
    return right > left && bottom > top ? [{ x: left, y: top, width: right - left, height: bottom - top }] : [];
  });
}

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/** Where two boxes overlap, or an empty box. */
export function overlap(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x);
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y);
  return { x, y, width, height };
}

/** An overflow value that cuts off what lies outside the element's own box. */
const CLIPPING_OVERFLOW = /^(auto|scroll|hidden|clip|overlay)$/u;

function clipsContent(element: Element): boolean {
  if (element.tagName === "ASIDE") return true;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return false;
  return [style.overflowX, style.overflowY].some((value) => CLIPPING_OVERFLOW.test(value));
}

/**
 * The part of an element that shows on screen inside the picture's root: its box held inside the
 * sidebar's own column and inside every scrolling or clipping ancestor, so a scrolled menu can never
 * reach the rail's header or footer, or uncover the page. Both axes are clipped even where only one
 * scrolls: a smaller readable box only pixelates more.
 */
export function visibleBoxOf(element: Element, root: Element): Box {
  let box = boxOf(element);
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (clipsContent(node)) box = overlap(box, boxOf(node));
    if (node === root) break;
  }
  return box;
}

/** The synthetic line on a band across the picture's foot, in the theme's ink and surface. */
function drawMarker(context: CanvasRenderingContext2D, width: number, height: number, style: CSSStyleDeclaration) {
  const band = Math.min(MARKER_BAND_PX, height);
  context.fillStyle = style.getPropertyValue("--wf-ink-1").trim() || "#1a1a1a";
  context.fillRect(0, height - band, width, band);
  context.fillStyle = style.getPropertyValue("--wf-surface").trim() || "#ffffff";
  context.font = `600 13px ${style.getPropertyValue("--wf-font").trim() || "system-ui, sans-serif"}`;
  context.textBaseline = "middle";
  context.fillText(PICTURE_MARKER, 8, height - band / 2);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no picture"))), "image/png"),
  );
}

/**
 * Draws the page behind Help with everything but its menus pixelated, as a PNG. The sharp drawing
 * exists only inside this function, on canvases that are never added to the page.
 */
export async function makeReportPicture(doc: Document = document): Promise<Blob> {
  const view = doc.defaultView ?? window;
  const root = pictureRoot(doc);
  const rootBox = boxOf(root);
  const width = Math.max(1, Math.round(Math.min(rootBox.width, view.innerWidth)));
  const height = Math.max(1, Math.round(Math.min(rootBox.height, view.innerHeight)));
  const background = view.getComputedStyle(doc.body).backgroundColor || "#ffffff";
  const keep = readableBoxes(
    rootBox,
    Array.from(doc.querySelectorAll(READABLE_SELECTOR))
      .filter((element) => root.contains(element))
      // Held inside the sidebar's column and the menu's own scroller (see visibleBoxOf).
      .map((element) => visibleBoxOf(element, root)),
    { width, height },
  );

  const { toCanvas } = await import("html-to-image");
  const sharp = await toCanvas(root, {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    backgroundColor: background,
    cacheBust: false,
    filter: keepInPicture,
  });

  // Shrink to one pixel per block (averaging it), then stretch back with no smoothing.
  const small = doc.createElement("canvas");
  small.width = Math.max(1, Math.ceil(width / PICTURE_BLOCK_PX));
  small.height = Math.max(1, Math.ceil(height / PICTURE_BLOCK_PX));
  const smallContext = small.getContext("2d");
  const out = doc.createElement("canvas");
  out.width = width;
  out.height = height;
  const outContext = out.getContext("2d");
  if (!smallContext || !outContext) throw new Error("no canvas");
  smallContext.imageSmoothingEnabled = true;
  smallContext.imageSmoothingQuality = "high";
  smallContext.drawImage(sharp, 0, 0, small.width, small.height);
  outContext.imageSmoothingEnabled = false;
  outContext.drawImage(small, 0, 0, small.width * PICTURE_BLOCK_PX, small.height * PICTURE_BLOCK_PX);
  for (const box of keep) {
    outContext.drawImage(sharp, box.x, box.y, box.width, box.height, box.x, box.y, box.width, box.height);
  }
  drawMarker(outContext, width, height, view.getComputedStyle(doc.documentElement));
  // Clear the sharp drawing straight away; only the pixelated copy leaves this function.
  sharp.getContext("2d")?.clearRect(0, 0, sharp.width, sharp.height);
  sharp.width = 0;
  sharp.height = 0;
  return canvasBlob(out);
}

/** Whether this browser can put a picture on the clipboard. */
export function canCopyPicture(): boolean {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

export async function copyPicture(picture: Blob): Promise<void> {
  await copyPngToClipboard(picture);
}
