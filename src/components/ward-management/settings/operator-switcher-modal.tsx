"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";

import { edHref, teamHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { useWardModalFocus } from "../ward-modal-focus";

import styles from "./settings.module.css";

export interface OperatorStation {
  readonly group: string;
  readonly label: string;
  readonly path: string;
}

export const OPERATOR_STATIONS: readonly OperatorStation[] = [
  { group: "Central Coordinator", label: "State Bed Flow Coordinator", path: "/mockups/ward-flow" },
  { group: "Ward NUMs", label: "Moodjar (Armadale Adult Open)", path: unitHref("arm-adult-open") },
  { group: "Ward NUMs", label: "Murchison (FSH Adult Secure)", path: unitHref("fsh-adult-secure") },
  { group: "Ward NUMs", label: "All Wards Matrix", path: "/mockups/ward-flow/wards" },
  { group: "ED Liaisons", label: "Royal Perth Hospital ED", path: edHref("rph-ed") },
  { group: "ED Liaisons", label: "Fiona Stanley Hospital ED", path: edHref("fsh-ed") },
  { group: "Community", label: "Midland Community Mental Health", path: teamHref("midland") },
  { group: "Transport", label: "Patient Transport Officer", path: "/mockups/ward-flow/transport/officer" },
];

export interface OperatorSwitcherModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onNavigate?: (path: string) => void;
}

function useSafeRouter(): { push: (path: string) => void } | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRouter();
  } catch {
    return null;
  }
}

export function OperatorSwitcherModal({ isOpen, onClose, onNavigate }: OperatorSwitcherModalProps) {
  const router = useSafeRouter();
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
                  {stations.map((station) => (
                    <button
                      key={station.path}
                      type="button"
                      className={styles.stationBtn}
                      onClick={() => handleStationClick(station.path)}
                      data-testid={`station-${station.path.replace(/\//g, "-").replace(/^-/, "")}`}
                    >
                      <div className={styles.stationBtnContent}>
                        <span className={styles.stationLabel}>{station.label}</span>
                        <code className={styles.stationPath}>{station.path}</code>
                      </div>
                      <ArrowRight size={16} className={styles.stationArrow} aria-hidden="true" />
                    </button>
                  ))}
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
