"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, X } from "lucide-react";

import { useTheme } from "@/components/clinical-dashboard/use-theme";
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
  SIGN_IN_REFUSED,
  SIGN_IN_ROLES,
  type SignInRefused,
  type SignInRoleId,
} from "./ward-flow-sign-in-data";
import styles from "./ward-flow-sign-in-screen.module.css";

/**
 * WARD FLOW — SIGN IN AND ROLE.
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
  const [announcement, setAnnouncement] = useState("");
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

  function chooseRole(id: SignInRoleId) {
    setChosen(id);
    const next = roleById(id);
    const can = actionsForRole(id).length;
    const cannot = actionsNotForRole(id).length;
    setAnnouncement(
      `${next.name} chosen. ${can} of ${SIGN_IN_ACTIONS.length} actions on this screen are named for this role, and ${
        cannot ? `${cannot} are named for another.` : "none are named for another."
      }`,
    );
  }

  function pressSignIn() {
    // Deliberately no navigation, no dispatch, no network call — see this component's own
    // header comment. The drawing's own handler is the same one line: announce what would open.
    setAnnouncement(
      `Sign in as ${role.as} would open ${role.opens}. Not wired in this prototype, so nothing has opened.`,
    );
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.portalMasthead}>
        <div className={styles.brandBlock}>
          <div className={styles.brandGov}>
            <span>Government of Western Australia</span>
            <span>·</span>
            <span>Department of Health</span>
            <span className={styles.waBadge}>WA</span>
          </div>
          <div className={styles.brandTitleRow}>
            <p className={styles.brand}>
              <b>Ward Flow</b>
              <span aria-hidden="true">WF</span>
            </p>
            <h1 id="sign-in-title" className={styles.title}>
              Sign in
            </h1>
            <span className={styles.brandSub}>Statewide Mental Health Bed Coordination</span>
          </div>
        </div>

        <div className={styles.mastheadControls}>
          <span className={styles.statusPill}>
            <span>Prototype role preview</span>
          </span>
          <span className={styles.statusPill}>
            <span>Synthetic service data · No live connection</span>
          </span>
          <div className={styles.themeGroup} role="group" aria-label="Appearance Mode">
            <AppearanceGroup preference={preference} onChange={setPreference} />
          </div>
        </div>
      </header>

      <section className={styles.card} aria-labelledby="sign-in-title">
        {/* Operational Context Setup: Catchment & Shift */}
        <div className={styles.contextStrip} aria-label="Operational Shift Context">
          <div className={styles.contextCol}>
            <span className={styles.contextColLabel}>Health Service Catchment</span>
            <div className={styles.pillGroup} role="group" aria-label="Health Service Catchment">
              {CATCHMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.contextBtn} ${opt.svcClass ? styles[opt.svcClass] : ""}`}
                  aria-pressed={selectedCatchment === opt.id}
                  onClick={() => {
                    setSelectedCatchment(opt.id);
                    setAnnouncement(`Catchment set to: ${opt.name}`);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.contextCol}>
            <span className={styles.contextColLabel}>Active Shift Roster</span>
            <div className={styles.pillGroup} role="group" aria-label="Active Shift Roster">
              {SHIFT_ROSTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={styles.contextBtn}
                  aria-pressed={selectedShift === opt.id}
                  onClick={() => {
                    setSelectedShift(opt.id);
                    setAnnouncement(`Shift set to: ${opt.name}`);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <section className={styles.safety} aria-labelledby="sec-disc">
            <div>
              <h2 id="sec-disc" className={styles.sectionHeading}>
                Read this before you go in
              </h2>
              <p className={styles.lead}>Prototype data only. Confirm every figure against the ward record.</p>
            </div>
            <details className={styles.safetyDisclosure}>
              <summary>Safety and access details</summary>
              <div className={styles.disclaimer}>
                <p>Ward Flow is a prototype, not a medical device and not clinical decision support.</p>
                <p>
                  Every ward state, movement, referral, clock, count and figure on these screens is invented. The
                  hospital sites and health services are real WA names.
                </p>
                <p>
                  Ward Flow places nobody. A coordinator decides every placement and records it, and every figure here
                  is to be checked against the ward&apos;s own record before anyone acts on it.
                </p>
                <p>
                  The reach each role is given below is read from the screens index of the Ward Flow design system,
                  which is a drawing of a tool. The live product&apos;s permissions are set outside Ward Flow.
                </p>
                <section aria-labelledby="sec-who">
                  <h2 id="sec-who" className={styles.sectionHeading}>
                    Who you are, and what you may do
                  </h2>
                  <p>
                    Who you are is settled by the hospital&apos;s own sign on, which sits outside Ward Flow and is drawn
                    nowhere in this prototype. This screen holds no password field, because a drawing of a tool must
                    never be somewhere a real password is typed.
                  </p>
                  <p>
                    What Ward Flow settles is the role, and the role is a set of permissions. Ward Flow signs a role in
                    and never a person.
                  </p>
                </section>
              </div>
            </details>
          </section>

          {/* Third Edition Role Selection Section */}
          <section className={styles.sectionHeader} aria-labelledby="sec-role">
            <div>
              <h2 id="sec-role" className={styles.sectionTitle}>
                <span>Your role</span>
                <span className={styles.subtleDash}> · </span>
                <span>Select Operational Shift Role</span>
              </h2>
              <div className={styles.sectionSub}>
                Choose a role to preview its workspace. This does not verify identity or grant access.
              </div>
            </div>
            <span className={styles.sectionMeta} id="roleGridTally">
              {SIGN_IN_ROLES.length} Roles Registered · 1 Selected
            </span>
          </section>

          {/* Third Edition Role Grid */}
          <div className={styles.roleGrid} id={roleGroupId} role="group" aria-labelledby="sec-role">
            {SIGN_IN_ROLES.map((candidate) => {
              const n = actionsForRole(candidate.id).length;
              const isSelected = candidate.id === chosen;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  className={styles.roleCard}
                  aria-pressed={isSelected}
                  onClick={() => chooseRole(candidate.id)}
                >
                  <div className={styles.roleBadgeRow}>
                    <span className={styles.roleScopeBadge}>{candidate.scopeBadge}</span>
                    <span className={styles.roleActiveIndicator} aria-hidden="true" />
                  </div>
                  <div className={styles.roleTitle}>{candidate.name}</div>
                  <div className={styles.roleDesc}>{candidate.sub}</div>
                  <div className={styles.roleMetaRow}>
                    <span
                      className={styles.roleTag}
                      title={`Actions on this screen this role is named for, of ${SIGN_IN_ACTIONS.length} in all`}
                    >
                      {n} of {SIGN_IN_ACTIONS.length}
                    </span>
                    <span className={styles.roleTargetChip}>{candidate.targetChip}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Third Edition Interactive Permissions Inspector */}
          <section className={styles.permInspector} id="permInspector" aria-label="Operational Authority Scope">
            <div className={styles.permHeader}>
              <div className={styles.permHeaderTitle}>
                <span>Operational Authority Scope</span>
                <span>·</span>
                <span style={{ color: "var(--accent-ink)", fontWeight: 700 }}>{role.name}</span>
              </div>
              <span className={styles.permHeaderTarget} id="permTargetBadge">
                Workspace: {role.targetChip}
              </span>
            </div>

            <div className={styles.permGrid}>
              {/* What this role can do */}
              <div className={styles.permCol}>
                <div className={styles.permColHead}>
                  <h2 id="sec-can" className={`${styles.permColLabel} ${styles.good}`}>
                    <span>What {role.the} can do</span>
                  </h2>
                  <span className={`${styles.permBadge} ${styles.good}`} id="canBadge">
                    {canDo.length} of {SIGN_IN_ACTIONS.length}
                  </span>
                </div>
                <ul className={styles.permItems} id="canList">
                  {canDo.length === 0 ? (
                    <li className={styles.noneRow}>No action on this screen is named for this role.</li>
                  ) : (
                    canDo.map((action) => (
                      <li className={styles.permItem} key={action.words}>
                        <span className={`${styles.permIcon} ${styles.good}`} aria-hidden="true">
                          <Check aria-hidden="true" size={14} />
                        </span>
                        <div className={styles.permItemContent}>
                          <strong className={styles.permItemWords}>{action.words}</strong>
                          <span className={styles.permItemDesc}>{action.where}</span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* What this role cannot do */}
              <div className={styles.permCol}>
                <div className={styles.permColHead}>
                  <h2 id="sec-cant" className={`${styles.permColLabel} ${styles.boundary}`}>
                    <span>What {role.the} cannot do</span>
                  </h2>
                  <span className={`${styles.permBadge} ${styles.boundary}`} id="cannotBadge">
                    {cannotDo.length} of {SIGN_IN_ACTIONS.length}
                  </span>
                </div>
                <details className={styles.permissionDisclosure}>
                  <summary>Review restrictions ({cannotDo.length})</summary>
                  <ul className={styles.permItems} id="cannotList">
                    {cannotDo.length === 0 ? (
                      <li className={styles.noneRow}>Every action on this screen is named for this role.</li>
                    ) : (
                      cannotDo.map((action) => (
                        <li className={styles.permItem} key={action.words}>
                          <span className={`${styles.permIcon} ${styles.boundary}`} aria-hidden="true">
                            <X aria-hidden="true" size={14} />
                          </span>
                          <div className={styles.permItemContent}>
                            <strong className={styles.permItemWords}>{action.words}</strong>
                            <span className={styles.permItemDesc}>
                              The screens index names {SIGN_IN_ACTION_NAMED[action.words] ?? "another role"} for this.
                            </span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <p className={styles.note}>
                    Each row names the role the screens index gives that action to. The index also names triage, the
                    incoming coordinator and a community team.
                  </p>
                </details>
              </div>
            </div>
          </section>

          {/* Lower Governance and Action Sections */}
          <div className={styles.lowerSections}>
            <section className={styles.permissionPanel} aria-labelledby="sec-all">
              <h2 id="sec-all" className={styles.sectionHeading}>
                <span>Refused to every role</span>
                <span className={styles.count}>{SIGN_IN_REFUSED.length} in all</span>
              </h2>
              <details className={styles.permissionDisclosure}>
                <summary>Review universal limits</summary>
                <RefusedList list={SIGN_IN_REFUSED} />
              </details>
            </section>

            <p className={styles.checkLine} data-ok={reconciliation.length === 0}>
              {reconciliation.length === 0 ? (
                <span>Role descriptions are examples; access is not enforced by this preview.</span>
              ) : (
                <span>{reconciliation.length} figures on this page disagree with each other.</span>
              )}
            </p>

            <section className={styles.selectedRole} aria-labelledby="sec-go">
              <div>
                <p className={styles.eyebrow}>Selected role</p>
                <h2 id="sec-go">Go in</h2>
                <p className={styles.selectedName}>{role.name}</p>
                <p className={styles.selectedNote}>Role preview only. No account or session is created.</p>
              </div>
              <button type="button" className={styles.primaryButton} onClick={pressSignIn}>
                Preview as {role.as}
              </button>
              <p className={announcement === "" ? styles.srOnly : styles.actionStatus} role="status" aria-live="polite">
                {announcement}
              </p>
            </section>
          </div>
        </div>

        <footer className={styles.cardFooter}>
          <div className={styles.footerSessionInfo}>
            <div className={styles.sessionMetaLine}>
              <span>Selected preview context</span>
              <span>·</span>
              <span>No directory connection</span>
            </div>
            <div className={styles.sessionDetailLine}>
              <span>{CATCHMENT_OPTIONS.find((c) => c.id === selectedCatchment)?.name}</span>
              <span> · </span>
              <span>{SHIFT_ROSTER_OPTIONS.find((s) => s.id === selectedShift)?.name}</span>
            </div>
          </div>
        </footer>

        <div className={styles.foot}>
          <div className={styles.footRow}>
            <h2 id="appearance-label" className={styles.footHeading}>
              Appearance
            </h2>
            <AppearanceGroup preference={preference} onChange={setPreference} />
          </div>
          <p className={styles.note}>Light, dark or automatic, remembered for this browser only.</p>
        </div>
      </section>

      {/* Mandatory Prototype Disclosure */}
      <aside className={styles.prototypeNotice} aria-label="Prototype Disclosure">
        <p>
          Every ward state, movement, referral, clock and figure on these screens is invented. Not a medical device and
          not clinical decision support.
        </p>
        <p className={styles.auditMeta}>
          Western Australia Health Mental Health Directorate · Prototype Third Edition · Reference Model
        </p>
      </aside>
    </main>
  );
}

function RefusedList({ list }: { list: readonly SignInRefused[] }) {
  if (list.length === 0) {
    return <p className={styles.noneRow}>Nothing on this screen is refused to every role.</p>;
  }
  return (
    <div className={styles.rows}>
      {list.map((item) => (
        <div className={styles.row} key={item.words}>
          <p className={styles.rowTop}>
            <strong>{item.words}</strong>
          </p>
          <p className={styles.rowSub}>{item.where}</p>
        </div>
      ))}
    </div>
  );
}

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

function AppearanceGroup({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (next: ThemePreference) => void;
}) {
  return (
    <div className={styles.appearance} role="group" aria-labelledby="appearance-label">
      {APPEARANCE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.appearanceButton}
          aria-pressed={preference === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
