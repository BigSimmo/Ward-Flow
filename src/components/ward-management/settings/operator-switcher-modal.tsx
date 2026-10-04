"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";

import { edHref, teamHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { useWardModalFocus } from "../ward-modal-focus";

import styles from "./settings.module.css";

export interface OperatorStation {
  readonly group: string;
  readonly label: string;
  readonly path: string;
  readonly avatarText?: string;
  readonly avatarTone?: "coordinator" | "ward" | "ed" | "community" | "transport";
  readonly description?: string;
}

export const OPERATOR_STATIONS: readonly OperatorStation[] = [
  {
    group: "Central Coordinator",
    label: "State Bed Flow Coordinator",
    path: "/mockups/ward-flow",
    avatarText: "BC",
    avatarTone: "coordinator",
    description: "Perth Central Bed Flow Desk — statewide allocation authority and escalation triage.",
  },
  {
    group: "Ward NUMs",
    label: "Moodjar (Armadale Adult Open)",
    path: unitHref("arm-adult-open"),
    avatarText: "MJ",
    avatarTone: "ward",
    description: "Inpatient open unit — clinical nursing manager, bed status, and discharge intake.",
  },
  {
    group: "Ward NUMs",
    label: "Murchison (FSH Adult Secure)",
    path: unitHref("fsh-adult-secure"),
    avatarText: "MC",
    avatarTone: "ward",
    description: "Inpatient secure unit — high-acuity nursing oversight and legal form tracking.",
  },
  {
    group: "Ward NUMs",
    label: "All Wards Matrix",
    path: "/mockups/ward-flow/wards",
    avatarText: "WM",
    avatarTone: "ward",
    description: "Statewide inpatient bed matrix — real-time ward capacity and occupancy grid.",
  },
  {
    group: "ED Liaisons",
    label: "Royal Perth Hospital ED",
    path: edHref("rph-ed"),
    avatarText: "RP",
    avatarTone: "ed",
    description: "Inner-city emergency department liaison — mental health triage and rapid pull.",
  },
  {
    group: "ED Liaisons",
    label: "Fiona Stanley Hospital ED",
    path: edHref("fsh-ed"),
    avatarText: "FS",
    avatarTone: "ed",
    description: "Tertiary emergency department liaison — acute referral intake and delay monitoring.",
  },
  {
    group: "Community",
    label: "Midland Community Mental Health",
    path: teamHref("midland"),
    avatarText: "MD",
    avatarTone: "community",
    description: "Community clinical treatment team — step-down placement and outpatient transition.",
  },
  {
    group: "Transport",
    label: "Patient Transport Officer",
    path: "/mockups/ward-flow/transport/officer",
    avatarText: "PT",
    avatarTone: "transport",
    description: "Statewide patient transport logistics — vehicle dispatch and transfer transit status.",
  },
];

export interface OperatorSwitcherModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onNavigate?: (path: string) => void;
}

function useSafeRouter(): { push: (path: string) => void } | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

function useSafePathname(): string {
  try {
    return usePathname() || "";
  } catch {
    return "";
  }
}

export function OperatorSwitcherModal({ isOpen, onClose, onNavigate }: OperatorSwitcherModalProps) {
  const router = useSafeRouter();
  const currentPath = useSafePathname();
  const dialogRef = useRef<HTMLDivElement>(null);

  useWardModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const handleStationClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (router?.push) {
      router.push(path);
    } else if (typeof window !== "undefined") {
      window.location.assign(path);
    }
    onClose();
  };

  // Group stations by their group name
  const groupedStations = OPERATOR_STATIONS.reduce<Record<string, OperatorStation[]>>((acc, station) => {
    if (!acc[station.group]) {
      acc[station.group] = [];
    }
    acc[station.group].push(station);
    return acc;
  }, {});

  return (
    <div
      className={styles.modalOverlay}
      data-testid="ward-operator-switcher-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.operatorModalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-switcher-title"
      >
        <header className={styles.modalHeader}>
          <div className={styles.operatorHeaderMeta}>
            <h3 id="operator-switcher-title" className={styles.modalTitle}>
              Switch Clinical Role &amp; Operator Station
            </h3>
            <p className={styles.operatorHeaderSub}>
              Select a clinical workstation to simulate immediate role and perspective handoff.
            </p>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={onClose} aria-label="Close operator switcher">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.operatorModalBody}>
          <div className={styles.stationGroups}>
            {Object.entries(groupedStations).map(([groupName, stations]) => (
              <section key={groupName} className={styles.stationGroupSection} aria-label={groupName}>
                <h4 className={styles.stationGroupTitle}>{groupName}</h4>
                <div className={styles.stationGrid}>
                  {stations.map((station) => {
                    const isCurrent = currentPath === station.path;
                    return (
                      <button
                        key={station.path}
                        type="button"
                        className={`${styles.stationBtn} ${isCurrent ? styles.stationBtnActive : ""}`}
                        onClick={() => handleStationClick(station.path)}
                        data-testid={`station-${station.path.replace(/\//g, "-").replace(/^-/, "")}`}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        {station.avatarText && (
                          <div className={styles.stationAvatar} data-tone={station.avatarTone || "coordinator"}>
                            <span>{station.avatarText}</span>
                          </div>
                        )}
                        <div className={styles.stationBtnContent}>
                          <div className={styles.stationHeaderLine}>
                            <span className={styles.stationLabel}>{station.label}</span>
                            {isCurrent && (
                              <span className={styles.currentStationBadge}>
                                <Check size={11} aria-hidden="true" />
                                <span>Current</span>
                              </span>
                            )}
                          </div>
                          {station.description && <p className={styles.stationDesc}>{station.description}</p>}
                          <code className={styles.stationPath}>{station.path}</code>
                        </div>
                        <ArrowRight size={16} className={styles.stationArrow} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
