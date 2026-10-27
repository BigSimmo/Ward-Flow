"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import {
  ArrowBigUp,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Lock,
  Mail,
  Server,
  Shield,
  TriangleAlert,
  WifiOff,
} from "lucide-react";

import { BRAND_COUNTER_TRANSFORM, BRAND_VIEWBOX, brandMarkOptics } from "@/lib/brand-mark";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

import styles from "./front-door.module.css";

/** The Ward Flow mark, drawn in the band's own ink. */
export function DoorMark() {
  const { transform, stroke, point } = brandMarkOptics("display");
  return (
    <span className={styles.mark}>
      <svg viewBox={BRAND_VIEWBOX} aria-hidden="true" focusable="false">
        <g transform={transform} fill="currentColor">
          <path d={stroke} />
          <path d={stroke} transform={BRAND_COUNTER_TRANSFORM} />
          <circle cx={point.cx} cy={point.cy} r={point.r} />
        </g>
      </svg>
    </span>
  );
}

const BOARD_PATTERN = "oorohooocoorooohroooc";
const CAP_CLASS: Record<string, string | undefined> = {
  r: styles.capReady,
  h: styles.capHeld,
  c: styles.capClosed,
};

/** The faint bed board behind the band: decoration only, the same on every load. */
export function BedBoardTexture({ rows = 18 }: { rows?: number }) {
  return (
    <div className={styles.bgboard} aria-hidden="true">
      {Array.from({ length: 12 }, (_, column) => (
        <div className={styles.bcol} key={column}>
          <span className={styles.bhead} />
          {Array.from({ length: rows }, (_, row) => {
            const kind = BOARD_PATTERN.charAt((column * 5 + row * 3) % BOARD_PATTERN.length);
            return <span key={row} className={`${styles.cap} ${CAP_CLASS[kind] ?? ""}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

const IDLE_MINUTES = CLINICAL_VALUES.idleLock.value;
const SESSION_HOURS = CLINICAL_VALUES.sessionLimit.value;

export function Brand() {
  return (
    <section className={styles.brand} aria-label="About Ward Flow">
      <div className={styles.brandTop}>
        <DoorMark />
        <span className={styles.wordmark}>Ward Flow</span>
        <span className={styles.syn}>
          <i aria-hidden="true" />
          Synthetic data
        </span>
      </div>
      <div className={styles.brandCopy}>
        <p className={styles.eyebrow}>WA mental health bed flow</p>
        <p className={styles.brandTitle}>Beds, referrals and moves across the network, in one shared view.</p>
        <p className={styles.brandSub}>Sign in to open the screens your role needs.</p>
      </div>
      <ul className={styles.pills}>
        <li>
          <Shield aria-hidden="true" />
          Your role, your view
        </li>
        <li>
          <Lock aria-hidden="true" />
          Locks after {IDLE_MINUTES} minutes
        </li>
        <li>
          <Info aria-hidden="true" />
          Synthetic records only
        </li>
      </ul>
      <ul className={styles.assure}>
        <li>
          <span className={styles.ai}>
            <Shield aria-hidden="true" />
          </span>
          <span>
            <b>Your role, your view</b>You see and change only what your role needs.
          </span>
        </li>
        <li>
          <span className={styles.ai}>
            <Lock aria-hidden="true" />
          </span>
          <span>
            <b>Locks when left</b>After {IDLE_MINUTES} minutes without use, and a fresh sign-in every {SESSION_HOURS}{" "}
            hours.
          </span>
        </li>
        <li>
          <span className={styles.ai}>
            <Info aria-hidden="true" />
          </span>
          <span>
            <b>Synthetic records only</b>A prototype. Not for clinical decisions.
          </span>
        </li>
      </ul>
    </section>
  );
}

/**
 * The Night entrance: navy screen, bed texture, brand band and a panel holding one card. `note`
 * says a message sits on the card, so short phones make room for it.
 */
export function DoorScreen({
  label,
  note,
  focusTarget,
  children,
}: {
  label: string;
  note: boolean;
  focusTarget?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // While someone types on a phone the band folds away (front-door.module.css). A tap on a button
  // would take the field's focus first, unfold the band and move the button from under the finger,
  // so the tap is lost. Keep the field's focus through the tap; the click still lands.
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    const keepTyping = (event: MouseEvent) => {
      const typing = document.activeElement instanceof HTMLInputElement && node.contains(document.activeElement);
      if (typing && event.target instanceof Element && event.target.closest("button")) event.preventDefault();
    };
    node.addEventListener("mousedown", keepTyping);
    return () => node.removeEventListener("mousedown", keepTyping);
  }, []);
  return (
    <div className={styles.screen}>
      <main id="main-content" className={`${styles.door} ${note ? styles.doorNote : ""}`} aria-label={label}>
        {focusTarget && (
          <button type="button" className={styles.skip} onClick={() => focusTarget.current?.focus()}>
            Skip to sign in
          </button>
        )}
        <BedBoardTexture />
        <Brand />
        <div ref={panel} className={styles.panel}>
          {children}
          <ul className={styles.facts}>
            <li>
              <Shield aria-hidden="true" />
              Your role, your view
            </li>
            <li>
              <Lock aria-hidden="true" />
              Locks after {IDLE_MINUTES} minutes
            </li>
            <li>
              <Info aria-hidden="true" />
              Synthetic records only
            </li>
          </ul>
          <p className={styles.safety}>
            <TriangleAlert aria-hidden="true" />
            <span>Prototype with synthetic data. Never enter real patient details.</span>
          </p>
        </div>
      </main>
    </div>
  );
}

export type DoorBannerTone = "danger" | "info" | "success" | "warning";
export type DoorBannerIcon = "alert" | "info" | "check" | "lock" | "clock" | "wifi" | "server" | "warning";

const BANNER_TONE: Record<DoorBannerTone, string> = {
  danger: styles.bannerDanger,
  info: styles.bannerInfo,
  success: styles.bannerSuccess,
  warning: styles.bannerWarning,
};

function BannerIcon({ icon }: { icon: DoorBannerIcon }) {
  switch (icon) {
    case "alert":
      return <CircleAlert aria-hidden="true" />;
    case "check":
      return <CircleCheck aria-hidden="true" />;
    case "lock":
      return <Lock aria-hidden="true" />;
    case "clock":
      return <Clock aria-hidden="true" />;
    case "wifi":
      return <WifiOff aria-hidden="true" />;
    case "server":
      return <Server aria-hidden="true" />;
    case "warning":
      return <TriangleAlert aria-hidden="true" />;
    default:
      return <Info aria-hidden="true" />;
  }
}

/** One message on the card. A refusal is an alert; everything else is a status. */
export function DoorBanner({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: DoorBannerTone;
  icon: DoorBannerIcon;
  title: string;
  body?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className={`${styles.banner} ${BANNER_TONE[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      <BannerIcon icon={icon} />
      <p>
        <b>{title}</b>
        {body}
        {children}
      </p>
    </div>
  );
}

export function EmailField({
  id,
  value,
  onChange,
  disabled,
  invalid,
  inputRef,
  label = "Email",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  label?: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inwrap}>
        <span className={styles.lead}>
          <Mail aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          id={id}
          type="email"
          autoComplete="username"
          autoCapitalize="off"
          inputMode="email"
          spellCheck={false}
          placeholder="name@health.wa.gov.au"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          disabled={disabled}
          aria-invalid={invalid || undefined}
        />
      </div>
    </div>
  );
}

/** A password field with Show and Caps Lock warning. `after` replaces the Caps Lock line's place. */
export function PasswordField({
  id,
  label = "Password",
  value,
  onChange,
  autoComplete = "current-password",
  icon = "lock",
  disabled,
  invalid,
  minLength,
  describedBy,
  action,
  after,
  inputRef,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: "current-password" | "new-password";
  icon?: "lock" | "key";
  disabled?: boolean;
  invalid?: boolean;
  minLength?: number;
  describedBy?: string;
  action?: ReactNode;
  after?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.("CapsLock") === true);
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className={styles.inwrap}>
        <span className={styles.lead}>
          {icon === "key" ? <KeyRound aria-hidden="true" /> : <Lock aria-hidden="true" />}
        </span>
        <input
          ref={inputRef}
          className={`${styles.input} ${styles.pwi}`}
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCapsLock(false)}
          required
          minLength={minLength}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className={styles.reveal}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          aria-controls={id}
          disabled={disabled}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      {capsLock && (
        <p className={`${styles.hint} ${styles.hintWarn}`} role="status">
          <ArrowBigUp aria-hidden="true" />
          <span>Caps Lock is on.</span>
        </p>
      )}
      {after}
    </div>
  );
}

/** The primary button's arrow, which slides a little on hover. */
export function Arrow() {
  return (
    <span className={styles.arr}>
      <ArrowRight aria-hidden="true" />
    </span>
  );
}

export function Spinner({ dim }: { dim?: boolean }) {
  return <span className={`${styles.spin} ${dim ? styles.spinDim : ""}`} aria-hidden="true" />;
}

export function SessionNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.sessionNote}>
      <Clock aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export { IDLE_MINUTES, SESSION_HOURS };
