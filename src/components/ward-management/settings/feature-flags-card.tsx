"use client";

import { Flag } from "lucide-react";
import { useId } from "react";

import { Card, CardHead, SrOnly, Switch, buttonClass } from "@/components/wf";
import {
  setWardFeatureFlagOnDevice,
  useWardFeatureFlags,
} from "@/components/ward-management/shell/ward-feature-flag-store";
import { WARD_FEATURE_FLAG_NOTES } from "@/components/ward-management/ward-feature-flag-notes";
import { WARD_FEATURE_FLAG_SOURCE_LABELS, wardEnvironment } from "@/components/ward-management/ward-feature-flags";

import { SettingRow } from "./settings-rows";
import flagStyles from "./feature-flags-card.module.css";
import styles from "./settings.module.css";

/**
 * The visible list of feature flags (`ward-feature-flags.ts`): every unfinished feature that ships
 * switched off somewhere, who owns it, why it is on or off here, and what retires it. A switch here
 * changes this device only. In production the server alone decides, so the switches are greyed.
 */
export function FeatureFlagsCard() {
  const baseId = useId();
  const flags = useWardFeatureFlags();
  const environment = wardEnvironment();
  const deviceCanChange = flags.some((flag) => flag.deviceCanChange);
  const anyOnDevice = flags.some((flag) => flag.source === "device");

  return (
    <Card
      aria-labelledby={`${baseId}-feature-flags-title`}
      data-setting="feature-flags"
      data-testid="ward-settings-feature-flags"
    >
      <CardHead
        iconPlain
        id={`${baseId}-feature-flags-title`}
        icon={Flag}
        title="Feature flags"
        meta={`This site: ${environment}`}
        action={
          anyOnDevice ? (
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
              onClick={() => flags.forEach((flag) => setWardFeatureFlagOnDevice(flag.name, null))}
              data-testid="feature-flags-reset"
            >
              Use site defaults
            </button>
          ) : undefined
        }
      />
      {flags.map((flag) => (
        <SettingRow
          key={flag.name}
          setting={`flag-${flag.name}`}
          testId={`feature-flag-${flag.name}`}
          title={flag.definition.label}
          sub={`${WARD_FEATURE_FLAG_SOURCE_LABELS[flag.source]} · Owner ${WARD_FEATURE_FLAG_NOTES[flag.name].owner} · Added ${WARD_FEATURE_FLAG_NOTES[flag.name].added}`}
        >
          <Switch
            checked={flag.on}
            unavailable={!flag.deviceCanChange}
            onCheckedChange={(next) => {
              if (flag.deviceCanChange) setWardFeatureFlagOnDevice(flag.name, next);
            }}
            label={<SrOnly>{flag.definition.label}</SrOnly>}
          />
        </SettingRow>
      ))}
      <dl className={flagStyles.details} data-testid="feature-flags-details">
        {flags.map((flag) => (
          <div key={flag.name}>
            <dt>{flag.definition.label}</dt>
            <dd>{WARD_FEATURE_FLAG_NOTES[flag.name].description}</dd>
            <dd>Remove when: {WARD_FEATURE_FLAG_NOTES[flag.name].removeWhen}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.cardNote}>
        {deviceCanChange ? "Switches change this device only." : "Production: only the server setting changes a flag."}
      </p>
    </Card>
  );
}
