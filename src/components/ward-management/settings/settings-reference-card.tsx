"use client";
// Settings round 3 (mock-up, 30 Oct 2026): the read-only Reference card, copied unchanged from
// DataPane in src/components/ward-management/settings/settings-panes.tsx so the Help and data tab can
// place it beside About. Words are kept as today's.

import { Gauge } from "lucide-react";

import { clinicalValueStatusText, formatClinicalFigure } from "@/components/ward-management/ward-clinical-values";
import {
  CLINICAL_VALUE_LIST,
  unsignedClinicalValueCount,
} from "@/components/ward-management/ward-clinical-value-notes";
import { OPERATIONAL_DEFAULTS } from "@/components/ward-management/ward-operational-defaults";
import type { ReferenceTab } from "@/components/ward-management/settings/settings-panes";
import type { PublishedThreshold, ThresholdState } from "@/components/ward-management/settings/settings-thresholds";
import { Card, CardHead, Segmented, StatusGlyph, TabPanel, Tabs, useIsPhone } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";

const THRESHOLD_STATE_WORDS: Record<ThresholdState, string> = {
  "fires-now": "Showing now",
  "nothing-reaches-it": "Nothing reaches it today",
};

type PhoneReference = Extract<ReferenceTab, "defaults" | "clinical">;

/** The clinical values on a phone: the desktop table's rows as a list, grouped the same way. */
// D-56 signs values for the prototype only; D-54 still needs clinical governance sign-off for real use.
function ClinicalValuesNote() {
  const unsigned = unsignedClinicalValueCount();
  return (
    <p className={styles.cardNote} data-tone="accent">
      {unsigned === 0
        ? `All ${CLINICAL_VALUE_LIST.length} values are signed for the prototype only.`
        : `${unsigned} of ${CLINICAL_VALUE_LIST.length} values are still synthetic. The rest are signed for the prototype only.`}{" "}
      Every value still needs clinical governance sign-off before real patient use.
    </p>
  );
}

function PhoneClinicalValues() {
  const groups = [...new Set(CLINICAL_VALUE_LIST.map((entry) => entry.group))];
  return (
    <div data-testid="ward-settings-clinical-values-phone" data-setting="clinical-values">
      <ClinicalValuesNote />
      {groups.map((group) => (
        <section key={group} className={styles.phoneClinicalGroup} aria-label={group}>
          <h3 className={styles.phoneClinicalGroupHead}>{group}</h3>
          <dl className={styles.defaultsGrid}>
            {CLINICAL_VALUE_LIST.filter((entry) => entry.group === group).map((entry) => (
              <div
                key={entry.id}
                data-testid={`ward-settings-clinical-value-phone-${entry.id}`}
                data-clinical-status={entry.status}
              >
                <dt>{entry.name}</dt>
                <dd>
                  {formatClinicalFigure(entry.value, entry.unit)}
                  {entry.adjustable ? ", default, changeable in Settings" : null}
                </dd>
                <dd className={styles.phoneClinicalMeta}>
                  <StatusGlyph tone={entry.status === "signed" ? "success" : "neutral"} size={9} />
                  {clinicalValueStatusText(entry)}. {entry.source}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function SettingsReferenceCard({
  reference,
  onReferenceChange,
  thresholds,
}: {
  reference: ReferenceTab;
  onReferenceChange: (next: ReferenceTab) => void;
  thresholds: readonly PublishedThreshold[] | null;
}) {
  const isPhone = useIsPhone();
  const phoneReference: PhoneReference = reference === "clinical" ? "clinical" : "defaults";
  return (
    <Card aria-labelledby="reference-title" data-setting="thresholds">
      <CardHead
        iconPlain
        id="reference-title"
        icon={Gauge}
        title="Reference"
        meta="Read only"
        action={
          isPhone ? undefined : (
            <Tabs
              label="Reference"
              idPrefix="settings-reference"
              value={reference}
              onChange={onReferenceChange}
              items={[
                { id: "thresholds", label: "Thresholds" },
                { id: "defaults", label: "Fixed defaults", count: OPERATIONAL_DEFAULTS.length },
                { id: "clinical", label: "Clinical values", count: CLINICAL_VALUE_LIST.length },
              ]}
            />
          )
        }
      />
      {isPhone ? (
        <>
          <p className={styles.cardNote} data-testid="ward-settings-thresholds-phone">
            The thresholds table is laid out for a tablet or computer.
          </p>
          {/* Josh, 15 Oct 2026 (phone mockup B): a two-way switch swaps Fixed defaults for the
              clinical values, listed in the desktop table's groups. Phone only. */}
          <Segmented<PhoneReference>
            label="Reference list"
            size="md"
            className={styles.phoneReferenceSwitch}
            value={phoneReference}
            onChange={onReferenceChange}
            items={[
              { id: "defaults", label: "Fixed defaults" },
              { id: "clinical", label: "Clinical values", count: CLINICAL_VALUE_LIST.length },
            ]}
          />
          {phoneReference === "clinical" ? <PhoneClinicalValues /> : null}
        </>
      ) : null}
      <TabPanel idPrefix="settings-reference" id="thresholds" hidden={isPhone || reference !== "thresholds"}>
        {thresholds === null ? (
          <p className={styles.cardNote} data-testid="ward-settings-thresholds-unavailable">
            Record-based threshold status unavailable. Executive reporting does not expose the individual records used
            to calculate “right now” threshold rows. All twelve public rule values remain available in Rules.
          </p>
        ) : (
          <div data-testid="ward-settings-thresholds">
            <p className={styles.cardNote} data-tone="accent">
              Figures here change only in Rules, and every change is recorded.
            </p>
            <div className={styles.tableWrap} role="region" aria-label="Published thresholds" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Figure</th>
                    <th scope="col">Triggers</th>
                    <th scope="col">Right now</th>
                    <th scope="col">Set by</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((threshold) => (
                    <tr key={threshold.id} data-testid={`ward-settings-threshold-${threshold.id}`}>
                      <td className={styles.cellStrong}>{threshold.figure}</td>
                      <td>{threshold.triggers}</td>
                      <td data-threshold-state={threshold.state}>
                        <span className={styles.readout}>
                          <StatusGlyph tone={threshold.state === "fires-now" ? "warning" : "neutral"} size={9} />
                          {THRESHOLD_STATE_WORDS[threshold.state]}
                          {threshold.state === "fires-now" ? `, ${threshold.reached}` : null}
                        </span>
                      </td>
                      <td>{threshold.setBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabPanel>
      <TabPanel idPrefix="settings-reference" id="clinical" hidden={isPhone || reference !== "clinical"}>
        {/* Josh, 15 Oct 2026 (item 6): every clinical value with its status, read from
            `ward-clinical-values.ts`. Read only; a value is signed in that file, never here. */}
        <div data-testid="ward-settings-clinical-values" data-setting="clinical-values">
          <ClinicalValuesNote />
          <div className={styles.tableWrap} role="region" aria-label="Clinical values" tabIndex={0}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Clinical values and sign-off status</caption>
              <thead>
                <tr>
                  <th scope="col">Rule</th>
                  <th scope="col">Value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {CLINICAL_VALUE_LIST.map((entry) => (
                  <tr
                    key={entry.id}
                    data-testid={`ward-settings-clinical-value-${entry.id}`}
                    data-clinical-status={entry.status}
                  >
                    <td className={styles.cellStrong}>{entry.name}</td>
                    <td className={styles.mono}>
                      {formatClinicalFigure(entry.value, entry.unit)}
                      {entry.adjustable ? ", default, changeable in Settings" : null}
                    </td>
                    <td>
                      <span className={styles.readout}>
                        <StatusGlyph tone={entry.status === "signed" ? "success" : "neutral"} size={9} />
                        {clinicalValueStatusText(entry)}
                      </span>
                    </td>
                    <td>{entry.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TabPanel>
      <TabPanel
        idPrefix="settings-reference"
        id="defaults"
        hidden={isPhone ? phoneReference !== "defaults" : reference !== "defaults"}
      >
        <dl className={styles.defaultsGrid} aria-label="Fixed defaults" data-setting="fixed-defaults">
          {OPERATIONAL_DEFAULTS.map((item) => (
            <div key={item.name} data-testid={`ward-settings-operational-default-${item.name}`}>
              <dt>{item.name}</dt>
              <dd>{item.display}</dd>
            </div>
          ))}
        </dl>
      </TabPanel>
    </Card>
  );
}
