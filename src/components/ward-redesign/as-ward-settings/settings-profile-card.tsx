"use client"; // Forked from src/components/ward-redesign/settings/settings-profile-card.tsx (role view: nurse in charge).

import { Layers, UserRound } from "lucide-react";

import { SEED_UNITS, accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { SettingRow } from "@/components/ward-management/settings/settings-rows";
import { useSettingsDeskProfile } from "@/components/ward-management/settings/settings-desk-profile";
import type { RowDensity } from "@/components/ward-management/settings/row-density";
import { clock24 } from "@/components/ward-management/settings/settings-screen-model";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import type { Instant } from "@/components/ward-management/ward-clock";
import { accessIsWholeNetwork } from "@/components/ward-management/ward-role-access";
import { Avatar, Badge, Button, Card, CardHead } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "@/components/ward-redesign/settings/settings-redesign.module.css";

/**
 * Profile and shift, joined to Display (settings redesign, review point 10). Every line is read from
 * what the app already holds: the desk profile Settings names in its band, the access in force, the
 * service chosen in the bar, the one shift pattern every screen uses, and this browser's appearance.
 * Nothing here is typed or saved; "Go to a desk" opens the same desk switcher as the band.
 */
export function SettingsProfileCard({
  now,
  onGoToDesk,
  themeLabel,
  rowDensity,
  railOpen,
}: {
  now: Instant;
  onGoToDesk: () => void;
  themeLabel: string;
  rowDensity: RowDensity;
  railOpen: boolean;
}) {
  const deskProfile = useSettingsDeskProfile();
  const access = useEffectiveWardAccess();
  const service = useServiceScope();
  const shift = currentShift(now);
  const shiftName = shift.name.charAt(0) + shift.name.slice(1).toLowerCase();
  const scope = accessIsWholeNetwork(access) ? "Whole network" : accessPlaceLabel(access, SEED_UNITS);
  // Role view (nurse in charge): the band above already names the person, role, desk and Go to a desk,
  // the Display card below shows the appearance, and a one-ward desk picks no service. The card keeps
  // only what is said nowhere else: the ward the screens show and the shift.
  const wardDesk = access.role === "ward";

  return (
    <Card aria-labelledby="profile-title" data-testid="ward-settings-profile-card">
      <CardHead
        iconPlain
        id="profile-title"
        icon={UserRound}
        title="Profile and shift"
        meta={wardDesk ? "Read only" : "Read from this desk. Nothing here is saved."}
        action={
          wardDesk ? undefined : (
            <Button variant="sec" size="sm" icon={Layers} className={styles.pill} onClick={onGoToDesk}>
              Go to a desk
            </Button>
          )
        }
      />
      {wardDesk ? null : (
        <div className={rx.profileWho}>
          <Avatar name={deskProfile.name} initials={deskProfile.initials} decorative />
          <span className={rx.profileName}>
            <strong>{deskProfile.name}</strong>
            <span>
              {deskProfile.role} · {deskProfile.location}
            </span>
          </span>
          <Badge size="sm" tone="neutral">
            Demo profile
          </Badge>
        </div>
      )}
      <div className={rx.profileGrid}>
        {wardDesk ? null : (
          <>
            <SettingRow setting="role" title="Role" sub="From sign-in once accounts exist">
              <span className={styles.readout}>{deskProfile.role}</span>
            </SettingRow>
            <SettingRow setting="profile-desk" title="Desk" sub="Where this desk sits">
              <span className={styles.readout}>{deskProfile.location}</span>
            </SettingRow>
          </>
        )}
        <SettingRow setting="profile-scope" title="Scope" sub="What this desk's screens include">
          <span className={styles.readout}>{scope}</span>
        </SettingRow>
        {wardDesk ? null : (
          <SettingRow
            setting="service"
            title="Service in view"
            sub="Set from the bar, not saved past this tab"
            testId="ward-settings-default-service"
          >
            <span className={styles.readout}>{service ?? "All services"}</span>
          </SettingRow>
        )}
        <SettingRow setting="profile-shift" title="Shift now" sub="The labelled default pattern, not a roster">
          <span className={styles.readout}>
            {shiftName}, {clock24(shift.startMinute)} to {clock24(shift.endMinute)}
          </span>
        </SettingRow>
        {wardDesk ? null : (
          <SettingRow setting="profile-appearance" title="Appearance" sub="Change it in Display below">
            <span className={styles.readout}>
              {themeLabel} · {rowDensity === "compact" ? "Compact" : "Comfortable"} rows ·{" "}
              {railOpen ? "Full" : "Compact"} sidebar
            </span>
          </SettingRow>
        )}
      </div>
    </Card>
  );
}
