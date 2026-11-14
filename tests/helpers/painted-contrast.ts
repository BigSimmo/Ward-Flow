import type { Page } from "playwright/test";

/**
 * Painted-background contrast (R-STYLE-8). axe cannot resolve text on translucent or frosted layers
 * and leaves those nodes "incomplete". This helper runs in the page: for every visible text node it
 * alpha-blends the background colours of the element's ancestors (bottom up, from the first opaque
 * layer, falling back to the page canvas), blends the text colour over that result, and returns the
 * nodes under WCAG AA: 4.5:1, or 3:1 for large text (24px, or 18.66px and bold).
 *
 * Skipped: disabled controls, hidden or zero-size text, and text over an image (undecided). A
 * gradient is judged against its worst colour stop. Failures name the element by tag, test id and
 * class, never its text, unless `includeText` is set for local diagnosis of synthetic data.
 */

export type ContrastFailure = {
  element: string;
  ratio: number;
  required: number;
  foreground: string;
  background: string;
  sample?: string;
};

export type ContrastScan = { checked: number; undecided: number; failures: ContrastFailure[] };

export type Theme = "light" | "dark" | "glare";

export const THEMES: readonly Theme[] = ["light", "dark", "glare"];

/** Put the document into Light, Dark or Bright light the way the theme scripts do (attributes only). */
export async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((mode) => {
    const root = document.documentElement;
    if (mode === "glare") {
      root.setAttribute("data-mode", "glare");
      root.setAttribute("data-theme", "light");
      root.classList.remove("dark");
    } else {
      root.removeAttribute("data-mode");
      root.setAttribute("data-theme", mode);
      root.classList.toggle("dark", mode === "dark");
    }
  }, theme);
  // Colours transition after a theme switch; switch transitions off so the sample is the settled paint.
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  await page.waitForTimeout(300);
}

export async function scanPaintedContrast(page: Page, options: { includeText?: boolean } = {}): Promise<ContrastScan> {
  return page.evaluate((includeText) => {
    type Rgba = [number, number, number, number];

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const cache = new Map<string, Rgba | null>();

    // The canvas resolves every CSS colour syntax the engine knows (rgb, color(srgb ...), color-mix).
    const parse = (value: string): Rgba | null => {
      const hit = cache.get(value);
      if (hit !== undefined) return hit;
      let result: Rgba | null = null;
      if (value === "transparent") result = [0, 0, 0, 0];
      else {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = "#010203";
        context.fillStyle = value;
        // An unparsed value leaves the sentinel behind.
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        result = r === 1 && g === 2 && b === 3 && !/^#010203$/i.test(value) && a === 255 ? null : [r, g, b, a / 255];
      }
      cache.set(value, result);
      return result;
    };

    const over = (top: Rgba, below: Rgba): Rgba => {
      const alpha = top[3] + below[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const mix = (a: number, b: number) => (a * top[3] + b * below[3] * (1 - top[3])) / alpha;
      return [mix(top[0], below[0]), mix(top[1], below[1]), mix(top[2], below[2]), alpha];
    };

    const luminance = ([r, g, b]: Rgba) => {
      const [lr, lg, lb] = [r, g, b].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const ratioOf = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const hex = ([r, g, b, a]: Rgba) =>
      `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.round(a * 100) / 100})`;

    const describe = (element: Element) => {
      const testId = element.getAttribute("data-testid");
      const className =
        typeof (element as HTMLElement).className === "string" ? (element as HTMLElement).className : "";
      return `${element.tagName.toLowerCase()}${testId ? `[data-testid=${testId}]` : ""}${
        className ? `.${className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""
      }`;
    };

    // The page canvas: the root's own background, then the body's, then the scheme default.
    const rootStyle = getComputedStyle(document.documentElement);
    let canvasColour: Rgba = [255, 255, 255, 1];
    for (const node of [document.body, document.documentElement]) {
      const parsed = parse(getComputedStyle(node).backgroundColor);
      if (parsed && parsed[3] > 0) canvasColour = over(parsed, canvasColour);
    }
    if (
      rootStyle.colorScheme.includes("dark") &&
      getComputedStyle(document.body).backgroundColor === "rgba(0, 0, 0, 0)"
    ) {
      canvasColour = [18, 18, 18, 1];
    }

    const failures: ContrastFailure[] = [];
    const seen = new Set<Element>();
    let checked = 0;
    let undecided = 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      const element = node.parentElement;
      if (!text || !element || seen.has(element)) continue;
      if (element.closest("script, style, noscript, svg, [aria-hidden='true'], [hidden], [inert], .sr-only")) continue;
      if (element.closest(":disabled, [aria-disabled='true'], fieldset:disabled")) continue;
      if (typeof element.checkVisibility === "function") {
        if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      // Clipped away by an overflow ancestor (off-screen scroll content, sr-only text): not painted.
      const style = getComputedStyle(element);
      if (style.clip === "rect(0px, 0px, 0px, 0px)" || (rect.width <= 1 && rect.height <= 1)) continue;
      seen.add(element);

      // Walk up, collecting background layers until one is opaque; note anything undecidable.
      const layers: Rgba[][] = [];
      let opacity = 1;
      let blocked = false;
      for (let cursor: Element | null = element; cursor; cursor = cursor.parentElement) {
        const css = getComputedStyle(cursor);
        opacity *= Number.parseFloat(css.opacity) || 0;
        const image = css.backgroundImage;
        const base = parse(css.backgroundColor) ?? [0, 0, 0, 0];
        let covered = false;
        if (image && image !== "none") {
          if (/url\(/.test(image)) {
            blocked = true;
            break;
          }
          // Split the layer list at its top-level commas; the first layer paints on top.
          const parts: string[] = [];
          let depth = 0;
          let start = 0;
          for (let index = 0; index < image.length; index += 1) {
            if (image[index] === "(") depth += 1;
            else if (image[index] === ")") depth -= 1;
            else if (image[index] === "," && depth === 0) {
              parts.push(image.slice(start, index));
              start = index + 1;
            }
          }
          parts.push(image.slice(start));
          for (const part of parts) {
            const stops = (part.match(/rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/gi) ?? [])
              .map(parse)
              .filter((stop): stop is Rgba => stop !== null);
            if (!stops.length) continue;
            // A gradient layer forks the result into one candidate per colour stop.
            layers.push(stops);
            if (stops.every((stop) => stop[3] >= 0.999)) {
              covered = true;
              break;
            }
          }
        }
        if (covered) break;
        if (base[3] > 0) {
          layers.push([base]);
          if (base[3] >= 0.999) break;
        }
      }
      if (blocked) {
        undecided += 1;
        continue;
      }

      // Combine layers bottom up; a gradient forks the result into one candidate per stop.
      let candidates: Rgba[] = [canvasColour];
      for (const layer of layers.reverse()) {
        candidates = layer.flatMap((paint) => candidates.map((below) => over(paint, below)));
      }
      candidates = candidates.slice(0, 64);

      const colour = parse(style.color);
      if (!colour) {
        undecided += 1;
        continue;
      }
      const ink: Rgba = [colour[0], colour[1], colour[2], colour[3] * opacity];
      const size = Number.parseFloat(style.fontSize);
      const bold = Number.parseInt(style.fontWeight, 10) >= 700;
      const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;

      let worst = Number.POSITIVE_INFINITY;
      let worstBackground: Rgba = candidates[0];
      let worstInk: Rgba = ink;
      for (const background of candidates) {
        const painted = over(ink, background);
        const value = ratioOf(painted, background);
        if (value < worst) {
          worst = value;
          worstBackground = background;
          worstInk = painted;
        }
      }
      checked += 1;
      if (worst < required) {
        failures.push({
          element: describe(element),
          ratio: Math.round(worst * 100) / 100,
          required,
          foreground: hex(worstInk),
          background: hex(worstBackground),
          ...(includeText ? { sample: text.slice(0, 28) } : {}),
        });
      }
    }
    return { checked, undecided, failures };
  }, Boolean(options.includeText));
}
