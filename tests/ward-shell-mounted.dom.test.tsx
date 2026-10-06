// tests/ward-shell-mounted.dom.test.tsx
//
// Task 6 of docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, as re-scoped by
// the 2026-09-04 ruling: `WardGround` mounts once, in `src/app/mockups/ward-flow/layout.tsx`
// (the only ancestor of every route's `<main>` — `ClinicalRail` is a SIBLING of `<main>` at all
// of its call sites and could never reach it).
//
// This file reproduces `layout.tsx`'s own composition — `WardBar` ahead of `WardGround`, which
// wraps the route's real screen component — minus `DeveloperAreaGate` (an auth gate orthogonal to
// the structural property under test here) and minus `WardRail`/the layout's flex-row wrapper,
// neither of which any assertion below touches. Real screen components + `WardFlowProvider`, no
// `DeveloperAreaGate`, is the same convention `tests/ward-landmarks.test.ts` already uses for "a
// real ward route".
//
// `WardBar` joined this reproduction in Task 8 (its own third addendum, 2026-09-11): the layout
// mounts it ahead of `ClinicalRail`'s removal specifically so the "exactly one role switcher"
// assertion below stays true once `ClinicalRail` no longer supplies it. Its own `checks` prop is
// `[]`, matching the layout's real mount — nothing under `src/` builds a
// `WardReconciliationCheck[]` yet.
//
// 🔴 THE PLACE LABEL CHANGED OWNER ON 2026-09-11, AND THE PROPERTY DID NOT. `WardShellHeader`
// used to render it here, alongside `WardGround`. The third-edition mount retired it (master plan
// §1.3 item 1.2: the shell mounts "in place of `WardChromeHeader` + `WardShellHeader`"), and
// `WardBar`'s own title now carries the place, derived through the same
// `wardPlaceFor(pathname, units)` call `WardShellHeader` made. The two cases below were
// re-pointed at `ward-bar-place` rather than deleted.
//
// ⚠️ A REPLICA THAT KEEPS MOUNTING A RETIRED COMPONENT IS THE FAILURE THIS FILE IS MOST EXPOSED
// TO. Nothing in this file reads `layout.tsx`; it re-types its composition. Left alone, every
// assertion here would have stayed green over a shape the app no longer has — which is the same
// class of blindness (a test that cannot see the real tree) that let a duplicated search box ship.
//
// Named `.dom.test.tsx` (not the `.test.tsx` first drafted) because vitest.config.mts collects
// DOM-rendering suites only under that exact suffix — `tests/ward-shell-mounted.test.tsx` matches
// neither project's include glob and would never run at all. `tests/ward-shell.dom.test.tsx`
// already established this suffix for the sibling suite that also renders `ward-shell.tsx`'s
// components.
//
// ⚠️ No `toHaveClass` anywhere in this file. This repo's vitest resolves CSS-module imports
// through a proxy that fabricates a plausible scoped class name for ANY property, including ones
// absent from the stylesheet — `expect(el).toHaveClass(styles.anything)` would pass whether or
// not that class is real. Ancestry is proved with `Node.contains()` instead, which is a real DOM
// relationship no proxy can fake.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardGround } from "@/components/ward-management/ward-shell";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const pathnameState = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/ward/rph-adult-secure" }));

// `useRouter` added for Task 8 (`WardBar` mount, third addendum): `WardBar` calls it directly
// (the Service selector's own click handlers, `openMovement`) even though this suite never
// triggers navigation. Same stub shape `tests/ward-shell-third-edition.dom.test.tsx` already uses
// for the same component.
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

/**
 * `WardFlowMockupLayout` (`src/app/mockups/ward-flow/layout.tsx`) mounts `WardBar` ahead of
 * `WardGround`, Task 8 (its own third addendum), and nothing at all between `WardGround` and the
 * route's own content — reproduced here, not the layout's `WardRail`/flex-row wrapper, which this
 * file's own assertions do not touch.
 *
 * ⚠️ **A SENTENCE HERE DESCRIBED A PROP THAT NO LONGER EXISTS, AND THE EDIT THAT REMOVED THE PROP
 * LEFT THE SENTENCE BEHIND WITH AN EMPTY CODE SPAN IN IT.** It said the fixture passed an empty
 * check array "matching the layout's own mount", because nothing under `src/` built a
 * `WardReconciliationCheck[]`. 🔴 **Both facts changed with O-9** — the bar reads a publication
 * store and `MovementsScreen` publishes to it — **and an empty code span is what a mechanical strip
 * leaves when it removes the thing a sentence was about.**
 */
function renderShellChrome(children: ReactNode) {
  return (
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBar />
      <WardGround>{children}</WardGround>
    </WardFlowProvider>
  );
}

/**
 * `/mockups/ward-flow/ward/rph-adult-secure` — one of the three route shapes `wardPlaceFor`
 * resolves a place for. `unitId="rph-adult-secure"` is the same fixture id
 * tests/ward-landmarks.test.ts and tests/ward-nav.test.ts already use, and `unitById` resolves
 * it to the real name "Dabakarn" (ward-sites.ts) — never a literal typed here.
 */
function renderWardRoute() {
  pathnameState.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
  return render(renderShellChrome(<WardScreen unitId="rph-adult-secure" />));
}

/** `/mockups/ward-flow` — the coordinator's own route, one of the seven with no place. */
function renderCoordinatorRoute() {
  pathnameState.pathname = "/mockups/ward-flow";
  return render(renderShellChrome(<CoordinatorScreen />));
}

describe("Task 6 — the shell is actually reached on a real route, not merely importable", () => {
  // `WardBar`'s Tools drawer is a `<Sheet>` (`Sheet` itself returns `null` while closed — see
  // that component's own header), and `Sheet`'s open-focus controller schedules work with
  // `requestAnimationFrame`. Same polyfill guard `tests/ward-shell-third-edition.dom.test.tsx`
  // already carries for the identical component.
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("anti-vacuity: the ward route fixture actually rendered its real screen content", () => {
    renderWardRoute();
    // If this fixture rendered nothing, every assertion below would pass vacuously — a missing
    // ancestor and a missing second heading look identical to an empty document.
    expect(screen.getByTestId("ward-unit-screen")).toBeInTheDocument();
    expect(document.querySelectorAll('main[id="main-content"]')).toHaveLength(1);
  });

  it("the ground-painting element is a real ancestor of the route's <main> — not a sibling that merely sits next to it", () => {
    const { container } = renderWardRoute();
    // `container.firstElementChild` used to be `WardGround`'s own div, back when this fixture's
    // top level held nothing else. Task 8 (third addendum) put `WardBar`'s `<header>` ahead of it
    // — a real sibling, not the ground itself, per the layout's own new composition — so the
    // ground is found by what it is (the ancestor that actually contains `<main>`) rather than by
    // position, which is what the previous fragile lookup effectively assumed.
    const bar = screen.getByTestId("ward-bar");
    const main = screen.getByRole("main");
    expect(bar.contains(main), "WardBar must never become an ancestor of the route's <main>").toBe(false);
    const ground = Array.from(container.children).find((child) => child !== bar && child.contains(main));
    expect(ground, "WardGround must render an outer element that is a real ancestor of <main>").not.toBeUndefined();
  });

  it("the place label appears exactly once for a route that has one", () => {
    // `getByText` alone is not safe here: `WardScreen`'s own body legitimately repeats the unit
    // name ("Dabakarn") several times over (the unit card, the statewide flow diagram),
    // so a plain text query would find several matches even with no place label rendered at all.
    // `data-testid="ward-bar-place"` names the ONE element the shell itself renders,
    // distinguishing "the shell's own label" from "this text occurs somewhere".
    //
    // 🔴 A COUNT, NOT A PRESENCE CHECK, and the reverted fold of 2026-09-11 is why. It shipped TWO
    // place labels on every place-resolving route — `ward-bar-place` and `ward-shell-place` — and
    // every presence check in this repository stayed green throughout.
    renderWardRoute();
    expect(screen.getAllByTestId("ward-bar-place")).toHaveLength(1);
    expect(screen.getByTestId("ward-bar-place")).toHaveTextContent("Dabakarn");
    expect(screen.getByTestId("ward-bar-subtitle")).toHaveTextContent("Inpatient Unit");
    expect(
      screen.queryByTestId("ward-shell-place"),
      "`WardShellHeader` is retired; a second place label on the same route is the defect this " +
        "count exists for, not a harmless duplicate",
    ).toBeNull();
  });

  it("the place label is absent for a route that has none", () => {
    // The coordinator screen's own statewide-flow diagram also legitimately names
    // "Dabakarn" as one of many units on the board, so this asserts the shell's OWN
    // element is absent, not that the string never occurs anywhere on the page.
    renderCoordinatorRoute();
    expect(screen.queryByTestId("ward-bar-place")).toBeNull();
    expect(screen.getByTestId("ward-bar-route-title")).toHaveTextContent("Command");
    expect(screen.getByTestId("ward-bar-subtitle")).toHaveTextContent("Statewide Bed Coordination");
    expect(screen.queryByTestId("ward-shell-header")).toBeNull();
    expect(screen.queryByTestId("ward-shell-place")).toBeNull();
  });

  it("exactly one role switcher renders on a real route — never zero, never two", async () => {
    // "Present" is not enough: a regression that mounted a second copy would show up only as a
    // count of 2, never as an absence `getByRole` would also catch.
    //
    // `WardBar`'s own copy lives inside its Tools drawer (a `<Sheet>`, which renders nothing at
    // all while closed — see the `beforeEach` above), so it must actually be opened by clicking
    // the real trigger, the same way a person — and `ui-ward-roles.spec.ts`'s own journey —
    // reaches it. A bare render without this click would find only whichever source is ALWAYS
    // visible and silently miss a second, drawer-hidden one.
    const user = userEvent.setup();
    renderWardRoute();
    await user.click(screen.getByTestId("ward-bar-tools-trigger"));
    await user.click(screen.getByRole("button", { name: "Demo" }));
    expect(screen.getAllByRole("button", { name: /change view/i })).toHaveLength(1);
  });
});
