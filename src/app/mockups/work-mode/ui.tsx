import type { ReactNode } from "react";

import type { HeaderCopy, ModeSpec } from "./state";

export function Icon({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className ? `i ${className}` : "i"} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

export function StatusBar({ time }: { time: string }) {
  return (
    <div className="sb">
      <span className="num">{time}</span>
      <span className="sbi">
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
          <rect x="0" y="7" width="3" height="4" rx=".8" />
          <rect x="4.6" y="5" width="3" height="6" rx=".8" />
          <rect x="9.2" y="2.6" width="3" height="8.4" rx=".8" />
          <rect x="13.8" y="0" width="3" height="11" rx=".8" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true">
          <path d="M7.5 10.6 5.6 8.5a2.7 2.7 0 0 1 3.8 0z" />
          <path
            d="M3.2 6.3a6.1 6.1 0 0 1 8.6 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M1 3.9a9.3 9.3 0 0 1 13 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
          <rect
            x=".6"
            y=".6"
            width="22"
            height="10.8"
            rx="3.2"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".4"
            strokeWidth="1.1"
          />
          <rect x="2.4" y="2.4" width="16" height="7.2" rx="1.8" />
          <rect x="23.8" y="4" width="1.7" height="4" rx=".8" fillOpacity=".45" />
        </svg>
      </span>
    </div>
  );
}

const RING = 2 * Math.PI * 28;

export function Ring({ value, caption, fraction }: { value: string; caption: string; fraction: number }) {
  const offset = (RING * (1 - fraction)).toFixed(1);
  return (
    <div className="ring">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="color-mix(in srgb, var(--wf-hero-ink) 20%, transparent)"
          strokeWidth="4.5"
        />
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="var(--wf-hero-ink)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray="175.9"
          strokeDashoffset={offset}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div>
        <b className="num">{value}</b>
        <small>{caption}</small>
      </div>
    </div>
  );
}

const MINI = 2 * Math.PI * 19;

export function MiniRing({ value, fraction }: { value: string; fraction: number }) {
  return (
    <div className="mring">
      <svg viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r="19" fill="none" stroke="var(--wash)" strokeWidth="5" />
        <circle
          cx="23"
          cy="23"
          r="19"
          fill="none"
          stroke="var(--m)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="119.4"
          strokeDashoffset={(MINI * (1 - fraction)).toFixed(1)}
          transform="rotate(-90 23 23)"
        />
      </svg>
      <b className="num">{value}</b>
    </div>
  );
}

export function AppHeader({
  mode,
  copy,
  tab,
  onMenu,
  onMode,
  onRight,
  onAction,
  onTab,
}: {
  mode: ModeSpec;
  copy: HeaderCopy;
  tab: number;
  onMenu: () => void;
  onMode: () => void;
  onRight: () => void;
  onAction: () => void;
  onTab: (index: number) => void;
}) {
  return (
    <div className="band">
      <Icon id={mode.watermark} className="wm" />
      <StatusBar time={copy.time} />
      <div className="bar">
        <button type="button" className="rb glass" aria-label={copy.back ? "Back" : "Work areas"} onClick={onMenu}>
          <Icon id={copy.back ? "chevl" : "menu"} />
        </button>
        <button type="button" className="mode glass" onClick={onMode} aria-haspopup="dialog">
          <span className="badge">
            <Icon id={mode.icon} />
          </span>
          <span className="t">
            <b>{copy.sub}</b>
            <small>{mode.name.toUpperCase()}</small>
          </span>
          <Icon id="chev" className="chev" />
        </button>
        <button
          type="button"
          className="rb glass"
          aria-label={copy.right === "bell" ? "Alerts" : "Search your work"}
          onClick={onRight}
        >
          <Icon id={copy.right} />
          {copy.dot ? <i className="dot" /> : null}
        </button>
      </div>
      <div className="head">
        <div>
          {copy.eyebrow ? <div className="eb num">{copy.eyebrow}</div> : null}
          <h2 className="title">{copy.title}</h2>
        </div>
        {copy.action ? (
          <button type="button" className="act glass" aria-label={copy.action} onClick={onAction}>
            <Icon id={copy.action} />
          </button>
        ) : null}
      </div>
      <div className="tabs" role="tablist" aria-label={mode.name}>
        {mode.tabs.map((tabLabel, index) => {
          const [label, count] = tabLabel.split("|");
          const selected = !copy.back && index === tab;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? "on" : undefined}
              onClick={() => onTab(index)}
            >
              {label}
              {count ? <span className="cnt">{count}</span> : null}
              {label === "More" ? <Icon id="chev" className="mchev" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Label({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="lbl">
      <span>{children}</span>
      {extra}
    </div>
  );
}

export function Chevron() {
  return <Icon id="chevr" className="chev2" />;
}

export function DateTile({ month, day }: { month: string; day: string }) {
  return (
    <span className="dtl">
      <small>{month}</small>
      <b className="num">{day}</b>
    </span>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button type="button" className="dim" aria-label="Close" onClick={onClose} />
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="shd">
          <div>
            <h4>{title}</h4>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <button type="button" className="xb" aria-label="Close" onClick={onClose}>
            <Icon id="x" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Dock({
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  return (
    <>
      <div className="fade" />
      <div className="dock">
        <div className="cap2 glass">
          <button type="button" className="btn p" onClick={onPrimary}>
            {primary}
          </button>
          {secondary ? (
            <button type="button" className="btn g" onClick={onSecondary}>
              {secondary}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function Toast({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="toast" role="status">
      <Icon id="check" />
      <span>{message}</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

export function Foot({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="day-foot">
      <Icon id={icon} />
      <span>{children}</span>
    </div>
  );
}
