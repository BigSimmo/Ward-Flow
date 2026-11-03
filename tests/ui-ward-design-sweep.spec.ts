import { expect, test, type Page } from "playwright/test";

import { WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";

/**
 * Design sweep (2 November 2026): every main Ward Flow screen, at the phone (390x844), tablet
 * portrait (744x1133 iPad mini, 768x1024 iPad; Q330), tablet landscape icon rail (1180x820 iPad Air) and
 * desktop (1280x800) sizes, fails on three
 * owner design rules that screenshots kept missing:
 *
 * 1. visible text smaller than 12px;
 * 2. a visible control (button, link, tab, input, select, summary) under 40px tall or wide: on a
 *    phone, more of them than the page's recorded baseline; on a tablet or desktop, logged only (Q231);
 * 3. a sticky or top-fixed bar that covers text, sits below the place it should stick (the phone
 *    tab bar that rendered 56px low over a heading), or leaves a gap above itself where scrolled
 *    content shows through.
 *
 * Synthetic demo data only, as every Ward journey. Failure messages name elements by tag, test id
 * and class, never by their text, so a record's name never reaches a log. Every page reports all
 * of its violations, at every size, in one failure message.
 */

const VIEWPORTS = [
  { name: "phone 390x844", width: 390, height: 844 },
  // Tablet portrait. The phone layout ends at 743px (useIsPhone, Q292), so both are tablet sizes.
  { name: "iPad mini 744x1133", width: 744, height: 1133 },
  { name: "iPad 768x1024", width: 768, height: 1024 },
  // Tablet landscape (1001 to 1200px): the icon rail layout, unchecked until 2 Nov 2026.
  { name: "iPad Air landscape 1180x820", width: 1180, height: 820 },
  { name: "desktop 1280x800", width: 1280, height: 800 },
] as const;

// The main screens are the rail's own destinations, so a new screen joins the sweep by being
// listed. Flagged entries (Bed meeting TV) are off by default and left out.
const PAGES: ReadonlyArray<{ label: string; href: string }> = [
  ...WARD_VIEWS.map(({ label, href }) => ({ label, href })),
  ...WARD_NAV.filter((item) => !item.flag).map(({ label, href }) => ({ label, href })),
].filter((page, index, all) => all.findIndex((other) => other.href === page.href) === index);

const MIN_FONT_PX = 12;
const MIN_TARGET_PX = 40;
const MAX_LISTED_PER_RULE = 30;

type Finding = { rule: "text" | "target" | "bar"; detail: string };

async function openSettled(page: Page, href: string): Promise<void> {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("ward-bar").first()).toBeVisible({ timeout: 30_000 });
  // Lazy screens draw a loading shape first; measure the screen, not its placeholder.
  await expect
    .poll(() => page.locator("[data-shape]").count(), { timeout: 15_000 })
    .toBe(0)
    .catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/** Runs inside the page: measures the three rules and returns one finding per offending element. */
function sweep({ minFont, minTarget }: { minFont: number; minTarget: number }): Finding[] {
  const findings: Finding[] = [];
  const header = document.querySelector<HTMLElement>('[data-testid="ward-bar"]');
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  const describe = (element: Element): string => {
    const parts: string[] = [];
    let node: Element | null = element;
    for (let depth = 0; node && depth < 3 && node !== document.body; depth += 1, node = node.parentElement) {
      const testId = node.getAttribute("data-testid");
      const role = node.getAttribute("role");
      const firstClass = typeof node.className === "string" ? node.className.split(/\s+/u)[0] : "";
      parts.unshift(
        `${node.tagName.toLowerCase()}${testId ? `[data-testid=${testId}]` : ""}${role ? `[role=${role}]` : ""}${firstClass ? `.${firstClass}` : ""}`,
      );
      if (testId) break;
    }
    return parts.join(" > ");
  };

  // An ancestor that clips (overflow hidden or clip, or a clip-path) hides whatever falls outside
  // it: the screen-reader-only wrapper is a 1px box. A scrolling ancestor does not: its content is
  // one scroll away, so it still counts as on the page.
  const clippedAway = (element: Element, rect: DOMRect): boolean => {
    let { left, right, top, bottom } = rect;
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      const clips = (value: string) => value === "hidden" || value === "clip";
      const clipPath = style.clipPath !== "none";
      if (!clipPath && !clips(style.overflowX) && !clips(style.overflowY)) continue;
      const box = node.getBoundingClientRect();
      if (clipPath || clips(style.overflowX)) {
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
      if (clipPath || clips(style.overflowY)) {
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
      }
      if (right - left <= 1 || bottom - top <= 1) return true;
    }
    return false;
  };

  const shown = (element: Element): boolean => {
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const rect = element.getBoundingClientRect();
    // Visually hidden text (1px clip) and off-canvas drawers are not on the screen.
    if (rect.width <= 1 || rect.height <= 1) return false;
    if (rect.right <= 0 || rect.left >= vw) return false;
    return !clippedAway(element, rect);
  };

  const ownText = (element: Element): boolean =>
    Array.from(element.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent!.trim());

  const all = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter(
    (element) => !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(element.tagName),
  );
  const textElements = all.filter((element) => ownText(element) && shown(element));

  // Rule 1: text under 12px.
  for (const element of textElements) {
    const size = Number.parseFloat(getComputedStyle(element).fontSize);
    // font-size 0 is the whitespace-collapsing trick, not text anyone reads.
    if (size > 0 && size < minFont) findings.push({ rule: "text", detail: `${describe(element)} is ${size}px` });
  }

  // Rule 2: controls under 40px. The one allowance: a link inside running text (displayed inline,
  // in a block that also carries its own words), which WCAG 2.5.8 exempts. Nothing else.
  const inlineLinkInProse = (element: HTMLElement): boolean => {
    if (element.tagName !== "A" || getComputedStyle(element).display !== "inline") return false;
    const parent = element.parentElement;
    return Boolean(parent && ownText(parent));
  };
  const controls = document.body.querySelectorAll<HTMLElement>(
    'button, a[href], [role="tab"], [role="button"], input:not([type="hidden"]), select, summary',
  );
  for (const control of controls) {
    if (!shown(control) || inlineLinkInProse(control)) continue;
    const rect = control.getBoundingClientRect();
    if (rect.height < minTarget - 0.5 || rect.width < minTarget - 0.5)
      findings.push({
        rule: "target",
        detail: `${describe(control)} is ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
      });
  }

  // Rule 3: sticky and top-fixed bars. Everything starts from scroll position 0.
  const scrollers = [document.scrollingElement as HTMLElement, ...all].filter(
    (element) => element.scrollTop > 0 || element.scrollLeft > 0,
  );
  for (const element of scrollers) element.scrollTo({ top: 0, left: 0, behavior: "instant" });

  const inHeader = (element: Element) => Boolean(header && (header === element || header.contains(element)));
  const bars = all.filter((element) => {
    if (inHeader(element) || !shown(element)) return false;
    const style = getComputedStyle(element);
    if (style.position === "sticky") return style.top !== "auto";
    // A bar whose sticky rule lost to a plainer `position: relative` keeps its `top` and is pushed
    // that far down over the content below it (the phone tab bar, 56px low, 2 Nov 2026).
    if (style.position === "relative") return Number.parseFloat(style.top) >= 8;
    if (style.position !== "fixed") return false;
    // Only bars anchored at the top: full-screen sheets and bottom docks are not bars over the page.
    const rect = element.getBoundingClientRect();
    return rect.top < vh * 0.4 && rect.height < vh * 0.5 && !element.closest('[role="dialog"], dialog');
  });

  // What of an element is on screen right now: its box cut by every ancestor that clips or scrolls.
  const onScreen = (element: Element) => {
    let { left, right, top, bottom } = element.getBoundingClientRect();
    // A fixed bar escapes its ancestors' overflow.
    if (getComputedStyle(element).position === "fixed") return { left, right, top, bottom };
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      if (style.overflowX !== "visible" || style.clipPath !== "none") {
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
      if (style.overflowY !== "visible" || style.clipPath !== "none") {
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
      }
    }
    return { left, right, top, bottom };
  };

  const covers = (bar: HTMLElement, text: HTMLElement): boolean => {
    if (bar.contains(text) || text.contains(bar)) return false;
    const a = onScreen(bar);
    const b = onScreen(text);
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right, vw);
    const top = Math.max(a.top, b.top, 0);
    const bottom = Math.min(a.bottom, b.bottom, vh);
    if (right - left < 2 || bottom - top < 2) return false;
    const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    return Boolean(hit && bar.contains(hit));
  };

  const scrollContainerOf = (element: HTMLElement): HTMLElement => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight + 1) return node;
    }
    return document.scrollingElement as HTMLElement;
  };

  for (const bar of bars) {
    const style = getComputedStyle(bar);
    const name = describe(bar);
    if (style.position === "sticky") {
      // In flow at scroll 0, a sticky bar sits exactly where a static one would. Pushed lower, it
      // is sticking to an offset its scroller does not have, and it lies over what follows it.
      const placed = bar.getBoundingClientRect().top;
      const previous = bar.style.getPropertyValue("position");
      const priority = bar.style.getPropertyPriority("position");
      bar.style.setProperty("position", "static", "important");
      const natural = bar.getBoundingClientRect().top;
      bar.style.setProperty("position", previous, priority);
      if (!previous) bar.style.removeProperty("position");
      const pushed = Math.round(placed - natural);
      if (pushed > 2)
        findings.push({
          rule: "bar",
          detail: `${name} (sticky, top ${style.top}) renders ${pushed}px below its place at scroll 0`,
        });
    }
    for (const text of textElements) {
      if (!inHeader(text) && covers(bar, text))
        findings.push({
          rule: "bar",
          detail: `${name} (${style.position}, top ${style.top}) covers text ${describe(text)} at scroll 0`,
        });
    }
  }

  // Scrolled: a stuck bar should meet whatever sits above it. A strip of scrolled content showing
  // between the top of its scroller (or the bar above) and the bar means it sticks too low.
  for (const bar of bars.filter((element) => getComputedStyle(element).position === "sticky")) {
    const scroller = scrollContainerOf(bar);
    const isDocument = scroller === document.scrollingElement;
    const portTop = isDocument ? 0 : scroller.getBoundingClientRect().top + scroller.clientTop;
    const offset = Number.parseFloat(getComputedStyle(bar).top) || 0;
    const naturalTop = bar.getBoundingClientRect().top - portTop + scroller.scrollTop;
    const target = Math.min(scroller.scrollHeight - scroller.clientHeight, naturalTop - offset + 160);
    if (target <= 0) continue;
    scroller.scrollTo({ top: target, behavior: "instant" });
    const rect = bar.getBoundingClientRect();
    const stuck = Math.abs(rect.top - (portTop + offset)) <= 1.5;
    if (stuck && offset > 2) {
      const y = portTop + offset / 2;
      const xs = [0.2, 0.5, 0.8].map((share) => Math.max(1, Math.min(vw - 1, rect.left + rect.width * share)));
      const showing = xs.some((x) => {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !scroller.contains(hit) || bar.contains(hit)) return false;
        if (bars.some((other) => other !== bar && other.contains(hit)) || inHeader(hit)) return false;
        return textElements.some((text) => text === hit || text.contains(hit));
      });
      if (showing)
        findings.push({
          rule: "bar",
          detail: `${describe(bar)} sticks ${Math.round(offset)}px below the top of its scroller and scrolled text shows above it`,
        });
    }
    scroller.scrollTo({ top: 0, behavior: "instant" });
  }

  return findings;
}

function summarise(findings: Finding[]): string[] {
  const labels: Record<Finding["rule"], string> = {
    text: `text under ${MIN_FONT_PX}px`,
    target: `controls under ${MIN_TARGET_PX}px`,
    bar: "sticky or fixed bars over content",
  };
  const lines: string[] = [];
  for (const rule of ["text", "target", "bar"] as const) {
    const counts = new Map<string, number>();
    for (const finding of findings.filter((entry) => entry.rule === rule))
      counts.set(finding.detail, (counts.get(finding.detail) ?? 0) + 1);
    if (counts.size === 0) continue;
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    lines.push(`  ${labels[rule]} (${total}):`);
    const entries = [...counts.entries()];
    for (const [detail, count] of entries.slice(0, MAX_LISTED_PER_RULE))
      lines.push(`    - ${detail}${count > 1 ? ` (x${count})` : ""}`);
    if (entries.length > MAX_LISTED_PER_RULE)
      lines.push(`    - and ${entries.length - MAX_LISTED_PER_RULE} more distinct elements`);
  }
  return lines;
}

/**
 * Sweeps until two passes agree. A screen that picks its phone or desktop layout in script (Handover's
 * `useIsPhone`) can still show the other layout for a moment after load on a busy machine, and a
 * count taken then would be the wrong screen's.
 */
async function settledSweep(page: Page): Promise<Finding[]> {
  const measure = () => page.evaluate(sweep, { minFont: MIN_FONT_PX, minTarget: MIN_TARGET_PX });
  const key = (findings: Finding[]) => findings.map((finding) => `${finding.rule} ${finding.detail}`).join("\n");
  let previous = await measure();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.waitForTimeout(750);
    const next = await measure();
    if (key(next) === key(previous)) return next;
    previous = next;
  }
  return previous;
}

/**
 * Controls under 40px on a phone, per page: the counts measured on 2 November 2026 once the day's
 * fixes were in. The rule is a hard failure on a phone, but these screens already had small
 * controls, so each page may not go ABOVE its count; a page not listed allows none. When a fix
 * brings a page's count down, lower its number here in the same change so it cannot creep back.
 * Q295 (2 Nov 2026): small kit buttons are drawn at 40px on phones, so Capacity, Example ED and
 * Transport dropped to none, Alerts to 1 and Discharges to 2 (its Now/History switch, which keeps
 * the shared phone track's shorter options with a 48px hit area, as Home's queue switch does).
 */
const PHONE_TARGET_BASELINE: Readonly<Record<string, number>> = {
  "/ward-flow": 12,
  "/ward-flow/waiting": 3,
  "/ward-flow/movements": 5,
  "/ward-flow/ward/rph-adult-secure": 1,
  "/ward-flow/board/rph-adult-secure": 2,
  "/ward-flow/discharges": 2,
  "/ward-flow/alerts": 1,
  "/ward-flow/referrals": 2,
  "/ward-flow/referrals/new": 2,
};

test.describe("@mockup Ward design sweep: text size, target size and sticky bars", () => {
  test.use({ colorScheme: "light" });

  for (const { label, href } of PAGES) {
    test(`${label} (${href}) meets the 12px text, 40px target and sticky bar rules at phone, tablet and desktop`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const report: string[] = [];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openSettled(page, href);
        const findings = await settledSweep(page);
        const hard = findings.filter((finding) => finding.rule !== "target");
        const targets = findings.filter((finding) => finding.rule === "target");
        const lines = summarise(hard);

        if (viewport.width < 744) {
          // Phone: small controls fail once the page has more than its baseline.
          const baseline = PHONE_TARGET_BASELINE[href] ?? 0;
          if (targets.length > baseline) {
            lines.push(
              `  ${targets.length} controls under ${MIN_TARGET_PX}px, above this page's baseline of ${baseline} ` +
                "(PHONE_TARGET_BASELINE in this spec). Make the new ones 40px; do not raise the baseline.",
              ...summarise(targets).slice(1),
            );
          } else if (targets.length < baseline) {
            const note = `${label} (${href}): ${targets.length} phone controls under ${MIN_TARGET_PX}px, below the baseline of ${baseline}. Lower PHONE_TARGET_BASELINE["${href}"] to ${targets.length}.`;
            test.info().annotations.push({ type: "lower phone target baseline", description: note });
            console.log(note);
          }
        } else if (targets.length) {
          // Tablet and desktop: logged only. Q231 (Josh, 2 Nov 2026): the 40px rule is for phones; desktop
          // segmented and pill tabs stay 30px (kit standard of 30 October 2026), so small desktop
          // controls are reported here and never fail the sweep.
          const note = `${label} (${href}) ${viewport.name}: ${targets.length} controls under ${MIN_TARGET_PX}px (advisory, Q231)\n${summarise(targets).join("\n")}`;
          test.info().annotations.push({ type: "tablet or desktop controls under 40px (Q231)", description: note });
          console.log(note);
        }
        if (lines.length) report.push(`${viewport.name}:`, ...lines);
      }
      expect(report.length, `${label} (${href}) design sweep violations:\n${report.join("\n")}`).toBe(0);
    });
  }
});

/**
 * Phone hit boxes (Q377, 3 Nov 2026): controls the page sweep cannot reach because they sit in a
 * popup or a later form step. Each is drawn at least 40px tall on a phone (DESIGN-SYSTEM.md house
 * rule), and a time button's invisible cover still takes a press just above and below its face, so
 * the tap area stays 48px. Synthetic demo records only.
 */
test.describe("@mockup Phone hit boxes: popup and form-step controls (Q377)", () => {
  test.use({ colorScheme: "light", viewport: { width: 390, height: 844 } });

  test("arrival time buttons are drawn 40px tall with a 48px tap area", async ({ page }) => {
    await openSettled(page, "/ward-flow/ed/rph-ed");
    // The arrival plan opens from the ED's lists; the button can sit in a closed list on a phone.
    await page.locator('[data-testid^="ward-ed-outbox-arrival-plan-toggle-"]').first().dispatchEvent("click");
    const presets = page
      .getByRole("group", { name: /quick times$/u })
      .first()
      .getByRole("button");
    await expect(presets.first()).toBeVisible();
    await presets.first().scrollIntoViewIfNeeded();
    const boxes = await presets.evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const takes = (y: number) => {
          const hit = document.elementFromPoint(x, y);
          return hit === button || button.contains(hit);
        };
        return { height: rect.height, above: takes(rect.top - 3), below: takes(rect.bottom + 3) };
      }),
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.above && box.below, "the 48px tap cover takes presses beside the 40px face").toBe(true);
    }
  });

  test("referral risk flag checkboxes are drawn 40px tall", async ({ page }) => {
    await openSettled(page, "/ward-flow/referrals/new");
    const risk = page.getByRole("group", { name: /^Risk flags/u });
    // The Referral step (source, legal status, urgency) holds the risk flags.
    await page
      .locator("button, a")
      .filter({ hasText: /Source · legal status/u })
      .first()
      .click();
    const rows = risk.locator("label");
    await expect(rows.first()).toBeVisible();
    const heights = await rows.evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(40);
  });
});
