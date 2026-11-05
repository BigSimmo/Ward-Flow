"use client";

import { UserRound } from "lucide-react";

import { SEED_UNITS, accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { SettingRow } from "@/components/ward-management/settings/settings-rows";
import { clock24 } from "@/components/ward-management/settings/settings-screen-model";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import type { Instant } from "@/components/ward-management/ward-clock";
import { accessIsWholeNetwork } from "@/components/ward-management/ward-role-access";
import { Card, CardHead } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";

/**
 * "You" (Settings by login, Josh 31 Oct 2026): what this login's screens include, the service in view
 * (statewide and service desks only) and the shift. Every line is read from what the app already
 * holds; nothing here is typed or saved. ST1 and DK1 (Josh, 3 Nov 2026): the band above already says
 * who you are, so the card does not repeat the name, and changing desk lives in the account menu on
 * the person button, so the card no longer carries "Switch login (demo)".
 */
export function SettingsProfileCard({ now }: { now: Instant }) {
  const access = useEffectiveWardAccess();
  const service = useServiceScope();
  const shift = currentShift(now);
  const shiftName = shift.name.charAt(0) + shift.name.slice(1).toLowerCase();
  const scope = accessIsWholeNetwork(access) ? "Whole network" : accessPlaceLabel(access, SEED_UNITS);
  // A desk held to one place picks no service; only statewide and service desks show the service in view.
  const picksService = access.scope.kind === "statewide" || access.scope.kind === "service";

  return (
    <Card aria-labelledby="profile-title" data-testid="ward-settings-profile-card" data-setting="role">
      <CardHead iconPlain id="profile-title" icon={UserRound} title="Your desk" />
      <div className={rx.profileGrid}>
        <SettingRow setting="profile-scope" title="What your screens include">
          <span className={styles.readout}>{scope}</span>
        </SettingRow>
        {picksService ? (
          <SettingRow
            setting="service"
            title="Service in view"
            sub="Set from the bar, not saved past this tab"
            testId="ward-settings-default-service"
          >
            <span className={styles.readout}>{service ?? "All services"}</span>
          </SettingRow>
        ) : null}
        <SettingRow setting="profile-shift" title="Shift now" sub="Default pattern">
          <span className={styles.readout}>
            {shiftName}, {clock24(shift.startMinute)} to {clock24(shift.endMinute)}
          </span>
        </SettingRow>
      </div>
    </Card>
  );
}
