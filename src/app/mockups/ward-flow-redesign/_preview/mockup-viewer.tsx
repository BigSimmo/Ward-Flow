"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { Segmented } from "@/components/wf";

import notesJson from "./review-notes.json";
import { BUILD_NOTES, GROUND } from "./build-notes";
import { MOCKUP_BASE, MOCKUP_POPUPS, MOCKUP_SCREENS } from "./screens";
import styles from "./mockup-viewer.module.css";

type Device = "desktop" | "laptop" | "tablet" | "phone";
type Theme = "system" | "light" | "dark";
type View = "redesign" | "today";
type NoteLine = { devices?: string[]; text: string };
type ReviewNote = { role: string; issues: NoteLine[]; fixes: NoteLine[]; keep?: string };

const NOTES = notesJson as Record<string, ReviewNote>;
const DEVICES: Record<Device, { width: number; height: number; label: string }> = {
  desktop: { width: 1440, height: 900, label: "Desktop 1440" },
  laptop: { width: 1280, height: 800, label: "Laptop 1280" },
  tablet: { width: 820, height: 1180, label: "Tablet 820" },
  phone: { width: 390, height: 844, label: "Phone 390" },
};
const STORE = "wf-redesign-viewer";

/** `today` is the coordinator page whose picture of today's app applies; role views have none. */
type Entry = { slug: string; label: string; group: string; screen: string; pop?: string; today?: string };
const COORDINATOR_PAGES = new Map(
  MOCKUP_SCREENS.filter((screen) => !screen.role && screen.slug !== "home-activity").map((screen) => [
    screen.slug,
    screen,
  ]),
);
const ENTRIES: Entry[] = [
  ...MOCKUP_SCREENS.map((screen) => ({
    slug: screen.slug,
    label: screen.label,
    group: screen.group,
    screen: screen.slug,
    today: COORDINATOR_PAGES.has(screen.slug) ? screen.slug : screen.slug === "home-activity" ? "home" : undefined,
  })),
  ...MOCKUP_POPUPS.map((popup) => ({
    slug: popup.slug,
    label: popup.label,
    group: popup.group,
    screen: popup.over,
    pop: popup.pop,
    today: COORDINATOR_PAGES.has(popup.over) ? popup.over : undefined,
  })),
];
const GROUPS = [...new Set(ENTRIES.map((entry) => entry.group))];

/**
 * Preview only: the page Josh reviews. Every redesigned page and popup, drawn live in a frame at a
 * chosen device width, with the design review's notes beside it. `mode` says where the frames come
 * from: the Next route, or the bundled copy published as a shareable page.
 */
export function MockupViewer(props: { mode?: "next" | "static"; built: readonly string[] }) {
  // Drawn in the browser only, so the remembered device and the address's page apply from the start.
  const inBrowser = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return inBrowser ? <Viewer {...props} /> : null;
}

const subscribeNothing = () => () => {};

function savedDevice(): Device {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "{}") as { device?: Device };
    return saved.device && saved.device in DEVICES ? saved.device : "desktop";
  } catch {
    // Storage can be blocked; the viewer works without it.
    return "desktop";
  }
}

function slugFromAddress(): string {
  const fromHash = decodeURIComponent(location.hash.slice(1));
  return ENTRIES.some((entry) => entry.slug === fromHash) ? fromHash : "capacity";
}

function Viewer({ mode = "next", built }: { mode?: "next" | "static"; built: readonly string[] }) {
  const [slug, setSlug] = useState(slugFromAddress);
  const [device, setDevice] = useState<Device>(savedDevice);
  const [theme, setTheme] = useState<Theme>("system");
  const [view, setView] = useState<View>("redesign");
  const [fit, setFit] = useState(true);
  const [stageWidth, setStageWidth] = useState(1000);
  const stage = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => setStageWidth(node.clientWidth - 32);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const choose = (next: string) => {
    setSlug(next);
    history.replaceState(null, "", `#${next}`);
  };
  const chooseDevice = (next: Device) => {
    setDevice(next);
    try {
      localStorage.setItem(STORE, JSON.stringify({ device: next }));
    } catch {
      // Remembering the device is only a convenience.
    }
  };

  const entry = ENTRIES.find((candidate) => candidate.slug === slug) ?? ENTRIES[0]!;
  const size = DEVICES[device];
  const scale = fit ? Math.min(1, stageWidth / size.width) : 1;
  const query = new URLSearchParams();
  if (entry.pop) query.set("pop", entry.pop);
  if (theme !== "system") query.set("theme", theme);
  const src =
    mode === "next"
      ? `${MOCKUP_BASE}/${entry.screen}${query.size ? `?${query}` : ""}`
      : `frame.html?${new URLSearchParams({ screen: entry.screen, ...Object.fromEntries(query) })}`;
  const todayPage = entry.today ? COORDINATOR_PAGES.get(entry.today) : undefined;
  const showToday = view === "today";
  const note = NOTES[entry.slug];
  const build = BUILD_NOTES[entry.slug];

  return (
    <div className={styles.viewer}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Ward Flow, redesigned</h1>
          <p className={styles.sub}>
            Every page and popup rebuilt from the app&apos;s own React components and synthetic records, with the design
            review&apos;s fixes applied. Choose a page and a device. Buttons work as they would in the app, on synthetic
            data that resets when the page reloads.
          </p>
        </div>
        <div className={styles.controls}>
          <Segmented
            label="Version"
            items={[
              { id: "redesign" as const, label: "Redesign" },
              { id: "today" as const, label: "Today" },
            ]}
            value={view}
            onChange={setView}
          />
          <Segmented
            label="Device"
            items={(Object.keys(DEVICES) as Device[]).map((id) => ({ id, label: DEVICES[id].label }))}
            value={device}
            onChange={chooseDevice}
          />
          <Segmented
            label="Theme"
            items={[
              { id: "system" as const, label: "System" },
              { id: "light" as const, label: "Light" },
              { id: "dark" as const, label: "Dark" },
            ]}
            value={theme}
            onChange={setTheme}
          />
          <Segmented
            label="Zoom"
            items={[
              { id: "fit" as const, label: "Fit" },
              { id: "full" as const, label: "100%" },
            ]}
            value={fit ? "fit" : "full"}
            onChange={(id) => setFit(id === "fit")}
          />
        </div>
      </header>
      <nav className={styles.picker} aria-label="Pages and popups">
        {GROUPS.map((group) => (
          <span key={group} style={{ display: "contents" }}>
            <span className={styles.group}>{group}</span>
            {ENTRIES.filter((candidate) => candidate.group === group).map((candidate) => (
              <button
                key={candidate.slug}
                type="button"
                className={styles.pick}
                aria-current={candidate.slug === entry.slug ? "page" : undefined}
                onClick={() => choose(candidate.slug)}
              >
                {candidate.label}
                {built.includes(candidate.screen) ? "" : " (to do)"}
              </button>
            ))}
          </span>
        ))}
      </nav>
      <div className={styles.body}>
        <div className={styles.stage} ref={stage}>
          <div className={styles.stageMeta}>
            <span>
              {size.label} · zoom {Math.round(scale * 100)}% · synthetic data only, not approved for clinical use
            </span>
            {mode === "static" ? (
              <a href={src} target="_blank" rel="noreferrer">
                Open this page on its own
              </a>
            ) : null}
          </div>
          {showToday ? (
            <TodayView mode={mode} entry={entry} page={todayPage} device={device} width={size.width * scale} />
          ) : mode === "next" ? (
            <div className={styles.openBox}>
              <p>
                The app does not allow its pages inside a frame, so here each page opens on its own at this
                window&apos;s size. The shareable copy shows them in device frames.
              </p>
              <a className={styles.openLink} href={src}>
                Open {entry.label}
              </a>
            </div>
          ) : (
            <div className={styles.frameBox} style={{ width: size.width * scale, height: size.height * scale }}>
              <iframe
                key={`${src}-${device}`}
                className={styles.frame}
                src={src}
                title={`${entry.label} mock-up at ${size.width} pixels wide`}
                style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
              />
            </div>
          )}
        </div>
        <aside className={styles.notes} aria-label="Design review notes">
          <h2>{entry.label}</h2>
          {note ? (
            <>
              <p>{note.role}</p>
              <h3>What was wrong</h3>
              <ol>
                {note.issues.map((line) => (
                  <NoteItem key={line.text} line={line} />
                ))}
              </ol>
              <h3>What the mock-up changes</h3>
              <ol>
                {note.fixes.map((line) => (
                  <NoteItem key={line.text} line={line} />
                ))}
              </ol>
              {note.keep ? (
                <>
                  <h3>Kept as it is</h3>
                  <p>{note.keep}</p>
                </>
              ) : null}
            </>
          ) : null}
          {build ? (
            <>
              <h3>How this one is built</h3>
              <ol>
                {build.map((text) => (
                  <NoteItem key={text} line={{ text }} />
                ))}
              </ol>
            </>
          ) : null}
          <p className={styles.ground}>{GROUND}</p>
        </aside>
      </div>
    </div>
  );
}

/**
 * Today's app beside the redesign. The shareable copy shows a full-length picture of today's page,
 * taken from the same synthetic world in light at each device width; the Next route opens the page.
 */
function TodayView(props: {
  mode: "next" | "static";
  entry: Entry;
  page: (typeof MOCKUP_SCREENS)[number] | undefined;
  device: Device;
  width: number;
}) {
  const { mode, entry, page, device, width } = props;
  if (!page) {
    return (
      <div className={styles.openBox}>
        <p>
          Today&apos;s app is pictured as the coordinator only. To compare this role&apos;s view, open the
          coordinator&apos;s page of the same name.
        </p>
      </div>
    );
  }
  const popupNote = entry.pop ? <p className={styles.todayNote}>Today&apos;s page, without the popup open.</p> : null;
  if (mode === "next") {
    return (
      <div className={styles.openBox}>
        <p>Today&apos;s page opens on its own, in the live prototype&apos;s synthetic world.</p>
        {popupNote}
        <a className={styles.openLink} href={page.appPath}>
          Open today&apos;s {page.label}
        </a>
      </div>
    );
  }
  return (
    <>
      {popupNote}
      <div className={styles.todayBox} style={{ width }}>
        {/* A static picture of today's page; next/image needs the app's image server, which the shareable copy has not. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.todayImage}
          src={`today/${page.slug}-${DEVICES[device].width}.jpg`}
          alt={`Today's ${page.label} page at ${DEVICES[device].width} pixels wide`}
        />
      </div>
    </>
  );
}

function NoteItem({ line }: { line: NoteLine }) {
  return (
    <li>
      {line.devices?.map((device) => (
        <span key={device} className={styles.dev}>
          {device}
        </span>
      ))}
      {line.text.split("**").map((part, index) => (index % 2 ? <b key={index}>{part}</b> : part))}
    </li>
  );
}
