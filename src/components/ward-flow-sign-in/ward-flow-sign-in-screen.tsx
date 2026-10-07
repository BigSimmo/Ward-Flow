"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ShieldCheck, UsersRound } from "lucide-react";

import { useTheme } from "@/components/clinical-dashboard/use-theme";
import { Badge, Button, Icon, IconTile, Kbd, Segmented, StatusGlyph, TabPanel, Tabs, ToastView } from "@/components/wf";
import type { ThemePreference } from "@/lib/theme";

import {
  actionsForRole,
  actionsNotForRole,
  CATCHMENT_OPTIONS,
  type CatchmentId,
  roleById,
  SHIFT_ROSTER_OPTIONS,
  type ShiftRosterId,
  SIGN_IN_ACTIONS,
  SIGN_IN_ACTION_NAMED,
  SIGN_IN_ACTION_NAMED_SHORT,
  SIGN_IN_READ_FIRST,
  SIGN_IN_REFUSED,
  SIGN_IN_ROLES,
  type SignInAction,
  type SignInRefused,
  type SignInRoleId,
} from "./ward-flow-sign-in-data";
import styles from "./ward-flow-sign-in-screen.module.css";

/**
 * WARD FLOW — SIGN IN AND ROLE.
 *
 * v6 (7 October 2026): rebuilt to `design/pages-v6/SignIn.png` from the `@/components/wf` kit. One
 * sheet in two halves: the chooser (catchment, shift, role, Preview) and the chosen role's reach
 * (Actions, and Limits and safety). The mockup's "Waiting for you" figures and AWST clock are left
 * out on purpose: this screen reads no live Ward Flow state (see below), so it has none to show.
 *
 * Drawing: `docs/ward-flow/mockups/sign-in-third-edition.html`. Contract:
 * `docs/ward-flow/build-contracts-2026-09-12/contract-sign-in.md`. **No route existed for this
 * screen anywhere in the app before this change** (measured: `src/app` and `ward-nav.ts` both came
 * back empty for "sign-in"/"signin") — this is a genuinely new build, not an upgrade, so there is
 * no "APP ONLY" list to preserve.
 *
 * 🔴 **THIS IS A ROLE PICKER, NEVER A CREDENTIAL SCREEN.** The drawing itself states, twice, that
 * it holds no password field "because a drawing of a tool must never be somewhere a real password
 * is typed", and that "Ward Flow signs a role in and never a person". This component contains no
 * `<input>` of any kind, no field the reader can type into, and dispatches nothing to any provider,
 * store or network request when "Sign in" is pressed — see the handler below. Do not add one.
 * `tests/ward-flow-sign-in-screen.dom.test.tsx` holds this boundary as a static assertion, the same
 * shape as `eslint-rules/no-hardcoded-hex.mjs`, scoped to this file so it cannot be silently
 * loosened by a change elsewhere.
 *
 * 🔴 **NOTHING HERE IS A CLAIM ABOUT WHAT THE RUNNING APP ENFORCES.** Contract §2, read directly
 * from the code: `ward-chrome-role.ts` states outright "WARD FLOW HAS NO SIGNED-IN ROLE… the role
 * IS the route you are on" and is "a chrome hint, never a permission"; `ward-flow-provider.tsx`
 * holds no current-role state at all (grepped directly: no `currentRole`/`activeRole` field, no
 * `localStorage`/`sessionStorage` read). So every sentence below that names what a role "can" or
 * "cannot" do is presented as what the Ward Flow **design system's screens index** assigns that
 * role — copying the drawing's own qualifying sentence in §"Who you are, and what you may do" and
 * in the disclaimer — never as a description of a permission boundary this build enforces. No
 * screen anywhere in this repository currently reads a chosen role to gate content.
 *
 * ⚠️ **NINE OF TWELVE WARD FLOW ELIGIBILITY GATES ARE OVERRIDABLE BY A COORDINATOR, WITH A
 * RECORDED REASON.** The one "refused to every role" item that touches an override
 * ("Overturn a fact about the world") is worded, in the drawing and here, as "a judgement about the
 * patient is the ONE KIND OF CHECK a coordinator can override, and only with a recorded reason" —
 * consistent with that ruling. Do not reword it to a bare "cannot override".
 *
 * 🔴 **NO SESSION, NO PERSISTENCE ACROSS RELOAD.** `chosen` below is ordinary `useState`, lost on
 * refresh, exactly like the drawing's own `chosen` variable. Consistent with owner ruling D-2 (no
 * account, session or person-who-logs-in is introduced by this build) and Q-8 (a reload wiping the
 * demonstration is the ruled default for this whole build).
 *
 * ⚠️ **"GO IN" STAYS INERT, AS DRAWN.** The drawing's own `#signIn` handler does not navigate; it
 * only announces what pressing it *would* open, and says so in its own note text ("Not wired in
 * this prototype"). Contract §5 states wiring this to a real destination is "a decision, not a
 * given" this contract does not make, because four of the drawing's seven roles (Coordinator on
 * call, Duty consultant, Governance lead, Service lead) have no distinct route the live app
 * recognises as a separate role home — see `ward-role-switcher.tsx`'s own comment on the same gap.
 * Left inert rather than guessed at.
 *
 * ⚠️ **STRUCTURALLY OUTSIDE `src/components/ward-management` AND
 * `src/app/mockups/ward-flow`, DELIBERATELY.** The drawing's own header comment says this screen is
 * "deliberately outside the shell of section 5.6" — no rail, no top bar — because "a person who has
 * not signed in has no rail to stand in and no bar to read" (owner ruling, 10 September 2026).
 * `src/app/mockups/ward-flow/layout.tsx` mounts `WardRail`/`WardBarMount`/`WardFlowProvider` around
 * every route beneath it with no per-route opt-out, so the only way to honour "no rail, no bar" is
 * a route outside that subtree — this file's own route,
 * `src/app/mockups/ward-flow-sign-in/page.tsx`, and this component beside it rather than inside
 * `ward-management`. `tests/ward-flow-seam.test.ts` (`WARD_DIRS`) treats those two directories as
 * Ward Flow's own folders and forbids anything outside them from importing ward code; this
 * component reads no live Ward Flow state and imports nothing from either directory, by design, so
 * that invariant is unaffected rather than routed around.
 *
 * ⚠️ **THE APPEARANCE CONTROL KEEPS THE APP'S REAL THEME PREFERENCE.** This standalone screen
 * composes the canonical third-edition Ward token layer, whose explicit light/dark selectors read
 * `data-theme` from the document root. The app's `useTheme()` remains the sole preference owner;
 * the short effect below mirrors its resolved theme into that attribute while this page is mounted
 * and restores the prior value on exit. This makes explicit Light win on a dark machine and lets
 * Auto continue to follow the app's existing media-query subscription without creating a second
 * preference, store or provider.
 */
export function WardFlowSignInScreen() {
  const [chosen, setChosen] = useState<SignInRoleId>(SIGN_IN_ROLES[0].id);
  const [selectedCatchment, setSelectedCatchment] = useState<CatchmentId>("Statewide");
  const [selectedShift, setSelectedShift] = useState<ShiftRosterId>("Morning");
  const [tab, setTab] = useState<"actions" | "limits">("actions");
  const [announcement, setAnnouncement] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const { theme, preference, setPreference } = useTheme();
  const roleGroupId = useId();

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);

    return () => {
      if (previousTheme === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previousTheme);
    };
  }, [theme]);

  const role = roleById(chosen);
  const canDo = useMemo(() => actionsForRole(chosen), [chosen]);
  const cannotDo = useMemo(() => actionsNotForRole(chosen), [chosen]);
  const catchment = CATCHMENT_OPTIONS.find((c) => c.id === selectedCatchment) ?? CATCHMENT_OPTIONS[0];
  const shift = SHIFT_ROSTER_OPTIONS.find((s) => s.id === selectedShift) ?? SHIFT_ROSTER_OPTIONS[0];
  const limitCount = SIGN_IN_REFUSED.length + SIGN_IN_READ_FIRST.length;

  // The reconciliation check the drawing itself runs on every render (script lines 4991-5045):
  // every role's two lists must add to the full action count, and every action must name at
  // least one role and have a NAMED entry. Kept as a live, derived check rather than a hardcoded
  // "these numbers are correct" sentence, so a future edit to the data above that breaks the
  // partition is visible on the page itself, not only in a test.
  const reconciliation = useMemo(() => {
    const problems: string[] = [];
    for (const candidate of SIGN_IN_ROLES) {
      const have = actionsForRole(candidate.id).length + actionsNotForRole(candidate.id).length;
      if (have !== SIGN_IN_ACTIONS.length) {
        problems.push(`${candidate.name} has two lists that do not add to ${SIGN_IN_ACTIONS.length}.`);
      }
    }
    for (const action of SIGN_IN_ACTIONS) {
      if (action.roles.length === 0) problems.push(`${action.words} names no role at all.`);
      if (!SIGN_IN_ACTION_NAMED[action.words]) problems.push(`${action.words} has nobody named for it.`);
    }
    return problems;
  }, []);

  const chooseRole = useCallback((id: SignInRoleId) => {
    setChosen(id);
    setToastOpen(false);
    const next = roleById(id);
    const can = actionsForRole(id).length;
    const cannot = actionsNotForRole(id).length;
    setAnnouncement(
      `${next.name} chosen. ${can} of ${SIGN_IN_ACTIONS.length} actions on this screen are named for this role, and ${
        cannot ? `${cannot} are named for another.` : "none are named for another."
      }`,
    );
  }, []);

  const pressSignIn = useCallback(() => {
    // Deliberately no navigation, no dispatch, no network call — see this component's own
    // header comment. The drawing's own handler is the same one line: announce what would open.
    setAnnouncement(
      `Sign in as ${role.as} would open ${role.opens}. Not wired in this prototype, so nothing has opened.`,
    );
    setToastOpen(true);
  }, [role]);

  // v6 (7 Oct 2026): the role list's number keys and the Preview button's Enter hint are real.
  // Digits pick a role unless the reader is typing; Enter previews only when no control has focus,
  // so it never steals a focused button's own Enter.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const index = Number(event.key) - 1;
      if (/^[1-9]$/.test(event.key) && SIGN_IN_ROLES[index]) {
        event.preventDefault();
        chooseRole(SIGN_IN_ROLES[index].id);
        return;
      }
      if (event.key === "Enter" && !target?.closest("button, a, summary, [role='tab'], [role='radio']")) {
        event.preventDefault();
        pressSignIn();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseRole, pressSignIn]);

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <p className={styles.brand}>
          <span className={styles.wordmark}>Ward Flow</span>
          <Badge size="sm">WA</Badge>
          <span className={styles.gov}>Government of Western Australia · Department of Health</span>
        </p>
        <div className={styles.look}>
          <h2 id="appearance-label" className="sr-only">
            Appearance
          </h2>
          <Segmented
            label="Appearance"
            items={APPEARANCE_OPTIONS}
            value={preference}
            onChange={(next) => setPreference(next)}
          />
        </div>
      </header>

      <div className={styles.sheet}>
        <section className={styles.chooser} aria-labelledby="sign-in-title">
          <div className={styles.titleRow}>
            <span className={styles.mark} aria-hidden="true">
              WF
            </span>
            <div className={styles.titleText}>
              <h1 id="sign-in-title" className={styles.title}>
                Sign in
              </h1>
              <p className={styles.subtitle}>Choose a role to preview</p>
            </div>
            <Badge tone="neutral">Role preview</Badge>
          </div>

          <details className={styles.notice}>
            <summary className={styles.noticeSummary}>
              <Icon icon={ShieldCheck} size={14} className={styles.noticeIcon} />
              <span className={styles.noticeText}>
                <strong>Synthetic data.</strong> No live link. No password field.
              </span>
              <span className={styles.noticeMore}>Details</span>
            </summary>
            <div className={styles.noticeBody}>
              <p>Ward Flow is a prototype, not a medical device and not clinical decision support.</p>
              <p>
                Every ward state, movement, referral, clock, count and figure on these screens is invented. The hospital
                sites and health services are real WA names.
              </p>
              <p>
                Ward Flow places nobody. A coordinator decides every placement and records it, and every figure here is
                to be checked against the ward&apos;s own record before anyone acts on it.
              </p>
              <p>
                The reach each role is given below is read from the screens index of the Ward Flow design system, which
                is a drawing of a tool. The live product&apos;s permissions are set outside Ward Flow.
              </p>
              <section aria-labelledby="sec-who">
                <h2 id="sec-who" className={styles.noticeHeading}>
                  Who you are, and what you may do
                </h2>
                <p>
                  Who you are is settled by the hospital&apos;s own sign on, which sits outside Ward Flow and is drawn
                  nowhere in this prototype. This screen holds no password field, because a drawing of a tool must never
                  be somewhere a real password is typed.
                </p>
                <p>
                  Role selection previews the drawing&apos;s workspace and actions. It does not sign anyone in or grant
                  permissions.
                </p>
              </section>
            </div>
          </details>

          <div className={styles.group}>
            <div className={styles.labelRow}>
              <span className={styles.label}>Catchment</span>
              <span className={styles.labelMeta}>{catchment.name}</span>
            </div>
            <Segmented
              label="Catchment"
              size="md"
              className={styles.fullSegmented}
              items={CATCHMENT_OPTIONS.map((option) => ({ id: option.id, label: option.id }))}
              value={selectedCatchment}
              onChange={(id) => {
                setSelectedCatchment(id);
                setAnnouncement(`Catchment set to ${CATCHMENT_OPTIONS.find((c) => c.id === id)?.name ?? id}.`);
              }}
            />
          </div>

          <div className={styles.group}>
            <div className={styles.labelRow}>
              <span className={styles.label}>Shift</span>
              <span className={styles.labelMeta}>{shift.hours}</span>
            </div>
            <Segmented
              label="Shift"
              size="md"
              className={styles.fullSegmented}
              items={SHIFT_ROSTER_OPTIONS.map((option) => ({ id: option.id, label: option.id }))}
              value={selectedShift}
              onChange={(id) => {
                setSelectedShift(id);
                setAnnouncement(`Shift set to ${SHIFT_ROSTER_OPTIONS.find((s) => s.id === id)?.name ?? id}.`);
              }}
            />
          </div>

          <section className={styles.group} aria-labelledby="sec-role">
            <div className={styles.labelRow}>
              <h2 id="sec-role" className={styles.label}>
                Your role
              </h2>
              <span className={styles.labelMeta}>Actions named, of {SIGN_IN_ACTIONS.length}</span>
            </div>
            <div className={styles.roleList} id={roleGroupId} role="group" aria-labelledby="sec-role">
              {SIGN_IN_ROLES.map((candidate, index) => {
                const n = actionsForRole(candidate.id).length;
                const isSelected = candidate.id === chosen;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    className={styles.roleRow}
                    aria-pressed={isSelected}
                    onClick={() => chooseRole(candidate.id)}
                    title={candidate.sub}
                  >
                    <span className={styles.radio} aria-hidden="true" />
                    <span className={styles.roleText}>
                      <span className={styles.roleName}>{candidate.name}</span>
                      <span className={styles.roleBrief}>{candidate.brief}</span>
                    </span>
                    <span className={styles.roleScope}>{candidate.scopeBadge}</span>
                    <span
                      className={styles.roleCount}
                      title={`Actions on this screen this role is named for, of ${SIGN_IN_ACTIONS.length} in all`}
                    >
                      {n} of {SIGN_IN_ACTIONS.length}
                    </span>
                    <Kbd className={styles.roleKey}>{index + 1}</Kbd>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.go} aria-labelledby="sec-go">
            <h2 id="sec-go" className="sr-only">
              Go in
            </h2>
            <span className={styles.goContext}>
              {catchment.id} · {shift.id} · {role.name}
            </span>
            <Button variant="pri" size="lg" kbd="Enter" onClick={pressSignIn}>
              Preview as {role.as}
            </Button>
          </section>
        </section>

        <section className={styles.reach} aria-labelledby="sec-chosen">
          <div className={styles.reachHead}>
            <IconTile icon={UsersRound} />
            <div className={styles.titleText}>
              <h2 id="sec-chosen" className={styles.reachTitle}>
                {role.name}
              </h2>
              <p className={styles.subtitle}>Opens {role.opens}</p>
            </div>
            <span className={styles.labelMeta}>
              {catchment.id} · {shift.id} shift
            </span>
          </div>

          <Tabs
            label={`What ${role.the} is named for`}
            idPrefix="sign-in"
            className={styles.tabs}
            value={tab}
            onChange={setTab}
            items={[
              { id: "actions", label: "Actions", count: `${canDo.length} of ${SIGN_IN_ACTIONS.length}` },
              { id: "limits", label: "Limits and safety", count: limitCount },
            ]}
          />

          {tab === "actions" ? (
            <TabPanel idPrefix="sign-in" id="actions" className={styles.panel}>
              <h3 id="sec-can" className="sr-only">
                What {role.the} can do, {canDo.length} of {SIGN_IN_ACTIONS.length}
              </h3>
              <ul className={styles.list} id="canList" aria-labelledby="sec-can">
                {canDo.length === 0 ? (
                  <li className={styles.none}>No action on this screen is named for this role.</li>
                ) : (
                  canDo.map((action) => (
                    <li className={styles.item} key={action.words} title={action.where}>
                      <StatusGlyph tone="success" size={10} />
                      <strong className={styles.itemWords}>
                        <ActionWords action={action} />
                      </strong>
                      <span className={styles.itemNote}>{action.place}</span>
                    </li>
                  ))
                )}
              </ul>
              <h3 id="sec-cant" className="sr-only">
                What {role.the} cannot do, {cannotDo.length} of {SIGN_IN_ACTIONS.length}
              </h3>
              <ul className={styles.list} id="cannotList" aria-labelledby="sec-cant">
                {cannotDo.length === 0 ? (
                  <li className={styles.none}>Every action on this screen is named for this role.</li>
                ) : (
                  cannotDo.map((action) => (
                    <li
                      className={`${styles.item} ${styles.itemOff}`}
                      key={action.words}
                      title={`The screens index names ${SIGN_IN_ACTION_NAMED[action.words] ?? "another role"} for this.`}
                    >
                      <StatusGlyph tone="closed" size={10} />
                      <span className={styles.itemWords}>
                        <ActionWords action={action} />
                      </span>
                      <span className={`${styles.itemNote} ${styles.itemNoteLine}`} aria-hidden="true">
                        Named for{" "}
                        {SIGN_IN_ACTION_NAMED_SHORT[action.words] ??
                          SIGN_IN_ACTION_NAMED[action.words] ??
                          "another role"}
                      </span>
                      <span className="sr-only">
                        . The screens index names {SIGN_IN_ACTION_NAMED[action.words] ?? "another role"} for this.
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </TabPanel>
          ) : (
            <TabPanel idPrefix="sign-in" id="limits" className={styles.panel}>
              <h3 id="sec-all" className={styles.panelHeading}>
                Refused to every role
                <span className="sr-only">, {SIGN_IN_REFUSED.length} in all</span>
              </h3>
              <LimitList list={SIGN_IN_REFUSED} tone="closed" labelledBy="sec-all" />
              <h3 id="sec-disc" className={styles.panelHeading}>
                Read this before you go in
              </h3>
              <LimitList list={SIGN_IN_READ_FIRST} tone="neutral" labelledBy="sec-disc" />
            </TabPanel>
          )}

          <p className={styles.check} data-ok={reconciliation.length === 0}>
            {reconciliation.length === 0 ? (
              <>
                <span className={styles.checkLead}>
                  <StatusGlyph tone="success" size={10} />
                  {SIGN_IN_ACTIONS.length} actions reconcile across {SIGN_IN_ROLES.length} roles
                </span>
                <span>Preview only, access is not enforced</span>
              </>
            ) : (
              <span className={styles.checkLead}>
                <StatusGlyph tone="warning" size={10} />
                {reconciliation.length} figures on this page disagree with each other.
              </span>
            )}
          </p>

          <div className={styles.toastDock} role="status" aria-live="polite">
            {toastOpen ? (
              <ToastView
                tone="info"
                title={`${role.name} would open ${role.opens}`}
                body="Not wired in this prototype, so nothing has opened."
                onClose={() => setToastOpen(false)}
                closeLabel="Dismiss preview note"
              />
            ) : (
              <span className="sr-only">{announcement}</span>
            )}
          </div>
        </section>
      </div>

      {/*
        Kept local rather than reusing WardPrototypeFooter: this screen sits outside
        src/components/ward-management on purpose and must import none of it (tests/ward-flow-seam.test.ts).
      */}
      <aside className={styles.footer} aria-label="Prototype disclosure" data-testid="ward-sign-in-governance">
        <span className={styles.footerBadge} data-ward-type-floor="badge">
          <StatusGlyph tone="neutral" size={10} />
          Synthetic prototype
        </span>
        <p className={styles.footerNote} data-ward-type-floor="banner">
          Every ward state, movement, referral, clock and figure on these screens is invented. Not a medical device and
          not clinical decision support.
        </p>
        <p className={styles.footerMeta}>No account or session is created</p>
      </aside>
    </main>
  );
}

/** The action's words, or its short form on screen with the full words for screen readers. */
function ActionWords({ action }: { action: SignInAction }) {
  if (!action.short) return <>{action.words}</>;
  return (
    <>
      <span aria-hidden="true">{action.short}</span>
      <span className="sr-only">{action.words}</span>
    </>
  );
}

function LimitList({
  list,
  tone,
  labelledBy,
}: {
  list: readonly SignInRefused[];
  tone: "closed" | "neutral";
  labelledBy: string;
}) {
  if (list.length === 0) {
    return <p className={styles.none}>Nothing on this screen is refused to every role.</p>;
  }
  return (
    <ul className={styles.list} aria-labelledby={labelledBy}>
      {list.map((item) => (
        <li className={styles.item} key={item.words} title={item.where}>
          <StatusGlyph tone={tone} size={10} />
          <span className={styles.itemWords}>{item.words}</span>
          <span className={styles.itemNote}>{item.brief}</span>
          <span className="sr-only">. {item.where}</span>
        </li>
      ))}
    </ul>
  );
}

const APPEARANCE_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Auto" },
];
