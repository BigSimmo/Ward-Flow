"use client";

import { useEffect, useState } from "react";

import { useTheme } from "@/components/clinical-dashboard/use-theme";
import type { ThemePreference } from "@/lib/theme";

import {
  actionsForRole,
  actionsNotForRole,
  CATCHMENT_OPTIONS,
  roleById,
  SIGN_IN_ACTIONS,
  SIGN_IN_REFUSED,
  SIGN_IN_ROLES,
  type CatchmentId,
  type SignInRoleId,
} from "../ward-flow-sign-in-data";
import styles from "./sign-in-proposal.module.css";

/**
 * The app's own shift pattern (`SHIFT_PATTERN` in ward-operational-defaults.ts: 07:00, 15:00 and
 * 23:00). Written out here because this folder imports no ward-management code; the test
 * `ward-sign-in-proposal.test.ts` fails if the two ever disagree.
 */
export const SIGN_IN_PROPOSAL_SHIFTS = [
  { id: "day", label: "Day", hours: "07:00 to 15:00", startHour: 7, endHour: 15 },
  { id: "evening", label: "Evening", hours: "15:00 to 23:00", startHour: 15, endHour: 23 },
  { id: "night", label: "Night", hours: "23:00 to 07:00", startHour: 23, endHour: 7 },
] as const;

type ShiftId = (typeof SIGN_IN_PROPOSAL_SHIFTS)[number]["id"];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

/** Proposed sign-in: choose a role, see what it opens and can do, then go in. Reads no live state. */
export function SignInProposal() {
  const [chosen, setChosen] = useState<SignInRoleId>(SIGN_IN_ROLES[0].id);
  const [catchment, setCatchment] = useState<CatchmentId>("Statewide");
  const [shift, setShift] = useState<ShiftId>("day");
  const [pressed, setPressed] = useState(false);
  const { theme, preference, setPreference } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (previous === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous);
    };
  }, [theme]);

  const role = roleById(chosen);
  const can = actionsForRole(chosen);
  const cannot = actionsNotForRole(chosen);
  const shiftRow = SIGN_IN_PROPOSAL_SHIFTS.find((entry) => entry.id === shift)!;
  const catchmentRow = CATCHMENT_OPTIONS.find((entry) => entry.id === catchment)!;

  return (
    <div className={styles.wrap}>
      <div className={styles.previewBar} data-testid="sign-in-proposal-preview-bar">
        <strong>Proposed redesign (preview)</strong>
        <span>Sign in</span>
        <a href="./">Current sign in ›</a>
      </div>
      <main id="main-content" className={styles.page} data-testid="sign-in-proposal">
        <header className={styles.masthead}>
          <div>
            <p className={styles.brand}>Ward Flow · Mental health bed flow</p>
            <h1 className={styles.title}>Sign in</h1>
          </div>
          <div className={styles.chips}>
            <span className={styles.chip}>
              <span className={styles.chipDot} aria-hidden="true" />
              Synthetic prototype · no real patients
            </span>
            <div className={styles.segmented} role="group" aria-label="Appearance">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={preference === option.value}
                  onClick={() => setPreference(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <p className={styles.verdict}>
          Choose the role you are working as. Ward Flow opens on <strong>{role.opens}</strong> for {role.the}. This is a
          preview: it does not check who you are or grant access.
        </p>

        <div className={styles.layout}>
          <section className={styles.panel} aria-labelledby="role-heading">
            <div className={styles.panelHead}>
              <h2 id="role-heading" className={styles.panelTitle}>
                Your role
              </h2>
              <p className={styles.panelQuestion}>
                {SIGN_IN_ROLES.length} roles. Each opens on the screen it uses most.
              </p>
            </div>
            <div className={styles.roles} role="radiogroup" aria-labelledby="role-heading">
              {SIGN_IN_ROLES.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="radio"
                  aria-checked={candidate.id === chosen}
                  className={styles.role}
                  onClick={() => {
                    setChosen(candidate.id);
                    setPressed(false);
                  }}
                >
                  <span className={styles.tick} aria-hidden="true" />
                  <span className={styles.roleName}>{candidate.name}</span>
                  <span className={styles.roleSub}>{candidate.sub}</span>
                  <span className={styles.roleOpens}>
                    Opens on {candidate.opens} · can do {actionsForRole(candidate.id).length} of{" "}
                    {SIGN_IN_ACTIONS.length}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <aside className={`${styles.panel} ${styles.sticky}`} aria-label={`Signing in as ${role.as}`}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{role.name}</h2>
              <p className={styles.panelQuestion}>
                {catchmentRow.label} · {shiftRow.label} shift, {shiftRow.hours}
                {shiftRow.endHour < shiftRow.startHour ? " the next day" : ""}
              </p>
            </div>
            <div className={styles.panelBody}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Health service</span>
                <select
                  className={styles.select}
                  value={catchment}
                  onChange={(event) => setCatchment(event.target.value as CatchmentId)}
                >
                  {CATCHMENT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.field}>
                <span className={styles.fieldLabel} id="shift-label">
                  Shift
                </span>
                <div className={`${styles.segmented} ${styles.shifts}`} role="group" aria-labelledby="shift-label">
                  {SIGN_IN_PROPOSAL_SHIFTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={option.id === shift}
                      onClick={() => setShift(option.id)}
                    >
                      <span className={styles.shiftName}>{option.label}</span>
                      <span className={styles.shiftHours}>{option.hours}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  Can do <span className={styles.count}>{can.length}</span> of {SIGN_IN_ACTIONS.length}
                </span>
                <ul className={styles.list}>
                  {can.map((action) => (
                    <li key={action.words}>
                      <span className={styles.can} aria-hidden="true">
                        ✓
                      </span>
                      <span>{action.words}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {cannot.length > 0 ? (
                <details className={styles.disclosure}>
                  <summary>Cannot do ({cannot.length})</summary>
                  <ul className={styles.list}>
                    {cannot.map((action) => (
                      <li key={action.words}>
                        <span className={styles.cannot} aria-hidden="true">
                          –
                        </span>
                        <span>{action.words}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <button type="button" className={styles.primary} onClick={() => setPressed(true)}>
                Preview as {role.as}
              </button>
              <p className={styles.notWired} role="status">
                {pressed ? `Would open ${role.opens}. ` : ""}Not wired in this prototype.
              </p>

              <details className={styles.disclosure}>
                <summary>Refused to every role ({SIGN_IN_REFUSED.length})</summary>
                <ul className={styles.list}>
                  {SIGN_IN_REFUSED.map((entry) => (
                    <li key={entry.words}>
                      <span className={styles.cannot} aria-hidden="true">
                        –
                      </span>
                      <span>
                        <strong>{entry.words}.</strong> {entry.where}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </aside>
        </div>

        <p className={styles.footer}>
          Synthetic prototype. Every ward, bed, movement and figure is invented. Not a medical device and not clinical
          decision support. Role descriptions are examples; this preview does not enforce access.
        </p>
      </main>
    </div>
  );
}
