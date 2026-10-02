"use client";

import { useState, type FormEvent } from "react";
import { Activity, Layers, ListTodo, Sliders, UserPlus } from "lucide-react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardChip, WARD_CHIP_LEVELS, WardKindChip, WARD_KIND_CHIP_KINDS } from "@/components/ward-management/ward-chip";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { openWardDrawer, type WardDrawerId } from "@/components/ward-management/shell/ward-drawer-bus";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./sovereign-showcase.module.css";

type Density = "comfortable" | "compact";
type Feedback = { kind: "idle" | "error" | "success"; text: string };

const STATUS_LABELS = {
  urgent: "Urgent",
  routine: "Routine",
  stalled: "Stalled",
  accepted: "Accepted",
  enroute: "En route",
  cancelled: "Cancelled",
} as const;

const KIND_LABELS = {
  ward: "Ward",
  community: "Community",
  ed: "Emergency department",
  transport: "Transport",
} as const;

const DRAWERS = [
  { id: "referral", label: "Referral", icon: UserPlus },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "tools", label: "Tools", icon: Sliders },
  { id: "service", label: "Service selector", icon: Layers },
] as const satisfies readonly { id: WardDrawerId; label: string; icon: typeof UserPlus }[];

export function SovereignShowcaseScreen() {
  const [draftLabel, setDraftLabel] = useState("Example row");
  const [draftDensity, setDraftDensity] = useState<Density>("comfortable");
  const [appliedLabel, setAppliedLabel] = useState("Example row");
  const [appliedDensity, setAppliedDensity] = useState<Density>("comfortable");
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", text: "Change the example, then apply it." });

  function openExampleDrawer(id: WardDrawerId, label: string) {
    openWardDrawer(id);
    announceToWardShell("Opening " + label + ".");
  }

  function applyExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextLabel = draftLabel.trim();
    if (!nextLabel) {
      setFeedback({ kind: "error", text: "Enter a label to apply the example." });
      announceToWardShell("Example not applied. Enter a label.");
      return;
    }
    setAppliedLabel(nextLabel);
    setAppliedDensity(draftDensity);
    setFeedback({
      kind: "success",
      text: "Example applied locally. The first row label and table density now reflect your choices.",
    });
    announceToWardShell("Example applied locally.");
  }

  return (
    <main
      className={styles.workspace}
      id="main-content"
      data-ward-design="third-edition"
      aria-label="Design system showcase"
    >
      <section className={styles.heroBanner} aria-labelledby="showcase-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Ward Flow · Component reference</p>
          <h1 id="showcase-title">Design system showcase</h1>
          <p>
            A synthetic space to inspect shared surfaces, status language and interaction states. The example form and
            table change only on this page. Existing prototype drawer actions operate as usual.
          </p>
        </div>
        <div className={styles.heroAside}>
          <span className={styles.contextBadge}>Synthetic examples</span>
          <span className={styles.contextNote}>Example controls stay local</span>
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label="Showcase sections">
        <a href="#foundations">Foundations</a>
        <a href="#shared-components">Shared components</a>
        <a href="#interaction-example">Interaction example</a>
        <a href="#drawer-triggers">Drawer triggers</a>
      </nav>

      <div className={styles.topGrid}>
        <div id="foundations" tabIndex={-1} className={styles.anchorPanel}>
          <WardPanel title="Foundations" blurb="The type and colour roles used by this page." blurbInHeader>
            <div className={styles.panelBody}>
              <div className={styles.typeSamples} aria-label="Type scale examples">
                <div>
                  <span className={styles.sampleCaption}>Display</span>
                  <p className={styles.displaySample}>Clear hierarchy</p>
                </div>
                <div>
                  <span className={styles.sampleCaption}>Body</span>
                  <p className={styles.bodySample}>Readable detail for a working screen.</p>
                </div>
                <div>
                  <span className={styles.sampleCaption}>Label</span>
                  <p className={styles.labelSample}>EXAMPLE LABEL</p>
                </div>
              </div>
              <ul className={styles.swatchGrid} aria-label="Theme token swatches">
                <li>
                  <span className={styles.swatchSurface} aria-hidden="true" />
                  <span>
                    Surface <code>--surface</code>
                  </span>
                </li>
                <li>
                  <span className={styles.swatchInk} aria-hidden="true" />
                  <span>
                    Ink <code>--ink</code>
                  </span>
                </li>
                <li>
                  <span className={styles.swatchAccent} aria-hidden="true" />
                  <span>
                    Accent <code>--accent</code>
                  </span>
                </li>
                <li>
                  <span className={styles.swatchWarning} aria-hidden="true" />
                  <span>
                    Warning <code>--warn</code>
                  </span>
                </li>
              </ul>
            </div>
          </WardPanel>
        </div>

        <div id="shared-components" tabIndex={-1} className={styles.anchorPanel}>
          <WardPanel title="Shared components" blurb="Words carry the state and kind, alongside colour." blurbInHeader>
            <div className={styles.panelBody}>
              <div className={styles.exampleGroup}>
                <h3>Six status chips</h3>
                <div className={styles.chipFlow}>
                  {WARD_CHIP_LEVELS.map((level) => (
                    <WardChip key={level} level={level}>
                      {STATUS_LABELS[level]}
                    </WardChip>
                  ))}
                </div>
              </div>
              <div className={styles.exampleGroup}>
                <h3>Service kinds</h3>
                <div className={styles.chipFlow}>
                  {WARD_KIND_CHIP_KINDS.map((kind) => (
                    <WardKindChip key={kind} kind={kind}>
                      {KIND_LABELS[kind]}
                    </WardKindChip>
                  ))}
                </div>
              </div>
              <p className={styles.componentNote}>
                These are component examples. Their labels do not describe current clinical activity.
              </p>
            </div>
          </WardPanel>
        </div>
      </div>

      <div id="interaction-example" tabIndex={-1} className={styles.anchorPanel}>
        <WardPanel
          title="Interaction example"
          blurb="Change the first demonstration row label and the table density. Nothing is saved."
          blurbInHeader
        >
          <div className={styles.interactionGrid}>
            <form className={styles.exampleForm} onSubmit={applyExample} noValidate>
              <div className={styles.formHeading}>
                <h3>Local example controls</h3>
                <p>Empty input shows an error. A valid label updates the example table.</p>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="showcase-example-label">Example row label</label>
                  <input
                    id="showcase-example-label"
                    value={draftLabel}
                    maxLength={48}
                    onChange={(event) => setDraftLabel(event.target.value)}
                    aria-invalid={feedback.kind === "error"}
                    aria-describedby={feedback.kind === "error" ? "showcase-example-error" : "showcase-example-help"}
                  />
                  {feedback.kind === "error" ? (
                    <p id="showcase-example-error" className={styles.errorText}>
                      {feedback.text}
                    </p>
                  ) : (
                    <p id="showcase-example-help" className={styles.fieldHelp}>
                      Use a short, nonclinical sample label.
                    </p>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="showcase-density">Table density</label>
                  <select
                    id="showcase-density"
                    value={draftDensity}
                    onChange={(event) => setDraftDensity(event.target.value as Density)}
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                  <p className={styles.fieldHelp}>The chosen spacing applies after you press Apply.</p>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary}>
                  Apply example
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-disabled="true"
                  aria-describedby="showcase-disabled-reason"
                  title="Save preset — coming soon"
                  onClick={ignoreUnavailableActivation}
                >
                  Save preset
                </button>
              </div>
              <p id="showcase-disabled-reason" className={styles.disabledReason}>
                Save preset is unavailable because this demonstration has no saved presets.
              </p>
              {feedback.kind === "success" ? <p className={styles.successText}>{feedback.text}</p> : null}
            </form>

            <div className={styles.tableExample}>
              <div className={styles.tableHeading}>
                <div>
                  <h3>Shared table</h3>
                  <p>Demonstration rows only · {appliedDensity} density</p>
                </div>
                <span className={styles.exampleBadge}>Local preview</span>
              </div>
              <WardTable
                className={[styles.exampleTable, appliedDensity === "compact" ? styles.exampleTableCompact : ""]
                  .filter(Boolean)
                  .join(" ")}
                wrapperClassName={styles.exampleTableScroll}
                hasScrollThreshold
              >
                <caption className={styles.srOnly}>
                  Synthetic rows showing shared table, kind and status components
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Example</th>
                    <th scope="col">Kind</th>
                    <th scope="col">State</th>
                    <th scope="col">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{appliedLabel}</th>
                    <td>
                      <WardKindChip kind="ward">Ward</WardKindChip>
                    </td>
                    <td>
                      <WardChip level="routine">Routine</WardChip>
                    </td>
                    <td>Editable sample</td>
                  </tr>
                  <tr>
                    <th scope="row">Comparison row</th>
                    <td>
                      <WardKindChip kind="community">Community</WardKindChip>
                    </td>
                    <td>
                      <WardChip level="accepted">Accepted</WardChip>
                    </td>
                    <td>Static sample</td>
                  </tr>
                  <tr>
                    <th scope="row">Attention row</th>
                    <td>
                      <WardKindChip kind="ed">Emergency department</WardKindChip>
                    </td>
                    <td>
                      <WardChip level="stalled">Stalled</WardChip>
                    </td>
                    <td>Static sample</td>
                  </tr>
                </tbody>
              </WardTable>
            </div>
          </div>
        </WardPanel>
      </div>

      <div id="drawer-triggers" tabIndex={-1} className={styles.anchorPanel}>
        <WardPanel
          title="Drawer triggers"
          blurb="These open the existing shell drawers; the examples above remain on this page."
          blurbInHeader
        >
          <div className={styles.drawerGrid}>
            {DRAWERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={styles.drawerButton}
                onClick={() => openExampleDrawer(id, label)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>Open {label}</span>
              </button>
            ))}
          </div>
        </WardPanel>
      </div>

      <WardPrototypeFooter
        testId="ward-sovereign-governance"
        note="Synthetic design examples only. Local example controls do not change ward records."
      />
    </main>
  );
}
