"use client";

import { Flag } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button, Card, CardHead, ListPicker, SrOnly, Switch } from "@/components/wf";
import { useUnscopedWardFlow } from "@/components/ward-management/shell/ward-access";
import { useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { WARD_FEATURE_FLAGS } from "@/components/ward-management/ward-feature-flags";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  SITE_FEATURE_SWITCH_ROLE,
  SITE_SWITCHABLE_FEATURES,
  mayChangeSiteFeatures,
  type SiteFeatureSwitchBy,
  type SiteSwitchableFeature,
} from "@/components/ward-management/ward-site-feature-switches";

import { SettingRow } from "./settings-rows";
import cardStyles from "./site-features-card.module.css";
import styles from "./settings.module.css";

const byLabel = (by: SiteFeatureSwitchBy) => (by === "admin" ? ACCESS_ROLE_LABELS.admin : WARD_FLOW_ROLE_LABELS[by]);

/**
 * FEATURES AT THIS SITE (Batch 4 item 20, drawn in the Batch 4 design review, approved by Josh on
 * 11 Nov 2026, D-142). The access admin's card: one switch per listed feature
 * (`SITE_SWITCHABLE_FEATURES`) for one site. One tap switches it for everyone at that site, with Undo
 * in the row and no "Are you sure?". Protected features are never listed; the foot line says so.
 *
 * The access admin is statewide, so the card names the site it changes: a site chooser heads the
 * list and starts empty, as the Give a role form does (audit, 31 Oct 2026), so no site is switched
 * because it was first in a list. Nobody but the access admin sees the card (D-142); the server also
 * lets the statewide coordinator switch, from no screen yet.
 */
export function SiteFeaturesCard() {
  const baseId = useId();
  const { desk } = useWardAccessSnapshot();
  const { units, now, siteFeatureSwitches, dispatch } = useUnscopedWardFlow();
  const sites = useMemo(
    () =>
      [...new Set(units.map((unit) => unit.siteCode))].map((code) => ({
        value: code,
        label: siteByCode(code)?.name ?? code,
      })),
    [units],
  );
  const [chosenSite, setChosenSite] = useState<string | null>(null);
  const siteCode = sites.find((site) => site.value === chosenSite)?.value;
  const [undo, setUndo] = useState<{ siteCode: string; feature: SiteSwitchableFeature; off: boolean } | null>(null);

  if (desk.role !== "admin" || !mayChangeSiteFeatures(desk)) return null;

  const send = (feature: SiteSwitchableFeature, off: boolean) => {
    if (siteCode === undefined) return;
    // D-142: sent under the engine's coordinator role; the record names the access admin.
    void wardRaise(
      dispatch,
      SITE_FEATURE_SWITCH_ROLE,
      now,
    )("SET_SITE_FEATURE_SWITCH", {
      siteCode,
      feature,
      off,
      byAccessAdmin: true,
    });
  };

  return (
    <Card aria-labelledby={`${baseId}-title`} data-setting="site-features" data-testid="ward-settings-site-features">
      <CardHead
        iconPlain
        id={`${baseId}-title`}
        icon={Flag}
        title="Features at this site"
        meta="Changes it for everyone here"
      />
      {/* Q36: the kit's picker, not a browser drop-down. It starts empty. */}
      <div className={cardStyles.sitePick} data-setting="site-features-site">
        <ListPicker
          label="Site"
          placeholder="Choose a site"
          required
          value={siteCode ?? null}
          onChange={(value) => {
            setChosenSite(value);
            setUndo(null);
          }}
          options={sites}
          testId="site-features-site"
        />
      </div>
      {SITE_SWITCHABLE_FEATURES.map((feature) => {
        const label = WARD_FEATURE_FLAGS[feature].label;
        const record =
          siteCode === undefined
            ? undefined
            : (siteFeatureSwitches ?? []).find((row) => row.siteCode === siteCode && row.feature === feature);
        const canUndo = undo !== null && undo.siteCode === siteCode && undo.feature === feature;
        return (
          <SettingRow
            key={feature}
            setting={`site-feature-${feature}`}
            testId={`site-feature-${feature}`}
            title={label}
            sub={
              siteCode === undefined
                ? "Choose a site first"
                : record
                  ? `Off for everyone here since ${formatInstantWithDay(record.at, now)} · ${byLabel(record.by)}`
                  : "On for everyone here"
            }
          >
            <span className={cardStyles.control}>
              {canUndo ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className={cardStyles.undo}
                  onClick={() => {
                    send(feature, !undo.off);
                    setUndo(null);
                  }}
                >
                  Undo<SrOnly> {label}</SrOnly>
                </Button>
              ) : null}
              <Switch
                className={cardStyles.switch}
                checked={siteCode !== undefined && !record}
                unavailable={siteCode === undefined}
                onCheckedChange={(on) => {
                  if (siteCode === undefined) return;
                  send(feature, !on);
                  setUndo({ siteCode, feature, off: !on });
                }}
                label={<SrOnly>{label}</SrOnly>}
              />
            </span>
          </SettingRow>
        );
      })}
      <p className={styles.cardNote}>Switching off hides it for everyone at this site straight away. No new release.</p>
      <p className={styles.cardNote}>Always on, so not listed: safety notices, legal times and ruling guards.</p>
    </Card>
  );
}
