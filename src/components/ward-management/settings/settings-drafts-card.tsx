"use client";

import { FilePen } from "lucide-react";
import { useEffect, useState } from "react";

import { useSettingsDeskProfile } from "@/components/ward-management/settings/settings-desk-profile";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import {
  listSessionDrafts,
  readSessionDraft,
  type SessionDraftSummary,
} from "@/components/ward-management/ward-session-drafts";
import { Button, Card, CardBody, CardHead, EmptyState } from "@/components/wf";

import { PATIENT_KEY_PREFIX } from "@/components/ward-management/referrals/referral-patient-key";

import styles from "./settings-drafts-card.module.css";

/** Wall-clock age, not the demo clock: a draft is kept in real time in this tab. */
function savedAgo(savedAt: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - savedAt) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}

/**
 * L12 (RF6 follow-up, Josh 3 Nov 2026): the last 20 drafts kept in this tab. Each row shows who it is
 * for, the desk and the time only. Typed text never appears here. A referral reopens in the drawer,
 * where the kept draft restores itself.
 */
export function SettingsDraftsCard() {
  const desk = useSettingsDeskProfile();
  const displayName = usePatientNameDisplay();
  const { patients } = useWardFlowSelect("patients");
  const [drafts, setDrafts] = useState<readonly SessionDraftSummary[]>([]);

  useEffect(() => {
    // Q6 (Josh, 4 Nov 2026): referral drafts only, as only they reopen from here.
    const read = () =>
      setDrafts(
        listSessionDrafts(Number.POSITIVE_INFINITY)
          .filter((draft) => draft.kind === "referral")
          .slice(0, 20),
      );
    read();
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, []);

  const who = (draft: SessionDraftSummary) => {
    const id = draft.subject === "new" ? chosenPatientId(draft.key) : draft.subject;
    if (!id) return "Patient not chosen yet";
    const patient = patients.find((entry) => entry.id === id);
    return patient ? displayName(patientDisplayName(patient), patient.umrn) : "Patient no longer listed";
  };

  return (
    <Card aria-labelledby="drafts-title" data-testid="ward-settings-drafts-card">
      <CardHead
        iconPlain
        id="drafts-title"
        icon={FilePen}
        title="Drafts"
        action={<span className={styles.scope}>This tab · last 20</span>}
      />
      {drafts.length ? (
        <CardBody>
          <ul className={styles.list}>
            {drafts.map((draft) => (
              <li key={draft.key} className={styles.row}>
                <span className={styles.what}>
                  <strong>{who(draft)}</strong>
                  <span>Referral · {desk.role}</span>
                </span>
                <span className={styles.time}>{savedAgo(draft.savedAt)}</span>
                <Button
                  variant="sec"
                  size="sm"
                  aria-label={`Open the referral draft for ${who(draft)}`}
                  onClick={() =>
                    openReferralSheet(raiseReferralHref(draft.subject === "new" ? {} : { patientId: draft.subject }))
                  }
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </CardBody>
      ) : (
        <EmptyState
          title="No drafts kept"
          meta="Close a referral with Keep draft and it shows here until this tab closes."
        />
      )}
    </Card>
  );
}

/** The patient a referral draft was started for, read from its record key only, never its typed text. */
function chosenPatientId(key: string): string | null {
  try {
    const kept: unknown = JSON.parse(readSessionDraft(key) ?? "null");
    const patientKey = (kept as { activePatientKey?: unknown } | null)?.activePatientKey;
    return typeof patientKey === "string" && patientKey.startsWith(PATIENT_KEY_PREFIX)
      ? patientKey.slice(PATIENT_KEY_PREFIX.length)
      : null;
  } catch {
    return null;
  }
}
