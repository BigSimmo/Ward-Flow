/* Alerts redesign mock-up. Synthetic demo data only (the app's own demo at 10:42). */
(function () {
  "use strict";
  const PHONE = document.documentElement.dataset.mkMode === "phone";
  const I = window.MK_ICONS || {};
  I.history =
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>';

  // ---------- kit class names (copied from the running app) ----------
  const K = {
    b: "button-module__7Kx0wW__b",
    sm: "button-module__7Kx0wW__sm",
    pri: "button-module__7Kx0wW__pri",
    sec: "button-module__7Kx0wW__sec",
    ghost: "button-module__7Kx0wW__ghost",
    onHero: "button-module__7Kx0wW__onHero",
    light: "button-module__7Kx0wW__light",
    danger: "button-module__7Kx0wW__danger",
    label: "button-module__7Kx0wW__label",
    bcount: "button-module__7Kx0wW__count",
    iconOnly: "button-module__7Kx0wW__iconOnly",
    count: "primitives-module__YjBLjG__count",
    k: "choice-module__lGh_Yq__k",
    tabs: "choice-module__lGh_Yq__tabs",
    tab: "choice-module__lGh_Yq__tab",
    seg: "choice-module__lGh_Yq__seg",
    segMd: "choice-module__lGh_Yq__md",
    segItem: "choice-module__lGh_Yq__segItem",
    segOn: "choice-module__lGh_Yq__segOn",
    pt: "choice-module__lGh_Yq__pt",
    ptFill: "choice-module__lGh_Yq__ptFill",
    ptItem: "choice-module__lGh_Yq__ptItem",
    card: "card-module__Tvweaa__card",
    hero: "hero-module__zGrVCW__hero",
    row: "hero-module__zGrVCW__row",
    firstRow: "hero-module__zGrVCW__firstRow",
    titleBlock: "hero-module__zGrVCW__titleBlock",
    eyebrow: "hero-module__zGrVCW__eyebrow",
    titleLine: "hero-module__zGrVCW__titleLine",
    title: "hero-module__zGrVCW__title",
    titleMeta: "hero-module__zGrVCW__titleMeta",
    aside: "hero-module__zGrVCW__aside",
    barRow: "hero-module__zGrVCW__barRow",
    bar: "hero-module__zGrVCW__bar",
    foot: "hero-module__zGrVCW__foot",
    footMain: "hero-module__zGrVCW__footMain",
    pills: "referral-board-module__01YcPq__pills referral-panel-module__lnJZfa__pills",
    pill: "referral-board-module__01YcPq__pill referral-panel-module__lnJZfa__pill",
    pillCount: "referral-board-module__01YcPq__pillCount",
    heroTools: "referral-panel-module__lnJZfa__heroTools",
    hrows: "home-list-module__BJLQMq__hrows",
    hrow: "home-list-module__BJLQMq__hrow",
    hGlyph: "home-list-module__BJLQMq__hrowGlyph",
    hMain: "home-list-module__BJLQMq__hrowMain",
    hTitle: "home-list-module__BJLQMq__hrowTitle",
    hLine: "home-list-module__BJLQMq__hrowLine",
    hName: "home-list-module__BJLQMq__hrowName",
    hAge: "home-list-module__BJLQMq__hrowAge",
    hAct: "home-list-module__BJLQMq__hrowAction",
    hMono: "home-list-module__BJLQMq__mono",
    group: "alerts-module__JAKVka__group",
    groupHead: "alerts-module__JAKVka__groupHead",
    groupAside: "alerts-module__JAKVka__groupAside",
    grid: "alerts-module__JAKVka__grid",
    column: "alerts-module__JAKVka__column",
    panel: "alerts-module__JAKVka__panel",
    panelCard: "alerts-module__JAKVka__panelCard",
    tabsBar: "alerts-module__JAKVka__tabsBar",
    queueCard: "alerts-module__JAKVka__queueCard",
    formIn: "form-module__RyzEZG__in",
    formControl: "form-module__RyzEZG__control",
    formSelect: "form-module__RyzEZG__select",
    caret: "form-module__RyzEZG__selectCaret",
    live: "live-module__fCb-za__group",
    lv: "live-module__fCb-za__lv",
    lvHero: "live-module__fCb-za__onHero",
    pulse: "live-module__fCb-za__pulse",
    lvU: "live-module__fCb-za__u",
    ph: "phone-module__liGfXG__hero",
    phTB: "phone-module__liGfXG__heroTitleBlock",
    phER: "phone-module__liGfXG__heroEyebrowRow",
    phE: "phone-module__liGfXG__heroEyebrow",
    phChip: "phone-module__liGfXG__heroChip",
    phT: "phone-module__liGfXG__heroTitle",
    phSub: "phone-module__liGfXG__heroSub",
    phFigs: "phone-module__liGfXG__heroFigures",
    phFig: "phone-module__liGfXG__heroFigure",
    phFigB: "phone-module__liGfXG__heroFigureButton",
    phV: "phone-module__liGfXG__heroValue",
    phL: "phone-module__liGfXG__heroLabel",
    phLT: "phone-module__liGfXG__heroLabelText",
    phActs: "phone-module__liGfXG__heroActions",
    phPills: "phone-rows-module__f2BZ3a__heroPills",
    phPill: "phone-rows-module__f2BZ3a__heroPill",
  };

  // ---------- small helpers ----------
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ic = (n, size = 16) =>
    `<svg class="lucide" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[n] || ""}</svg>`;
  const SHAPES = {
    danger: '<path d="M5 0.8 9.6 9.2H0.4Z" fill="currentColor"/>',
    warning: '<circle cx="5" cy="5" r="4" fill="currentColor"/>',
    success:
      '<path d="M1.4 5.4 3.9 7.8 8.6 2.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    info: '<rect x="0.6" y="2.9" width="8.8" height="4.2" rx="2.1" fill="currentColor"/>',
    neutral: '<circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  };
  const glyph = (tone, size = 10) =>
    `<svg class="status-glyph-module__2H-MIG__glyph status-glyph-module__2H-MIG__${tone}" data-wf-glyph="${tone}" width="${size}" height="${size}" viewBox="0 0 10 10" aria-hidden="true" focusable="false">${SHAPES[tone]}</svg>`;
  const cnt = (n, extra = "") => (n ? `<span class="${K.count} ${extra}"><span>${n}</span></span>` : "");
  function btn(label, o = {}) {
    const cls = [K.b, K[o.v || "sec"], o.size === "md" ? "" : K.sm, o.cls || ""].join(" ");
    const attrs = o.attrs || "";
    const dis = o.disabled ? ` aria-disabled="true" data-reason="${esc(o.disabled)}"` : "";
    return `<button type="button" class="${cls}" ${attrs}${dis}>${o.icon ? ic(o.icon, 16) : ""}<span class="${K.label}">${label}</span>${o.count ? `<span class="${K.count} ${K.bcount}"><span>${o.count}</span></span>` : ""}${o.end ? ic(o.end, 14) : ""}</button>`;
  }
  const initials = (name) =>
    name
      .split(",")
      .map((s) => s.trim()[0])
      .reverse()
      .join("");
  const nameLine = (p) =>
    `<strong class="${K.hName}">${esc(p.name)}</strong> ${p.planned ? `<span>${esc(p.umrn)}</span>` : `<span class="${K.hMono}">${esc(p.umrn)}</span>`}`;

  // ---------- data (the app's synthetic demo, 10:42) ----------
  const NOW = 10 * 60 + 42;
  const ACT = [
    {
      id: "a1",
      group: "act",
      tone: "danger",
      title: "Pull expired, bed still pulled",
      person: { name: "Cadwaller, Rhys", umrn: "UM100046", legal: "Involuntary inpatient" },
      where: "BTY Adult Secure, from St John of God Midland ED",
      age: "10m",
      ageNote: "past pull limit",
      ageTone: "danger",
      raised: 10 * 60 + 32,
      owner: "you",
      action: "Release pulled bed",
      kind: "hold",
    },
    {
      id: "a4",
      group: "act",
      tone: "danger",
      title: "Accepted, bed not pulled",
      person: { name: "Underbridge, Warrick", umrn: "UM100085", legal: "Voluntary" },
      where: "Bunbury Acute Psychiatric Unit, from Bunbury Community Team",
      age: "45m",
      ageNote: "since 09:57",
      raised: 9 * 60 + 57,
      owner: "you",
      action: "Pull bed",
      kind: "accepted",
    },
    {
      id: "a2",
      group: "act",
      tone: "danger",
      title: "Multiple destinations declined",
      person: { name: "Wren, Tobias", umrn: "UM100023", legal: "Involuntary inpatient" },
      where: "Peel Health Campus ED",
      age: "5m",
      ageNote: "since 10:37",
      raised: 10 * 60 + 37,
      owner: "you",
      action: "Find a bed",
      kind: "declines",
    },
    {
      id: "a3",
      group: "act",
      tone: "danger",
      title: "No eligible bed: shown to the bed coordinator",
      person: { name: "Oquinn, Priya", umrn: "UM100006", legal: "Voluntary" },
      where: "St John of God Midland ED",
      age: "",
      ageNote: "Time not recorded",
      raised: null,
      owner: "you",
      action: "Find a bed",
      kind: "nobed",
    },
  ];
  const FORECAST = [
    {
      id: "f1",
      group: "forecast",
      tone: "warning",
      title: "Open adult short tomorrow",
      likely: 9,
      worst: 15,
      best: 4,
      action: "See forecast",
    },
    {
      id: "f2",
      group: "forecast",
      tone: "warning",
      title: "Locked adult short tomorrow",
      likely: 6,
      worst: 7,
      best: 3,
      action: "See forecast",
    },
  ];
  const TRANSPORT = [
    {
      id: "t1",
      person: { name: "Tremalow, Noor", umrn: "UM100047", legal: "Voluntary" },
      to: "Maali (Ward 4.2)",
      from: "Peel Health Campus ED",
      owner: "ED mental health team",
      ownerShort: "ED team",
      age: "30m",
      since: "10:12",
      raised: 10 * 60 + 12,
    },
    {
      id: "t2",
      person: { name: "Sedgeward, Merrick", umrn: "UM100064", legal: "Involuntary inpatient" },
      to: "Mabu Liyan / Broome Mental Health Unit",
      from: "St John of God Midland ED",
      owner: "you",
      age: "25m",
      since: "10:17",
      raised: 10 * 60 + 17,
    },
    {
      id: "t3",
      person: { name: "Bramblewick, Ivo", umrn: "UM100024", legal: "Voluntary" },
      to: "East Metropolitan Youth Unit",
      from: "Armadale Hospital ED",
      owner: "Ward nurse in charge",
      ownerShort: "Ward NIC",
      age: "20m",
      since: "10:22",
      raised: 10 * 60 + 22,
    },
    {
      id: "t4",
      person: { name: "Pendelbury, Alastair", umrn: "UM100026", legal: "Voluntary" },
      to: "SCGH Older Adult",
      from: "Rockingham General Hospital ED",
      owner: "Ward nurse in charge",
      ownerShort: "Ward NIC",
      age: "15m",
      since: "10:27",
      raised: 10 * 60 + 27,
    },
    {
      id: "t5",
      person: { name: "Embleton, Jasper", umrn: "UM100056", legal: "Voluntary" },
      to: "SJGS Adult Open",
      from: "Royal Perth Hospital ED",
      owner: "you",
      age: "15m",
      since: "10:27",
      raised: 10 * 60 + 27,
    },
  ];
  const NOTIFY = [
    {
      id: "n1",
      person: { name: "Quenfold, Lark", umrn: "UM500231", legal: "Voluntary" },
      type: "Admission",
      where: "RPH Older Adult, from St John of God Midland ED",
      owner: "RPH Older Adult",
    },
    {
      id: "n2",
      person: { name: "Ridgeholt, Lark", umrn: "UM500251", legal: "Involuntary inpatient" },
      type: "Admission",
      where: "FSH Adult Secure, from Sir Charles Gairdner Hospital ED",
      owner: "FSH Adult Secure",
    },
    {
      id: "n3",
      person: { name: "Davenporton, Farah", umrn: "UM100010", legal: "Status not recorded" },
      type: "Discharge",
      where: "Moodjar",
      owner: "Moodjar",
    },
  ];
  const WAIT = [
    {
      id: "w1",
      group: "wait",
      tone: "warning",
      title: "Planned arrival not recorded",
      person: { name: "Initials RK", umrn: "UMRN not recorded", legal: "Voluntary", planned: true },
      where: "Maali (Ward 4.2), expected 09:30",
      age: "1h 12m",
      ageNote: "past expected",
      ageTone: "warning",
      raised: 9 * 60 + 30,
      owner: "Maali (Ward 4.2)",
      ownerShort: "Maali",
      action: "Open bookings",
      kind: "planned",
    },
    {
      id: "w2",
      group: "wait",
      tone: "warning",
      title: "Transport awaiting departure",
      kind: "transport",
      members: TRANSPORT,
      action: "Chase transport",
      age: "30m",
      ageNote: "oldest",
      raised: 10 * 60 + 12,
    },
    {
      id: "w3",
      group: "wait",
      tone: "warning",
      title: "Notifications to record",
      kind: "notify",
      members: NOTIFY,
      action: "Record",
      age: "",
      ageNote: "Time not recorded",
      raised: null,
    },
  ];
  const ALL = [...ACT, ...WAIT];
  const flat = () => [
    ...ACT,
    WAIT[0],
    ...TRANSPORT.map((t) => ({ ...t, parent: "w2" })),
    ...NOTIFY.map((n) => ({ ...n, parent: "w3" })),
  ];
  const ownerOf = (x) => x.owner || "";
  const isYours = (x) => ownerOf(x) === "you";

  const CHECKS = [
    [0, "Legal due time passed", "Movements with a recorded form time. 0 of 6 past the time as typed."],
    [1, "Every ward declined", "Movements where every ward asked has declined. 1 of 2."],
    [0, "Unsuitable destination", "Accepted destinations checked against the person's recorded status."],
    [1, "No eligible bed", "Open movements where no ward in the network is eligible now."],
    [1, "Pull expired", "Pulled beds checked against their pull time limit."],
    [5, "Transport not left", "Accepted transport legs that have not departed."],
    [1, "Planned arrival late", "Booked planned admissions with no arrival recorded."],
    [3, "Notifications to record", "Carer, support person or advocacy notifications not recorded."],
    [0, "Target overdue", "Referral decisions, transfer acceptances and transport bookings against their targets."],
    [20, "Triage waiting", "Referrals never triaged. Opens Referrals."],
    [5, "ED over a day", "Open ED waits of a day or more. Opens Waiting."],
    [0, "Override recorded", "Referrals made by override."],
  ];

  const BC_WARDS = [
    ["Armadale Adult", "take", "1 bed", "10:23"],
    ["Bentley Adult Open", "take", "2 beds", "10:25"],
    ["Fiona Stanley Adult", "after", "Ready at 13:00", "10:26"],
    ["Joondalup Adult", "after", "Ready at 14:30", "10:29"],
    ["Rockingham Adult", "after", "Ready at 15:00", "10:33"],
    ["RPH Adult", "cant", "", "10:28"],
    ["SCGH Adult", "cant", "", "10:31"],
    ["Swan Adult", "none", "", ""],
    ["Maali (Ward 4.2)", "none", "", ""],
  ];
  const ANSWER = {
    take: ["Can take", "success"],
    after: ["After a discharge", "accent"],
    cant: ["Can't", ""],
    none: ["No answer yet", ""],
  };

  const NOTICES = [
    [
      "10:37",
      "danger",
      "x",
      "Third ward declined",
      "Wren, Tobias",
      "UM100023",
      "Fiona Stanley Adult declined. Peel Health Campus ED.",
    ],
    [
      "10:27",
      "accent",
      "truck",
      "Transport booked",
      "Embleton, Jasper",
      "UM100056",
      "Royal Perth Hospital ED to SJGS Adult Open.",
    ],
    [
      "10:02",
      "warning",
      "bed-double",
      "Bed pulled",
      "Cadwaller, Rhys",
      "UM100046",
      "BTY Adult Secure. Pull limit 10:32.",
    ],
    [
      "09:57",
      "success",
      "check",
      "Ward accepted",
      "Underbridge, Warrick",
      "UM100085",
      "Bunbury Acute Psychiatric Unit.",
    ],
  ];
  const HISTORY = [
    [
      "10:39",
      "acted",
      "user-round-check",
      "Taken by you",
      "Multiple destinations declined",
      "Wren, Tobias",
      "UM100023",
    ],
    ["10:20", "broadcast", "radio", "Broadcast sent", "Bed call for adult beds today", "Metropolitan adult units", ""],
    ["10:14", "acted", "check", "Acknowledged", "Transport awaiting departure", "Tremalow, Noor", "UM100047"],
    [
      "09:52",
      "snoozed",
      "alarm-clock",
      "Snoozed until 10:30, now back",
      "Notifications to record",
      "Quenfold, Lark",
      "UM500231",
    ],
    [
      "09:40",
      "acted",
      "bed-double",
      "Pulled bed released: pull made in error",
      "Pull expired, bed still pulled",
      "Hollowmere, Ada",
      "UM100031",
    ],
    ["08:15", "broadcast", "radio", "Broadcast stood down", "HDU full, check discharges", "All wards and ED desks", ""],
  ];

  // ---------- state ----------
  const S = {
    tab: "now",
    view: "urgency",
    sel: "a1",
    chosen: false,
    open: { w2: false, w3: false },
    hl: null,
    pTab: "act",
    reason: "",
    menu: null,
    checks: false,
    bcLive: true,
    composer: false,
    c: {
      kind: "ask",
      tpl: "adult",
      title: "",
      msg: "",
      sev: "warning",
      dur: 60,
      aud: "groups",
      groups: ["metro"],
      picked: [],
      bedNow: false,
      confirm: false,
    },
    histFilter: "all",
    sheet: false,
    ownerChip: "all",
    notify: false,
  };

  // ---------- the hero ----------
  function hero() {
    const START = 7 * 60,
      SPAN = 6 * 60; // 07:00 to 13:00
    const pct = (m) => ((m - START) / SPAN) * 100;
    const pts = [];
    const add = (at, tone, id, text, icon) => pts.push({ at, tone, id, text, icon });
    add(WAIT[0].raised, "warning", "w1", "09:30 Planned arrival not recorded, Maali");
    TRANSPORT.forEach((t) =>
      add(t.raised, "warning", t.id, `${t.since} Transport awaiting departure, ${t.person.name}`),
    );
    add(10 * 60 + 32, "danger", "a1", "10:32 Pull expired, Cadwaller, Rhys");
    add(9 * 60 + 57, "danger", "a4", "09:57 Accepted, bed not pulled, Underbridge, Warrick");
    add(10 * 60 + 37, "danger", "a2", "10:37 Multiple destinations declined, Wren, Tobias");
    add(9 * 60 + 40, "success", "", "09:40 Pulled bed released, Hollowmere, Ada");
    add(10 * 60 + 14, "success", "", "10:14 Acknowledged, Tremalow, Noor");
    add(10 * 60 + 39, "success", "", "10:39 Taken by you, Wren, Tobias");
    if (S.bcLive) add(10 * 60 + 20, "info", "", "10:20 Broadcast sent: bed call", "radio");
    pts.sort((a, b) => a.at - b.at);
    const lastIn = [-1e9, -1e9, -1e9];
    const marks = pts.map((m) => {
      let row = lastIn.findIndex((x) => m.at - x >= 6);
      if (row < 0) row = lastIn.indexOf(Math.min(...lastIn));
      lastIn[row] = m.at;
      const inner = m.icon ? ic(m.icon, 12) : glyph(m.tone, 9);
      const style = `left:${pct(m.at)}%;bottom:${5 + row * 22}px`;
      return m.id
        ? `<button type="button" class="mk-mark" data-tone="${m.tone}" data-sel="${m.id}" style="${style}" aria-label="${esc(m.text)}" title="${esc(m.text)}" aria-pressed="${S.sel === m.id}">${inner}</button>`
        : `<span class="mk-mark" data-tone="${m.tone}" style="${style};cursor:default" title="${esc(m.text)}" role="img" aria-label="${esc(m.text)}">${inner}</span>`;
    });
    const hours = [7, 8, 9, 10, 11, 12, 13];
    const actN = ACT.length,
      waitN = 1 + TRANSPORT.length + NOTIFY.length;
    const yours = flat().filter(isYours).length;
    const pill = (id, n, tone, label) =>
      `<button type="button" class="${K.pill}" aria-pressed="${S.hl === id}" ${tone ? `data-tone="${tone}"` : ""} data-hl="${id}"><span class="${K.pillCount}">${n}</span>${tone ? glyph(tone, 9) : ""}${label}</button>`;

    return `<section class="${K.hero}" aria-labelledby="mk-h1" data-wf-hero="band" data-band="on" style="--wf-band-top:16px;--wf-band-left:16px;--wf-band-right:16px;">
      <div class="${K.row} ${K.firstRow}">
        <div class="${K.titleBlock}"><span class="${K.eyebrow}">Alerts</span>
          <div class="${K.titleLine}"><h1 id="mk-h1" class="${K.title}">${actN} act now, ${waitN} waiting</h1>
          <span class="${K.titleMeta}">oldest <b class="mk-mono">1h 12m</b> · <b class="mk-mono">${yours}</b> yours</span></div></div>
        <div class="${K.aside}"><div class="${K.heroTools}">
          <span class="${K.live}" data-wf-live=""><span class="${K.lv} ${K.lvHero}"><span class="${K.pulse}"></span>Demo <span class="${K.lvU}">10:42</span></span></span>
          ${btn(S.notify ? "Notifying" : "Notify me", { v: "onHero", icon: S.notify ? "bell-ring" : "bell", attrs: `data-act="notify" aria-pressed="${S.notify}" title="Act-now alerts notify in this open tab. No patient detail is shown."` })}
        </div></div>
      </div>
      <div class="${K.row} ${K.barRow}">
        <div class="${K.bar}"><div class="${K.pills}" role="group" aria-label="Highlight alerts">
          ${pill("act", actN, "danger", "Act now")}${pill("wait", waitN, "", "Waiting")}${pill("yours", yours, "", "Yours")}
        </div></div>
        <div class="${K.aside}"><div class="${K.heroTools}">
          ${btn("Copy for handover", { v: "onHero", icon: "copy", attrs: 'data-act="copy"' })}
          ${btn("Next alert", { v: "onHero", icon: "chevron-right", count: actN + waitN, attrs: 'data-act="next" title="Next alert (J)"' })}
          ${btn("Broadcast alert", { v: "light", icon: "radio", attrs: 'data-act="compose"' })}
        </div></div>
      </div>
      <div class="${K.row} ${K.foot}"><div class="${K.footMain}"><div class="mk-band">
        <div class="mk-bandHead"><span>Today</span><span style="text-transform:none;letter-spacing:0;font-weight:500">one mark per alert</span>
          <span class="mk-legend"><span>${glyph("danger", 9)} Act now raised</span><span>${glyph("warning", 9)} Waiting raised</span><span>${glyph("success", 9)} Acted on</span>${S.bcLive ? `<span>${ic("radio", 12)} Broadcast</span>` : ""}</span></div>
        <div class="mk-track" role="group" aria-label="Alerts raised and acted on today">
          <span class="mk-future" style="left:${pct(NOW)}%"></span>
          ${hours
            .slice(1, -1)
            .map((h) => `<span class="mk-hour" style="left:${pct(h * 60)}%"></span>`)
            .join("")}
          <span class="mk-nowLine" style="left:${pct(NOW)}%"></span>${marks.join("")}
        </div>
        <div class="mk-axis" aria-hidden="true">${hours
          .filter((h) => Math.abs(h * 60 - NOW) > 25)
          .map((h) => `<span style="left:${pct(h * 60)}%">${String(h).padStart(2, "0")}:00</span>`)
          .join("")}<span class="mk-axisNow" style="left:${pct(NOW)}%;transform:translateX(-50%)">10:42</span></div>
        <div class="mk-glance" style="position:relative">
          <span><span class="mk-glanceLabel">Checking</span><button type="button" data-act="checks" aria-expanded="${S.checks}"><b>8</b> flagged · <b>4</b> clear ${ic("chevron-down", 14)}</button></span>
          <span>Acted on today <b>3</b></span>
          <span>${S.bcLive ? `<span class="mk-livePulse" aria-hidden="true"></span> Broadcast live <b>38m</b> left` : "No broadcast live"}</span>
          <span>4 with no time, not shown</span>
          ${S.checks ? checksPop() : ""}
        </div>
      </div></div></div>
    </section>`;
  }
  function checksPop() {
    return `<div class="mk-checkPop" role="dialog" aria-label="What this page checks" style="top:100%;left:0"><h3>What this page checks, every minute</h3>
      ${CHECKS.map(([n, t, d]) => `<div class="mk-checkRow"><b ${n ? "" : "data-zero"}>${n}</b><span><strong>${t}</strong>${d}</span></div>`).join("")}
      <div class="mk-checkRow"><b data-zero>–</b><span><strong>Not checked: handover sheets</strong>Nothing records when a shift hands over, so there is no deadline to measure.</span></div></div>`;
  }

  // ---------- rows ----------
  const dimFor = (x) => {
    if (!S.hl) return "";
    const match =
      S.hl === "act"
        ? x.group === "act"
        : S.hl === "wait"
          ? x.group === "wait" || x.parent
          : S.hl === "yours"
            ? isYours(x) || (x.members && x.members.some(isYours))
            : true;
    return match ? " data-hl" : x.group === "act" ? "" : " data-dim"; // act now rows never dim
  };
  const firstAct = () => ACT[0].id;
  function actionBtn(x, name) {
    const primary = x.id === firstAct();
    return btn(x.action, {
      v: primary ? "pri" : "sec",
      attrs: `data-sel="${x.id}" aria-label="${esc(x.action)}${name ? " for " + esc(name) : ""}"`,
    });
  }
  function hrow(x) {
    const owner =
      x.owner && !isYours(x) && x.kind !== "planned"
        ? ` <span class="mk-ownerTag">${esc(x.ownerShort || x.owner)}</span>`
        : "";
    const sel = S.sel === x.id ? " data-selected" : "";
    const act = x.group === "act" ? " data-act" : "";
    return `<li class="${K.hrow} mk-row" data-sel="${x.id}"${act}${sel}${dimFor(x)}>
      <span class="${K.hGlyph}">${glyph(x.tone)}</span>
      <span class="${K.hMain}"><button type="button" class="${K.hTitle}" data-sel="${x.id}">${esc(x.title)}</button>
        <span class="${K.hLine}">${nameLine(x.person)}<span> · ${esc(x.where)}</span>${owner}</span></span>
      <span class="${K.hAge}">${x.age ? `<span class="${K.hMono}">${x.age}</span>` : ""}<span class="mk-ageNote" ${x.ageTone ? `data-tone="${x.ageTone}"` : ""}>${x.ageNote}</span></span>
      <span class="${K.hAct}">${actionBtn(x, x.person.name)}</span></li>`;
  }
  function groupRow(x) {
    const open = S.open[x.id];
    const names = x.members.map((m) => m.person.name);
    const shown = names.slice(0, 3).join(" · ") + (names.length > 3 ? ` +${names.length - 3}` : "");
    const sel = S.sel === x.id ? " data-selected" : "";
    const sub = open
      ? `<li style="list-style:none"><ul class="mk-sub">${x.members.map((m) => subRow(x, m)).join("")}</ul></li>`
      : "";
    return `<li class="${K.hrow} mk-row" data-sel="${x.id}"${sel}${dimFor(x)}>
      <span class="${K.hGlyph}">${glyph(x.tone)}</span>
      <span class="${K.hMain}"><button type="button" class="${K.hTitle}" data-sel="${x.id}">${esc(x.title)} <span style="font-weight:500;color:var(--wf-ink-3)">· ${x.members.length} people</span></button>
        <span class="${K.hLine} mk-names">${esc(shown)}</span></span>
      <span class="${K.hAge}">${x.age ? `<span class="${K.hMono}">${x.age}</span>` : ""}<span>${x.ageNote}</span></span>
      <span class="${K.hAct}">${btn(open ? "Hide" : "Show each", { v: "ghost", end: "chevron-down", cls: "mk-expand", attrs: `data-toggle="${x.id}" aria-expanded="${open}"` })}</span></li>${sub}`;
  }
  function subRow(parent, m) {
    const sel = S.sel === m.id ? " data-selected" : "";
    const where =
      parent.kind === "transport"
        ? `to ${esc(m.to)}, from ${esc(m.from)}`
        : `<span class="mk-tag">${m.type}</span> ${esc(m.where)}`;
    const owner = isYours(m) ? "" : ` · <span class="mk-ownerTag">${esc(m.ownerShort || m.owner)}</span>`;
    const age =
      parent.kind === "transport" ? `<b>${m.age}</b><span>since ${m.since}</span>` : `<span>Time not recorded</span>`;
    const dim = S.hl === "yours" ? (isYours(m) ? " data-hl" : " data-dim") : "";
    return `<li class="mk-subRow mk-row" data-sel="${m.id}"${sel}${dim}><span></span>
      <span class="mk-subMain"><span><strong>${esc(m.person.name)}</strong> <span class="mk-mono">${m.person.umrn}</span>${owner}</span><span>${where}</span></span>
      <span class="mk-subAge">${age}</span>
      <span class="mk-subAct">${btn(parent.action === "Record" ? "Record" : parent.action, { v: "sec", attrs: `data-sel="${m.id}" aria-label="${esc(parent.action)} for ${esc(m.person.name)}"` })}</span></li>`;
  }
  function forecastRow(f) {
    const sel = S.sel === f.id ? " data-selected" : "";
    const sc = (n) => (n / 16) * 100;
    return `<li class="${K.hrow} mk-row" data-sel="${f.id}"${sel}${S.hl ? " data-dim" : ""}>
      <span class="${K.hGlyph}">${glyph("warning")}</span>
      <span class="${K.hMain}"><button type="button" class="${K.hTitle}" data-sel="${f.id}">${esc(f.title)}</button>
        <span class="${K.hLine}"><span class="mk-range"><span class="mk-rangeBar" aria-hidden="true"><i style="left:${sc(f.best)}%;width:${sc(f.worst - f.best)}%"></i><b style="left:${sc(f.likely)}%"></b></span>
        <span>Likely <strong class="${K.hName}">${f.likely} short</strong>, at worst ${f.worst}</span></span></span></span>
      <span class="${K.hAge}"><span>tomorrow</span></span>
      <span class="${K.hAct}">${btn("See forecast", { v: "sec", attrs: `data-sel="${f.id}"` })}</span></li>`;
  }
  function groupHead(tone, label, n, aside) {
    return `<h2 class="${K.groupHead}">${tone ? glyph(tone, 9) : ""}<span>${label}</span>${cnt(n)}${aside ? `<span class="${K.groupAside}">${aside}</span>` : ""}</h2>`;
  }
  function urgencyView() {
    return `<section class="${K.group}" aria-label="Act now" id="mk-act">${groupHead("danger", "Act now", ACT.length, "needs a person now")}
        <ul class="${K.hrows}">${ACT.map(hrow).join("")}</ul></section>
      <section class="${K.group}" aria-label="Waiting">${groupHead("warning", "Waiting", 1 + TRANSPORT.length + NOTIFY.length, "oldest first")}
        <ul class="${K.hrows}">${hrow(WAIT[0])}${groupRow(WAIT[1])}${groupRow(WAIT[2])}</ul></section>
      <section class="${K.group}" aria-label="Forecast">${groupHead("warning", "Forecast", FORECAST.length, "beds short tomorrow")}
        <ul class="${K.hrows}">${FORECAST.map(forecastRow).join("")}</ul>
        <p class="mk-groupFoot">Shows when a bed type is likely 3 or more short. <button type="button" class="mk-linkBtn" style="height:auto;padding:0">Change in Settings</button></p></section>`;
  }

  // Lanes
  function lcard(x) {
    const sel = S.sel === x.id ? " data-selected" : "";
    const act = x.group === "act" ? " data-act" : "";
    if (x.members) {
      return `<div class="mk-lcard" role="button" tabindex="0" data-sel="${x.id}"${sel}${dimFor(x)}>
        <div class="mk-lcTop"><span class="mk-glyphWrap">${glyph(x.tone)}</span><strong>${esc(x.title)}</strong>${x.age ? `<span class="mk-mono">${x.age}</span>` : ""}</div>
        <div class="mk-lcLine">${x.members.length} people · ${esc(x.members.map((m) => m.person.name).join(" · "))}</div>
        <div class="mk-lcFoot"><span class="mk-ownerTag">${x.members.filter(isYours).length} yours</span>${btn("Show each", { v: "sec", attrs: `data-sel="${x.id}"` })}</div></div>`;
    }
    if (x.group === "forecast") {
      return `<div class="mk-lcard" role="button" tabindex="0" data-sel="${x.id}"${sel}${S.hl ? " data-dim" : ""}>
        <div class="mk-lcTop"><span class="mk-glyphWrap">${glyph("warning")}</span><strong>${esc(x.title)}</strong></div>
        <div class="mk-lcLine">Likely <strong>${x.likely} short</strong>, at worst ${x.worst}</div>
        <div class="mk-lcFoot"><span class="mk-ownerTag">Tomorrow</span>${btn("See forecast", { v: "sec", attrs: `data-sel="${x.id}"` })}</div></div>`;
    }
    return `<div class="mk-lcard" role="button" tabindex="0" data-sel="${x.id}"${act}${sel}${dimFor(x)}>
      <div class="mk-lcTop"><span class="mk-glyphWrap">${glyph(x.tone)}</span><strong>${esc(x.title)}</strong>${x.age ? `<span class="mk-mono">${x.age}</span>` : ""}</div>
      <div class="mk-lcLine"><strong>${esc(x.person.name)}</strong> ${x.person.planned ? `<span style="color:var(--wf-ink-3)">${x.person.umrn}</span>` : `<span class="mk-mono">${x.person.umrn}</span>`}</div>
      <div class="mk-lcLine">${esc(x.where)}</div>
      <div class="mk-lcFoot"><span class="mk-ownerTag">${isYours(x) ? "Yours" : esc(x.ownerShort || x.owner)}</span>${actionBtn(x, x.person.name)}</div></div>`;
  }
  function lanesView() {
    const lane = (tone, label, n, aside, cards) =>
      `<section class="mk-lane" aria-label="${label}"><div class="mk-laneHead">${glyph(tone, 9)}<span>${label}</span>${cnt(n)}<span class="mk-laneAside">${aside}</span></div>${cards}</section>`;
    return `<div class="mk-lanes">
      ${lane("danger", "Act now", ACT.length, "most urgent first", ACT.map(lcard).join(""))}
      ${lane("warning", "Waiting", 9, "oldest first", WAIT.map(lcard).join(""))}
      ${lane("warning", "Forecast", 2, "tomorrow", FORECAST.map(lcard).join("") + `<div class="mk-laneHead" style="margin-top:8px">${glyph("neutral", 9)}<span>Snoozed</span><span class="mk-laneAside">none</span></div><div class="mk-laneEmpty">A snoozed alert waits here and returns at its time. A snoozed act-now alert also stays listed in Act now.</div>`)}
    </div>`;
  }
  // Owner
  function ownerView() {
    const items = [
      ...ACT,
      WAIT[0],
      ...TRANSPORT.map((t) => ({
        ...t,
        group: "wait",
        tone: "warning",
        title: "Transport awaiting departure",
        where: `to ${t.to}, from ${t.from}`,
        ageNote: `since ${t.since}`,
        action: "Chase transport",
      })),
      ...NOTIFY.map((n) => ({
        ...n,
        group: "wait",
        tone: "warning",
        title: `${n.type} notifications to record`,
        where: n.where,
        age: "",
        ageNote: "Time not recorded",
        action: "Record",
      })),
    ];
    const owners = {};
    items.forEach((x) => {
      const o = isYours(x) ? "you" : x.owner;
      (owners[o] = owners[o] || []).push(x);
    });
    const order = [
      "you",
      ...Object.keys(owners)
        .filter((o) => o !== "you")
        .sort(),
    ];
    return order
      .map((o) => {
        const list = owners[o].sort((a, b) => (a.group === "act" ? 0 : 1) - (b.group === "act" ? 0 : 1));
        const actN = list.filter((x) => x.group === "act").length;
        const label = o === "you" ? "You, bed coordinator" : o;
        return `<section class="${K.group}" aria-label="${esc(label)}">${groupHead(actN ? "danger" : "", label, list.length, actN ? `${actN} act now` : "")}
        <ul class="${K.hrows}">${list.map((x) => hrow({ ...x, owner: o === "you" ? "you" : "" })).join("")}</ul></section>`;
      })
      .join("");
  }

  // ---------- tabs ----------
  function sentCard() {
    const x = S.sent;
    if (!x) return "";
    const [sevL, tone] = SEV[x.sev],
      ask = x.kind === "ask";
    const left = x.dur >= 60 ? `${x.dur / 60}h` : `${x.dur}m`;
    return `<article class="mk-bc" aria-label="Broadcast you just sent">
        <div class="mk-bcHead"><span class="mk-livePulse" aria-hidden="true"></span><strong style="color:var(--wf-ink-1)">Live</strong>
          <span class="mk-tag" ${tone ? `data-tone="${tone}"` : ""}>${sevL}</span><span class="mk-tag">${ask ? "Bed call" : "Message"}</span><span>${esc(x.label)} (${x.n}) · sent 10:42 by you</span>
          <span class="mk-bcLeft"><b>${left}</b> left, ends ${endAt(x.dur)}</span></div>
        <div class="mk-bcBody"><h3>${esc(x.title)}</h3><p>${esc(x.msg)}</p>
          <div class="mk-stack" role="img" aria-label="No answers yet"><i data-a="none" style="flex:1"></i></div>
          <div class="mk-stackKey"><span><i class="mk-sw" data-a="none"></i>${ask ? "No answer yet" : "Not acknowledged yet"} <b>${x.n}</b></span><span style="margin-left:auto">0 of ${x.n} ${ask ? "answered" : "acknowledged"}</span></div></div>
        <div class="mk-bcFoot">${btn("Extend 30m", { v: "sec", icon: "clock" })}${btn("Add units", { v: "sec", icon: "users" })}<span class="mk-spacer"></span>${btn("Stand down", { v: "sec", attrs: 'data-act="standdownSent"' })}</div>
      </article>`;
  }
  function bcPanel() {
    if (!S.bcLive && S.sent) return `<div class="mk-tabBody">${sentCard()}${earlier()}</div>`;
    if (!S.bcLive) {
      return `<div class="mk-tabBody"><div class="mk-empty"><span class="mk-iconTile">${ic("radio", 20)}</span><strong>No broadcast live</strong>
        <span>A broadcast reaches every ward and ED desk you choose, and shows who has answered.</span>${btn("Broadcast alert", { v: "pri", icon: "radio", attrs: 'data-act="compose"' })}</div>${earlier()}</div>`;
    }
    const counts = { take: 0, after: 0, cant: 0, none: 0 };
    BC_WARDS.forEach((w) => counts[w[1]]++);
    const total = BC_WARDS.length;
    return `<div class="mk-tabBody">${sentCard()}
      <article class="mk-bc" aria-label="Live broadcast">
        <div class="mk-bcHead"><span class="mk-livePulse" aria-hidden="true"></span><strong style="color:var(--wf-ink-1)">Live</strong>
          <span class="mk-tag" data-tone="warning">Warning</span><span class="mk-tag">Bed call</span><span>Metro adult wards (9) · sent 10:20 by you</span>
          <span class="mk-bcLeft"><b>38m</b> left, ends 11:20</span></div>
        <div class="mk-bcBody"><h3>Bed call for adult beds today</h3>
          <p>Wards with a bed today, answer how many and when it is ready.</p>
          <div class="mk-stack" role="img" aria-label="${counts.take} can take, ${counts.after} after a discharge, ${counts.cant} can't, ${counts.none} no answer yet">
            ${["take", "after", "cant", "none"].map((a) => (counts[a] ? `<i data-a="${a}" style="flex:${counts[a]}"></i>` : "")).join("")}</div>
          <div class="mk-stackKey">${["take", "after", "cant", "none"].map((a) => `<span><i class="mk-sw" data-a="${a}"></i>${ANSWER[a][0]} <b>${counts[a]}</b></span>`).join("")}<span style="margin-left:auto">${total - counts.none} of ${total} answered</span></div>
          <table class="mk-table"><thead><tr><th>Ward</th><th>Answer</th><th>Detail</th><th>Answered</th></tr></thead><tbody>
            ${BC_WARDS.map(([w, a, d, t]) => `<tr><td>${esc(w)}</td><td>${a === "none" ? `<span class="mk-dim" style="color:var(--wf-ink-3)">No answer yet</span>` : `<span class="mk-tag" ${ANSWER[a][1] ? `data-tone="${ANSWER[a][1]}"` : ""}>${ANSWER[a][0]}</span>`}</td><td>${esc(d)}</td><td class="mk-mono">${t}</td></tr>`).join("")}
          </tbody></table></div>
        <div class="mk-bcFoot">${btn("Extend 30m", { v: "sec", icon: "clock" })}${btn("Add units", { v: "sec", icon: "users" })}${btn("Copy answers", { v: "ghost", icon: "copy" })}<span class="mk-spacer"></span>${btn("Stand down", { v: "sec", attrs: 'data-act="standdown"' })}</div>
      </article>${earlier()}</div>`;
  }
  function earlier() {
    return `<div><h3 class="mk-secHead" style="margin-bottom:8px">Earlier today ${cnt(1)}</h3><ul class="mk-plain">
      <li><time>08:15</time><span class="mk-iconTile">${ic("radio", 14)}</span><span class="mk-pl"><strong>HDU full, check discharges</strong><span>Advisory · All wards and ED desks · stood down 09:05 · 9 of 11 acknowledged</span></span>${btn("View", { v: "ghost" })}</li></ul></div>`;
  }
  function noticesPanel() {
    return `<div class="mk-tabBody"><div class="mk-filterRow"><h3 class="mk-secHead" style="flex:1">Notices for your desk ${cnt(NOTICES.length)}<span class="mk-secAside">newest first, this shift</span></h3></div>
      <ul class="mk-plain">${NOTICES.map(
        ([
          t,
          tone,
          icn,
          title,
          n,
          u,
          line,
        ]) => `<li><time>${t}</time><span class="mk-iconTile" data-tone="${tone}">${ic(icn, 14)}</span>
      <span class="mk-pl"><strong>${title}</strong><span><b>${n}</b> <span class="mk-mono">${u}</span> · ${line}</span></span>${btn("Open", { v: "ghost", end: "chevron-right" })}</li>`,
      ).join("")}</ul>
      <p style="margin:0;color:var(--wf-ink-3);font:400 var(--wf-fs-12)/var(--wf-lh-12) var(--wf-font)">Notices tell you what changed. Anything you need to act on is also in Now.</p></div>`;
  }
  function historyPanel() {
    const f = S.histFilter;
    const rows = HISTORY.filter((h) => f === "all" || h[1] === f);
    const n = (k) => HISTORY.filter((h) => k === "all" || h[1] === k).length;
    const seg = [
      ["all", "All"],
      ["acted", "Acted on"],
      ["snoozed", "Snoozed"],
      ["broadcast", "Broadcasts"],
    ]
      .map(
        ([id, l]) =>
          `<button type="button" role="radio" aria-checked="${f === id}" class="${K.segItem} ${f === id ? K.segOn : ""}" data-hist="${id}">${l}<span class="${K.count} ${K.k}"><span>${n(id)}</span></span></button>`,
      )
      .join("");
    const tone = { acted: "success", snoozed: "", broadcast: "accent" };
    return `<div class="mk-tabBody"><div class="mk-filterRow"><div role="radiogroup" aria-label="Show" class="${K.seg} ${K.segMd}">${seg}</div>
      <span style="margin-left:auto;color:var(--wf-ink-3);font:400 var(--wf-fs-12)/1 var(--wf-font)">This session, newest first</span></div>
      <ul class="mk-plain">${rows
        .map(
          ([
            t,
            k,
            icn,
            verb,
            title,
            who,
            u,
          ]) => `<li><time>${t}</time><span class="mk-iconTile" ${tone[k] ? `data-tone="${tone[k]}"` : ""}>${ic(icn, 14)}</span>
      <span class="mk-pl"><strong>${esc(verb)}</strong><span>${esc(title)} · <b>${esc(who)}</b>${u ? ` <span class="mk-mono">${u}</span>` : ""}</span></span><span></span></li>`,
        )
        .join("")}</ul></div>`;
  }

  // ---------- side panel ----------
  function findSel() {
    const all = [
      ...ACT,
      ...WAIT,
      ...FORECAST,
      ...TRANSPORT.map((t) => ({ ...t, parent: "w2" })),
      ...NOTIFY.map((n) => ({ ...n, parent: "w3" })),
    ];
    return all.find((x) => x.id === S.sel) || ACT[0];
  }
  function panelHtml() {
    const x = findSel();
    const first = !S.chosen && x.id === firstAct();
    const firstLine = first
      ? `<div class="mk-pFirst">${ic("info", 14)} First in line. Not chosen yet, so check the name before you act.</div>`
      : "";
    let head,
      state = "",
      facts = "",
      body = "",
      primary = "",
      secondary = "",
      why = "",
      tabs = true,
      activity = [];

    const personHead = (
      p,
    ) => `<div class="mk-pHead"><span class="mk-avatar" aria-hidden="true">${p.planned ? "RK" : initials(p.name)}</span>
      <div><h2 class="mk-pName">${esc(p.name)}</h2><p class="mk-pSub"><span class="${p.planned ? "" : "mk-mono"}">${esc(p.umrn)}</span> · ${esc(p.legal)}</p></div>
      ${p.planned ? "" : `<button type="button" class="mk-linkBtn">Patient ${ic("chevron-right", 14)}</button>`}</div>`;
    const secRow = (items) => `<div class="mk-secRow">${items.join("")}</div>`;
    const moreMenu = (items) =>
      `<div class="mk-menu">${btn("More", { v: "sec", end: "chevron-up", attrs: `data-act="menu" aria-expanded="${S.menu === "more"}"` })}${S.menu === "more" ? `<div class="mk-menuList" role="menu">${items.join("")}</div>` : ""}</div>`;
    const mi = (icn, label, note, disabled) =>
      `<button type="button" role="menuitem" ${disabled ? 'aria-disabled="true"' : ""}>${ic(icn, 16)}<span class="mk-menuItemText">${label}${note ? `<small>${note}</small>` : ""}</span></button>`;
    const snooze = `<div class="mk-menu">${btn("Snooze", { v: "sec", icon: "alarm-clock", attrs: `data-act="snooze" aria-expanded="${S.menu === "snooze"}"` })}${S.menu === "snooze" ? `<div class="mk-menuList" role="menu" style="right:auto;left:0">${mi("clock", "15 minutes", "Back at 10:57, still listed in Act now")}${mi("clock", "30 minutes", "Back at 11:12")}${mi("clock", "1 hour", "Back at 11:42")}</div>` : ""}</div>`;

    if (x.group === "act" || x.kind === "planned") {
      head = personHead(x.person);
      const act = x.group === "act";
      state = `<div class="mk-state" ${act ? "data-act" : ""}><div class="mk-stateTop">${glyph(x.tone)}<span>${esc(x.title)}</span>${x.age ? `<span class="mk-stateAge" data-tone="${act ? "danger" : ""}">${x.age}</span>` : ""}</div>`;
      if (x.kind === "hold") {
        state += `<div class="mk-stateNote">The bed is still held at BTY Adult Secure. Release it or pull again.</div>
          <div class="mk-wt" aria-hidden="true"><span class="mk-wtLine"></span><span class="mk-wtOver" style="left:93.4%;width:6.6%"></span><span class="mk-wtPt" style="left:0%"></span><span class="mk-wtPt" data-tone="danger" style="left:93.4%"></span><span class="mk-wtNow" style="left:100%"></span></div>
          <div class="mk-wtAxis"><span>In ED from 03:52</span><span>Pull ended 10:32</span><b>10:42</b></div>`;
        activity = [
          ["10:02", "neutral", "Bed pulled at BTY Adult Secure, limit 10:32"],
          ["10:32", "danger", "Pull limit passed, raised to you"],
        ];
      } else if (x.kind === "declines") {
        state += `<div class="mk-stateNote">Three wards have declined. No ward has accepted.</div>`;
        activity = [
          ["10:21", "neutral", "Joondalup Adult declined"],
          ["10:30", "neutral", "Bentley Adult Open declined"],
          ["10:37", "danger", "Fiona Stanley Adult declined, raised to you"],
          ["10:39", "success", "Taken by you"],
        ];
      } else if (x.kind === "accepted") {
        state += `<div class="mk-stateNote">Bunbury Acute Psychiatric Unit accepted at 09:57. Pull the bed to hold it.</div>`;
        activity = [
          ["09:57", "neutral", "Accepted by Bunbury Acute Psychiatric Unit"],
          ["09:57", "danger", "Bed not pulled, raised to you"],
        ];
      } else if (x.kind === "nobed") {
        state += `<div class="mk-stateNote">No ward in the network is eligible now. Priya stays on the waiting list.</div>`;
        activity = [["—", "danger", "Raised, time not recorded"]];
      } else {
        state += `<div class="mk-stateNote">Expected at 09:30. No arrival recorded.</div>`;
        activity = [["09:30", "warning", "Expected arrival time passed"]];
      }
      state += `</div>`;
      const F = {
        hold: [
          ["From", "St John of God Midland ED"],
          ["To", "BTY Adult Secure"],
          ["Form due", "15:42<small>as typed</small>"],
          ["Owner", "You<small>Bed coordinator</small>"],
        ],
        declines: [
          ["At", "Peel Health Campus ED"],
          ["Asking for", "Adult ward bed"],
          ["Legal status", "Involuntary inpatient"],
          ["Owner", "You<small>Bed coordinator</small>"],
        ],
        accepted: [
          ["From", "Bunbury Community Team"],
          ["To", "Bunbury Acute Psychiatric Unit"],
          ["Legal status", "Voluntary"],
          ["Owner", "You<small>Bed coordinator</small>"],
        ],
        nobed: [
          ["At", "St John of God Midland ED"],
          ["Asking for", "Adult ward bed"],
          ["Wards eligible now", "0 of 18"],
          ["Owner", "You<small>Bed coordinator</small>"],
        ],
        planned: [
          ["Planned ward", "Maali (Ward 4.2)"],
          ["Expected", "09:30 today"],
          ["Legal status", "Voluntary"],
          ["Owner", "Maali (Ward 4.2)"],
        ],
      }[x.kind];
      facts = `<dl class="mk-facts">${F.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
      if (x.kind === "hold") {
        body = `<div class="mk-field"><label for="mk-reason">Reason for release</label><div class="${K.formIn}"><select id="mk-reason" class="${K.formControl} ${K.formSelect}" data-act="reason">
          <option value="">Choose a reason</option>${["No longer coming", "Bed needed elsewhere", "Ward withdrew the bed", "Pull made in error"].map((r) => `<option ${S.reason === r ? "selected" : ""}>${r}</option>`).join("")}</select><span class="mk-caret">${ic("chevron-down", 16)}</span></div></div>`;
        primary = btn(`Release pulled bed for ${esc(x.person.name)}`, {
          v: "pri",
          cls: "mk-primary",
          attrs: 'data-act="primary"',
          disabled: S.reason ? "" : "Choose a reason first",
        });
        why = S.reason ? "" : `<span class="mk-why">${ic("info", 14)} Choose a reason first</span>`;
        secondary = secRow([
          btn("Pull again", { v: "sec", icon: "bed-double" }),
          snooze,
          moreMenu([
            mi("user-round", "Hand back", "Return it to the shared list"),
            mi("check", "Acknowledge", "Mark as seen, keep it open"),
          ]),
        ]);
      } else if (x.kind === "accepted") {
        body = `<p>Pulling holds the bed at Bunbury Acute Psychiatric Unit and starts the pull limit.</p>`;
        primary = btn(`Pull the bed for ${esc(x.person.name)}`, { v: "pri", cls: "mk-primary", icon: "bed-double" });
        secondary = secRow([
          btn("Open referral", { v: "sec", icon: "file-text" }),
          snooze,
          moreMenu([
            mi("user-round", "Hand back", "Return it to the shared list"),
            mi("check", "Acknowledge", "Mark as seen, keep it open"),
          ]),
        ]);
      } else if (x.kind === "declines" || x.kind === "nobed") {
        body =
          x.kind === "declines"
            ? `<span class="mk-fieldLabel">Declined</span><ul class="mk-declines">
          <li>${glyph("neutral", 9)} Joondalup Adult<time>10:21</time></li><li>${glyph("neutral", 9)} Bentley Adult Open<time>10:30</time></li><li>${glyph("danger", 9)} Fiona Stanley Adult<time>10:37</time></li></ul>`
            : `<p>Escalate when the bed search is exhausted. It records that the state desk was rung.</p>`;
        primary = btn(`Find a bed for ${esc(x.person.name)}`, {
          v: x.id === firstAct() ? "pri" : "pri",
          cls: "mk-primary",
          icon: "bed-double",
        });
        secondary = secRow([
          btn("Escalate", {
            v: "sec",
            icon: "arrow-up-right",
            disabled: x.kind === "declines" ? "Wards are still eligible, so the search is not exhausted" : "",
          }),
          snooze,
          moreMenu([mi("user-round", "Hand back", ""), mi("check", "Acknowledge", "")]),
        ]);
        if (x.kind === "declines")
          why = `<span class="mk-why">${ic("info", 14)} Escalate opens once no ward is eligible.</span>`;
      } else {
        body = `<p>Record the arrival, or open the booking to change the time or cancel it.</p>`;
        primary = btn("Open bookings", { v: "pri", cls: "mk-primary", icon: "calendar-clock" });
        secondary = secRow([
          btn("Record arrival", { v: "sec", icon: "check" }),
          snooze,
          moreMenu([mi("user-round", "Take", "Make this yours"), mi("check", "Acknowledge", "")]),
        ]);
      }
    } else if (x.parent === "w2") {
      head = personHead(x.person);
      state = `<div class="mk-state"><div class="mk-stateTop">${glyph("warning")}<span>Transport awaiting departure</span><span class="mk-stateAge">${x.age}</span></div><div class="mk-stateNote">Accepted and booked at ${x.since}. Not left yet.</div></div>`;
      facts = `<dl class="mk-facts"><div><dt>From</dt><dd>${esc(x.from)}</dd></div><div><dt>To</dt><dd>${esc(x.to)}</dd></div><div><dt>Provider</dt><dd>Hospital transport</dd></div><div><dt>Owner</dt><dd>${isYours(x) ? "You<small>Bed coordinator</small>" : esc(x.owner)}</dd></div></dl>`;
      body = `<p>Chase opens the booking with the provider's number. Record the departure once they leave.</p>`;
      primary = btn(`Chase transport for ${esc(x.person.name)}`, { v: "pri", cls: "mk-primary", icon: "truck" });
      secondary = secRow([
        btn("Record departure", { v: "sec", icon: "check" }),
        snooze,
        moreMenu([mi("user-round", isYours(x) ? "Hand back" : "Take", ""), mi("check", "Acknowledge", "")]),
      ]);
      activity = [[x.since, "warning", "Transport booked, raised when not left"]];
    } else if (x.parent === "w3") {
      head = personHead(x.person);
      state = `<div class="mk-state"><div class="mk-stateTop">${glyph("warning")}<span>${x.type} notifications to record</span></div><div class="mk-stateNote">Carer, personal support person and advocacy notifications are not recorded.</div></div>`;
      facts = `<dl class="mk-facts"><div data-wide><dt>Where</dt><dd>${esc(x.where)}</dd></div><div><dt>Legal status</dt><dd>${esc(x.person.legal)}</dd></div><div style="border-top:1px solid var(--wf-line)"><dt>Owner</dt><dd>${esc(x.owner)}</dd></div></dl>`;
      body = `<p>Record who was told, or record that a notification is not needed.</p>`;
      primary = btn(`Record notifications for ${esc(x.person.name)}`, {
        v: "pri",
        cls: "mk-primary",
        icon: "clipboard-list",
      });
      secondary = secRow([snooze, moreMenu([mi("user-round", "Take", ""), mi("check", "Acknowledge", "")])]);
      activity = [["—", "warning", "Raised, time not recorded"]];
    } else if (x.members) {
      head = `<div class="mk-pHead"><span class="mk-avatar" data-kind="group" aria-hidden="true">${x.members.length}</span><div><h2 class="mk-pName">${esc(x.title)}</h2><p class="mk-pSub">${x.members.length} people · ${x.members.filter(isYours).length} yours</p></div><span></span></div>`;
      body = `<ul class="mk-pGroupList">${x.members.map((m) => `<li><span><strong>${esc(m.person.name)}</strong> <span class="mk-mono">${m.person.umrn}</span><br>${x.kind === "transport" ? `to ${esc(m.to)}` : `${m.type} · ${esc(m.where)}`}</span>${btn("Open", { v: "ghost", attrs: `data-sel="${m.id}"`, end: "chevron-right" })}</li>`).join("")}</ul>`;
      primary = btn(x.kind === "transport" ? "Copy the list for the transport desk" : "Open notifications to record", {
        v: "sec",
        cls: "mk-primary",
        icon: x.kind === "transport" ? "copy" : "clipboard-list",
      });
      tabs = false;
    } else {
      head = `<div class="mk-pHead"><span class="mk-avatar" data-kind="group" aria-hidden="true">${ic("bed-double", 18)}</span><div><h2 class="mk-pName">${esc(x.title)}</h2><p class="mk-pSub">Forecast for tomorrow · estimate only</p></div><span></span></div>`;
      state = `<div class="mk-state"><div class="mk-stateTop">${glyph("warning")}<span>Likely ${x.likely} short</span><span class="mk-stateAge">${x.best} to ${x.worst}</span></div><div class="mk-stateNote">Range from today's waits, planned arrivals and expected discharges.</div></div>`;
      body = `<p>This shows because the likely shortfall is 3 beds or more. Change that level in Settings.</p>`;
      primary = btn("See forecast", { v: "pri", cls: "mk-primary", end: "arrow-right" });
      secondary = secRow([btn("Change alert level", { v: "sec" })]);
      tabs = false;
    }
    const pTabs = tabs
      ? `<div class="mk-pTabs"><div role="tablist" aria-label="Alert" class="${K.tabs}">
        <button type="button" role="tab" aria-selected="${S.pTab === "act"}" class="${K.tab}" data-ptab="act">Act</button>
        <button type="button" role="tab" aria-selected="${S.pTab === "activity"}" class="${K.tab}" data-ptab="activity">Activity${cnt(activity.length, K.k)}</button></div></div>`
      : "";
    const actBody =
      S.pTab === "activity" && tabs
        ? `<ul class="mk-activity">${activity.map(([t, tone, l]) => `<li><time>${t}</time>${glyph(tone, 9)}<span>${esc(l)}</span></li>`).join("")}</ul>`
        : body;
    return `${firstLine}<div class="mk-pScroll">${head}${state}${facts}${pTabs}<div class="mk-pBody">${actBody}</div></div>
      <div class="mk-pFoot">${why}${primary}${secondary}</div>`;
  }

  // ---------- page ----------
  function listCard() {
    const now = 1 + ACT.length + 1 + TRANSPORT.length + NOTIFY.length - 1;
    const tabs = [
      ["now", "Now", now],
      ["broadcast", "Broadcast", (S.bcLive ? 1 : 0) + (S.sent ? 1 : 0)],
      ["notices", "Notices", NOTICES.length],
      ["history", "History", HISTORY.length],
    ];
    const tabHtml = tabs
      .map(
        ([id, l, n]) =>
          `<button type="button" role="tab" aria-selected="${S.tab === id}" class="${PHONE ? K.ptItem : K.tab}" data-tab="${id}">${l}${cnt(n, K.k)}</button>`,
      )
      .join("");
    const views = [
      ["urgency", "list", "Urgency"],
      ["lanes", "columns-3", "Lanes"],
      ["owner", "users", "Owner"],
    ];
    const viewSeg =
      S.tab === "now" && !PHONE
        ? `<div role="radiogroup" aria-label="Arrange by" class="${K.seg} ${K.segMd} mk-viewSwitch">${views
            .map(
              ([id, icn, l]) =>
                `<button type="button" role="radio" aria-checked="${S.view === id}" class="${K.segItem} ${S.view === id ? K.segOn : ""}" data-view="${id}">${ic(icn, 14)} ${l}</button>`,
            )
            .join("")}</div>`
        : "";
    const hlNote =
      S.hl && S.tab === "now"
        ? `<div class="mk-toolNote" role="status">${glyph(S.hl === "act" ? "danger" : S.hl === "wait" ? "warning" : "neutral", 9)} Highlighting ${S.hl === "act" ? "act now" : S.hl === "wait" ? "waiting" : "yours"}. Every alert stays listed, and act now is never dimmed.${btn("Clear", { v: "ghost", attrs: 'data-hl="clear"' })}</div>`
        : "";
    let content = "";
    if (S.tab === "now")
      content = PHONE
        ? phoneNow()
        : S.view === "lanes"
          ? lanesView()
          : S.view === "owner"
            ? ownerView()
            : urgencyView();
    if (S.tab === "broadcast") content = bcPanel();
    if (S.tab === "notices") content = noticesPanel();
    if (S.tab === "history") content = historyPanel();
    if (PHONE) {
      return `<section class="mk-list" aria-label="Alerts"><div class="${K.tabsBar}"><div role="tablist" aria-label="Alerts views" class="${K.pt} ${K.ptFill}">${tabHtml}</div></div>${content}</section>`;
    }
    return `<section class="${K.card} mk-list" aria-label="Alerts"><div class="mk-toolbar"><div role="tablist" aria-label="Alerts views" class="${K.tabs}">${tabHtml}</div>${viewSeg}</div>${hlNote}${content}</section>`;
  }

  // ---------- phone ----------
  function prow(x, opts = {}) {
    const act = x.group === "act" ? " data-act" : "";
    const p = x.person;
    const owner = isYours(x) ? "You" : x.ownerShort || x.owner || "";
    return `<li class="mk-prow" role="button" tabindex="0" data-sel="${x.id}"${act}${dimFor(x)}><span class="mk-glyphWrap">${glyph(x.tone || "warning")}</span>
      <span class="mk-prowText"><strong>${esc(opts.title || x.title)}</strong><span><b>${esc(p.name)}</b> <span class="mk-mono">${esc(p.umrn)}</span></span><span>${esc(opts.where || x.where)}</span></span>
      <span class="mk-prowEnd">${x.age ? `<b ${x.group === "act" ? 'data-tone="danger"' : ""}>${x.age}</b>` : ""}<span>${esc(owner)}</span></span></li>`;
  }
  function phoneNow() {
    const yours = S.ownerChip === "yours";
    const keep = (x) => !yours || isYours(x) || x.group === "act";
    const tr = TRANSPORT.filter(keep),
      nt = NOTIFY.filter(keep);
    const g = (tone, label, n, aside, rows) =>
      `<section class="mk-pgroup" aria-label="${label}"><h2>${glyph(tone, 9)}<span>${label}</span>${cnt(n)}<span class="mk-ghAside">${aside}</span></h2><ul style="list-style:none;margin:0;padding:0">${rows}</ul></section>`;
    return `<div class="mk-phoneOwner" role="group" aria-label="Show">
        <button type="button" class="mk-chip" aria-pressed="${!yours}" data-owner="all">All ${flat().length}</button>
        <button type="button" class="mk-chip" aria-pressed="${yours}" data-owner="yours">Yours ${flat().filter(isYours).length}</button>
        <button type="button" class="mk-chip" aria-pressed="false" data-owner="all">Other owners ${ic("chevron-down", 14)}</button></div>
      <div class="mk-phoneList">
      ${g("danger", "Act now", ACT.length, "always shown", ACT.map((x) => prow(x)).join(""))}
      <div style="height:12px"></div>
      ${g("warning", "Waiting", 9, "oldest first", (keep(WAIT[0]) ? prow(WAIT[0]) : "") + tr.map((t) => prow({ ...t, tone: "warning", group: "wait" }, { title: "Transport awaiting departure", where: `to ${t.to}` })).join("") + nt.map((n) => prow({ ...n, tone: "warning", group: "wait", age: "" }, { title: `${n.type} notifications to record`, where: n.where })).join(""))}
      <div style="height:12px"></div>
      ${g("warning", "Forecast", 2, "tomorrow", FORECAST.map((f) => `<li class="mk-prow" role="button" tabindex="0" data-sel="${f.id}"><span class="mk-glyphWrap">${glyph("warning")}</span><span class="mk-prowText"><strong>${f.title}</strong><span>Likely <b>${f.likely} short</b>, at worst ${f.worst}</span></span><span class="mk-prowEnd">${ic("chevron-right", 16)}</span></li>`).join(""))}
      <button type="button" class="mk-todayCard" data-act="today">${ic("clock", 18)}<span><strong>Today</strong><b>8</b> raised · <b>3</b> acted on · <b>${S.bcLive ? 1 : 0}</b> broadcast</span>${ic("chevron-right", 16)}</button>
      </div>`;
  }
  function phoneHero() {
    const fig = (id, n, tone, label) =>
      `<li class="${K.phFig}"><button type="button" class="${K.phFigB}" aria-pressed="${S.hl === id}" data-hl="${id}"><span class="${K.phV}">${n}</span><span class="${K.phL}">${tone ? glyph(tone, 9) : ""}<span class="${K.phLT}">${label}</span></span></button></li>`;
    return `<section class="${K.ph}" aria-labelledby="mk-h1" style="--wf-band-top:12px;--wf-band-left:12px;--wf-band-right:12px;" data-band="on">
      <div class="${K.phTB}"><div class="${K.phER}"><p class="${K.phE}">Alerts</p><span class="${K.phChip}"><span class="${K.live}"><span class="${K.lv} ${K.lvHero}"><span class="${K.pulse}"></span>Demo <span class="${K.lvU}">10:42</span></span></span></span></div>
      <h1 id="mk-h1" class="${K.phT}">${ACT.length} act now, ${1 + TRANSPORT.length + NOTIFY.length} waiting</h1><p class="${K.phSub}">oldest 1h 12m${S.bcLive ? " · broadcast live" : ""}</p></div>
      <ul class="${K.phFigs}" data-count="3">${fig("act", ACT.length, "danger", "Act now")}${fig("wait", 1 + TRANSPORT.length + NOTIFY.length, "warning", "Waiting")}${fig("yours", flat().filter(isYours).length, "", "Yours")}</ul>
      <div class="${K.phActs}"><div class="${K.phPills}">${btn("Next alert", { v: "light", size: "md", icon: "chevron-right", cls: K.phPill, attrs: 'data-act="next"' })}${btn("Broadcast", { v: "onHero", size: "md", icon: "radio", cls: K.phPill, attrs: 'data-act="compose"' })}${btn("", { v: "onHero", size: "md", icon: "ellipsis", cls: K.phPill + " " + K.iconOnly, attrs: 'aria-label="More: pause the list, notify me, copy for handover"' })}</div></div>
    </section>`;
  }

  // ---------- broadcast composer ----------
  const BC_GROUPS = [
    { id: "metro", label: "Metro adult wards", units: BC_WARDS.map((w) => w[0]) },
    {
      id: "older",
      label: "Older adult wards",
      units: [
        "SCGH Older Adult",
        "RPH Older Adult",
        "Bentley Older Adult",
        "Armadale Older Adult",
        "Fremantle Older Adult",
      ],
    },
    {
      id: "youth",
      label: "Youth and CAMHS",
      units: ["East Metropolitan Youth Unit", "PCH Ward 5A", "Bentley Adolescent Unit"],
    },
    { id: "secure", label: "Secure and forensic", units: ["BTY Adult Secure", "FSH Adult Secure", "Frankland Centre"] },
    {
      id: "regional",
      label: "Regional (WACHS)",
      units: [
        "Bunbury Acute Psychiatric Unit",
        "Albany Mental Health Unit",
        "Kalgoorlie Mental Health Unit",
        "Mabu Liyan / Broome Mental Health Unit",
        "Geraldton Mental Health Unit",
      ],
    },
    {
      id: "ed",
      label: "ED desks",
      units: [
        "Royal Perth Hospital ED",
        "Fiona Stanley Hospital ED",
        "Sir Charles Gairdner Hospital ED",
        "St John of God Midland ED",
        "Joondalup Health Campus ED",
        "Armadale Hospital ED",
        "Rockingham General Hospital ED",
        "Peel Health Campus ED",
      ],
    },
  ];
  const BED_NOW = [
    "Armadale Adult",
    "Bentley Adult Open",
    "Fiona Stanley Adult",
    "Joondalup Adult",
    "Rockingham Adult",
  ];
  const ALL_UNITS = BC_GROUPS.flatMap((g) => g.units);
  const TPL = {
    ask: [
      [
        "adult",
        "Adult beds today",
        "Bed call for adult beds today",
        "Wards with a bed today, answer how many and when it is ready.",
        "warning",
        60,
        ["metro"],
      ],
      [
        "older",
        "Older adult beds",
        "Bed call for older adult beds",
        "Older adult wards with a bed today, answer how many and when it is ready.",
        "warning",
        120,
        ["older"],
      ],
      [
        "youth",
        "Youth beds",
        "Bed call for youth beds",
        "Youth wards with a bed today, answer how many and when it is ready.",
        "warning",
        120,
        ["youth"],
      ],
      [
        "secure",
        "Secure beds",
        "Bed call for secure beds",
        "Secure wards with a bed today, answer how many and when it is ready.",
        "critical",
        60,
        ["secure"],
      ],
    ],
    tell: [
      [
        "hdu",
        "HDU full",
        "HDU full, check discharges",
        "Metro HDU beds are full. Review today's planned discharges and tell the bed coordinator.",
        "critical",
        240,
        "all",
      ],
      [
        "ed",
        "ED waits over 24h",
        "ED waits over 24 hours",
        "People are waiting over 24 hours in metro EDs. Bring forward discharges planned for today.",
        "critical",
        240,
        ["metro", "ed"],
      ],
      [
        "transport",
        "Transport delayed",
        "Hospital transport delayed",
        "Transport is running about 2 hours late. Plan departures with this in mind.",
        "warning",
        180,
        "all",
      ],
      [
        "closed",
        "Unit closed",
        "Swan Adult closed to admissions",
        "Swan Adult is closed to admissions for an outbreak. Do not send referrals there.",
        "warning",
        480,
        ["metro", "ed"],
      ],
      [
        "flights",
        "Regional flights paused",
        "Regional air transfers paused",
        "Air transfers from regional sites are paused for weather. Expect delays to regional arrivals.",
        "advisory",
        720,
        ["regional", "ed"],
      ],
      ["blank", "Blank", "", "", "advisory", 60, []],
    ],
  };
  const SEV = {
    advisory: ["Advisory", "", "For information. No action needed."],
    warning: ["Warning", "warning", "Needs attention today."],
    critical: ["Critical", "danger", "Needs action now. Use only for safety or gridlock."],
  };
  const DURS = [
    [30, "30m"],
    [60, "1h"],
    [120, "2h"],
    [240, "4h"],
    [480, "8h"],
    [720, "12h"],
  ];
  function applyTpl(kind, id) {
    const t = TPL[kind].find((x) => x[0] === id) || TPL[kind][0];
    Object.assign(S.c, {
      kind,
      tpl: t[0],
      title: t[2],
      msg: t[3],
      sev: t[4],
      dur: t[5],
      aud: t[6] === "all" ? "all" : "groups",
      groups: t[6] === "all" ? [] : [...t[6]],
      bedNow: false,
      confirm: false,
    });
    S.c.picked = [...recipients()];
  }
  function recipients() {
    const c = S.c;
    if (c.aud === "all") return ALL_UNITS;
    if (c.aud === "pick") return ALL_UNITS.filter((u) => c.picked.includes(u));
    const set = new Set(BC_GROUPS.filter((g) => c.groups.includes(g.id)).flatMap((g) => g.units));
    if (c.bedNow) BED_NOW.forEach((u) => set.add(u));
    return ALL_UNITS.filter((u) => set.has(u));
  }
  const endAt = (m) => {
    const t = 10 * 60 + 42 + m;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  function bannerPreview(c, n) {
    const [sevL, tone] = SEV[c.sev];
    const ask = c.kind === "ask";
    return `<div class="mk-banner" data-tone="${tone}">
      <div class="mk-bnTop">${glyph(tone || "neutral", 10)}<span>${ask ? "Bed call" : "Message"} · ${sevL}</span><span class="mk-bnFrom">Bed coordinator · 10:42</span></div>
      <strong id="mk-pvT">${esc(c.title) || '<span class="mk-dim">Title</span>'}</strong>
      <p id="mk-pvM">${esc(c.msg) || '<span class="mk-dim">Message</span>'}</p>
      <div class="mk-bnActs">${ask ? `<span class="mk-fakeBtn" data-on>Can take ${ic("chevron-down", 14)}</span><span class="mk-fakeBtn">After a discharge</span><span class="mk-fakeBtn">Can't</span>` : `<span class="mk-fakeBtn" data-on>Acknowledge</span>`}<span class="mk-bnEnds">until ${endAt(c.dur)}</span></div>
    </div>`;
  }
  function composer() {
    const c = S.c,
      list = recipients(),
      n = list.length,
      ask = c.kind === "ask";
    const kindCard = (id, icn, title, sub) =>
      `<button type="button" role="radio" aria-checked="${c.kind === id}" class="mk-kind" data-c="kind:${id}"><span class="mk-iconTile" data-tone="${c.kind === id ? "accent" : ""}">${ic(icn, 18)}</span><span><strong>${title}</strong><small>${sub}</small></span></button>`;
    const audSeg = [
      ["all", `Everyone`],
      ["groups", "By group"],
      ["pick", "Choose units"],
    ]
      .map(
        ([id, l]) =>
          `<button type="button" role="radio" aria-checked="${c.aud === id}" class="${K.segItem} ${c.aud === id ? K.segOn : ""}" data-c="aud:${id}">${l}</button>`,
      )
      .join("");
    let audBody = "";
    if (c.aud === "all") audBody = `<p class="mk-hint">Every inpatient ward and ED desk in the state network.</p>`;
    else if (c.aud === "groups")
      audBody = `<div class="mk-groupGrid">
        ${ask ? `<button type="button" class="mk-gchip" aria-pressed="${c.bedNow}" data-c="bednow" data-suggest>${ic("sparkles", 14)}<span>Wards with a bed now</span><b>${BED_NOW.length}</b></button>` : ""}
        ${BC_GROUPS.map((g) => `<button type="button" class="mk-gchip" aria-pressed="${c.groups.includes(g.id)}" data-c="grp:${g.id}">${c.groups.includes(g.id) ? ic("check", 14) : ""}<span>${g.label}</span><b>${g.units.length}</b></button>`).join("")}</div>`;
    else
      audBody = `<div class="mk-unitPick">${BC_GROUPS.map((g) => {
        const on = g.units.filter((u) => c.picked.includes(u)).length;
        return `<fieldset><legend><span>${g.label}</span><button type="button" class="mk-linkBtn" data-c="all:${g.id}">${on === g.units.length ? "Clear" : "All"}</button><small>${on} of ${g.units.length}</small></legend>
          ${g.units.map((u) => `<label class="mk-unit"><input type="checkbox" ${c.picked.includes(u) ? "checked" : ""} data-c="unit:${esc(u)}"><span>${esc(u)}</span>${BED_NOW.includes(u) && ask ? `<span class="mk-tag" data-tone="success">Bed now</span>` : ""}</label>`).join("")}</fieldset>`;
      }).join("")}</div>`;
    const tplChips = TPL[c.kind]
      .map(
        (t) =>
          `<button type="button" class="mk-chip" aria-pressed="${c.tpl === t[0]}" data-c="tpl:${t[0]}">${t[1]}</button>`,
      )
      .join("");
    const sevSeg = Object.entries(SEV)
      .map(
        ([id, [l, tone]]) =>
          `<button type="button" role="radio" aria-checked="${c.sev === id}" class="${K.segItem} ${c.sev === id ? K.segOn : ""}" data-c="sev:${id}">${glyph(tone || "neutral", 9)} ${l}</button>`,
      )
      .join("");
    const durSeg = DURS.map(
      ([m, l]) =>
        `<button type="button" role="radio" aria-checked="${c.dur === m}" class="${K.segItem} ${c.dur === m ? K.segOn : ""}" data-c="dur:${m}">${l}</button>`,
    ).join("");
    const live = S.bcLive && ask && list.some((u) => BC_WARDS.some((w) => w[0] === u));
    const shown =
      list
        .slice(0, 6)
        .map((u) => `<span class="mk-tag">${esc(u)}</span>`)
        .join("") + (n > 6 ? `<span class="mk-tag" data-more>+${n - 6} more</span>` : "");
    const ready = n > 0 && c.title.trim() && c.msg.trim();
    const block = !n
      ? "Choose who gets it"
      : !c.title.trim() || !c.msg.trim()
        ? "Add a title and message"
        : !c.confirm
          ? "Tick the box to send"
          : "";
    return `<div class="${PHONE ? "mk-psheetScrim" : "mk-scrim"}" data-act="closeScrim"><div class="${PHONE ? "mk-psheet" : "mk-sheet mk-cmp"}" role="dialog" aria-modal="true" aria-labelledby="mk-comp-h">
      ${PHONE ? '<div class="mk-grab"></div>' : ""}
      <div class="mk-sheetHead"><span class="mk-iconTile" data-tone="accent">${ic("radio", 16)}</span><h2 id="mk-comp-h">New broadcast</h2>${btn("", { v: "ghost", icon: "x", cls: K.iconOnly, attrs: 'data-act="closeComposer" aria-label="Close"' })}</div>
      <div class="mk-cmpBody">
        <div class="mk-cmpForm">
          <section class="mk-step"><h3><span class="mk-stepN">1</span>What do you need?</h3>
            <div class="mk-kinds" role="radiogroup" aria-label="Broadcast type">${kindCard("ask", "bed-double", "Ask wards for beds", "Wards answer: can take, after a discharge, or can't")}${kindCard("tell", "megaphone", "Tell areas something", "Desks acknowledge they have seen it")}</div>
            <div class="mk-field"><span class="mk-fieldLabel">Start from</span><div class="mk-chips">${tplChips}</div></div></section>
          <section class="mk-step"><h3><span class="mk-stepN">2</span>Who gets it<span class="mk-stepAside">${n} ${n === 1 ? "unit" : "units"}</span></h3>
            <div role="radiogroup" aria-label="Audience" class="${K.seg} ${K.segMd} mk-fullSeg">${audSeg}</div>${audBody}
            ${live ? `<div class="mk-note">${ic("info", 14)}<span>A bed call to metro adult wards is already live, with 38m left. Extend it instead of sending a second one?</span>${btn("Extend that one", { v: "sec", size: "sm", attrs: 'data-c="extend"' })}</div>` : ""}</section>
          <section class="mk-step"><h3><span class="mk-stepN">3</span>Message</h3>
            <div class="mk-field"><span class="mk-fieldLabel">How urgent</span><div role="radiogroup" aria-label="Severity" class="${K.seg} ${K.segMd} mk-fullSeg">${sevSeg}</div><p class="mk-hint">${SEV[c.sev][2]}</p></div>
            <div class="mk-field"><label for="mk-t">Title</label><input id="mk-t" class="mk-input" data-c-in="title" maxlength="60" value="${esc(c.title)}" placeholder="Short and specific"></div>
            <div class="mk-field"><label for="mk-m">Message</label><textarea id="mk-m" class="mk-input" data-c-in="msg" maxlength="240" placeholder="What should they do?">${esc(c.msg)}</textarea></div>
            <div class="mk-field"><span class="mk-fieldLabel">Ends after</span><div role="radiogroup" aria-label="Ends after" class="${K.seg} ${K.segMd} mk-fullSeg">${durSeg}</div><p class="mk-hint">Ends at ${endAt(c.dur)}, or when you stand it down.</p></div></section>
        </div>
        <aside class="mk-cmpSide" aria-label="Preview">
          <h3 class="mk-secHead">What each desk sees</h3>${bannerPreview(c, n)}
          <h3 class="mk-secHead">Shows on ${n} ${n === 1 ? "screen" : "screens"}</h3>
          <div class="mk-tagWrap">${n ? shown : `<span class="mk-dim">No one chosen yet</span>`}</div>
          ${ask ? `<p class="mk-hint">You'll see each answer as it comes in, on the Broadcast tab.</p>` : `<p class="mk-hint">You'll see who has acknowledged on the Broadcast tab.</p>`}
        </aside>
      </div>
      <div class="mk-cmpFoot">
        <label class="mk-check"><input type="checkbox" data-c="confirm" ${c.confirm ? "checked" : ""}><span>I'm authorised to send this to ${n} ${n === 1 ? "unit" : "units"}.</span></label>
        <div class="mk-cmpActs">${block ? `<span class="mk-why">${ic("info", 14)} ${block}</span>` : ""}${btn("Cancel", { v: "sec", attrs: 'data-act="closeComposer"' })}${btn(ask ? `Send bed call to ${n} ${n === 1 ? "unit" : "units"}` : `Send to ${n} ${n === 1 ? "unit" : "units"}`, { v: "pri", icon: "send", attrs: 'data-act="send"', disabled: block })}</div>
      </div>
    </div></div>`;
  }

  // ---------- render ----------
  const main = document.getElementById("main-content");
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".mk-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "mk-toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.innerHTML = `${glyph("success", 10)} ${esc(msg)}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2600);
  }
  function render() {
    const scrollers = [...document.querySelectorAll(".mk-pScroll")].map((e) => e.scrollTop);
    if (PHONE) {
      main.innerHTML = `${phoneHero()}<div class="${K.grid}"><div class="${K.column}">${listCard()}</div></div>
        ${
          S.sheet
            ? `<div class="mk-psheetScrim" data-act="closeSheet"><div class="mk-psheet" role="dialog" aria-modal="true" aria-label="Alert"><div class="mk-grab"></div>
          <div class="mk-sheetHead"><h2>${esc(findSel().title || "Alert")}</h2>${btn("", { v: "ghost", icon: "x", cls: K.iconOnly, attrs: 'data-act="closeSheet" aria-label="Close"' })}</div>${panelHtml()}</div></div>`
            : ""
        }
        ${S.composer ? composer() : ""}`;
    } else {
      main.innerHTML = `${hero()}<div class="${K.grid}"><div class="${K.column}">${listCard()}</div>
        <aside class="${K.panel}" aria-label="Selected alert"><div class="${K.card} ${K.panelCard} mk-panelCard">${panelHtml()}</div></aside></div>${S.composer ? composer() : ""}`;
    }
    document.querySelectorAll(".mk-pScroll").forEach((e, i) => (e.scrollTop = scrollers[i] || 0));
  }

  main.addEventListener("click", (e) => {
    const t = e.target.closest(
      "[data-c],[data-act],[data-sel],[data-tab],[data-view],[data-toggle],[data-hl],[data-hist],[data-ptab],[data-owner]",
    );
    if (!t) {
      if (S.menu || S.checks) {
        S.menu = null;
        S.checks = false;
        render();
      }
      return;
    }
    if (t.getAttribute("aria-disabled") === "true") {
      toast(t.dataset.reason || "Not available");
      return;
    }
    const d = t.dataset;
    if (d.c) {
      const [k, v] = d.c.split(/:(.*)/s),
        c = S.c;
      if (k === "kind") applyTpl(v, TPL[v][0][0]);
      else if (k === "tpl") applyTpl(c.kind, v);
      else if (k === "aud") {
        if (v === "pick" && c.aud !== "pick") c.picked = [...recipients()];
        c.aud = v;
      } else if (k === "grp") c.groups = c.groups.includes(v) ? c.groups.filter((g) => g !== v) : [...c.groups, v];
      else if (k === "bednow") c.bedNow = !c.bedNow;
      else if (k === "unit") c.picked = c.picked.includes(v) ? c.picked.filter((u) => u !== v) : [...c.picked, v];
      else if (k === "all") {
        const g = BC_GROUPS.find((x) => x.id === v);
        const allOn = g.units.every((u) => c.picked.includes(u));
        c.picked = allOn ? c.picked.filter((u) => !g.units.includes(u)) : [...new Set([...c.picked, ...g.units])];
      } else if (k === "sev") c.sev = v;
      else if (k === "dur") c.dur = Number(v);
      else if (k === "confirm") c.confirm = t.checked;
      else if (k === "extend") {
        S.composer = false;
        S.tab = "broadcast";
        toast("Live bed call extended by 30 minutes (mock-up)");
      }
      const sc = document.querySelector(".mk-cmpForm");
      const top = sc ? sc.scrollTop : 0;
      render();
      const sc2 = document.querySelector(".mk-cmpForm");
      if (sc2) sc2.scrollTop = top;
      return;
    }
    if (d.act === "closeScrim" && e.target !== t) return;
    if (d.act === "closeSheet" && e.target !== t && !t.matches("button")) return;
    if (d.tab) {
      S.tab = d.tab;
      S.menu = null;
    } else if (d.view) S.view = d.view;
    else if (d.toggle) S.open[d.toggle] = !S.open[d.toggle];
    else if (d.hl) S.hl = d.hl === "clear" || S.hl === d.hl ? null : d.hl;
    else if (d.hist) S.histFilter = d.hist;
    else if (d.ptab) S.pTab = d.ptab;
    else if (d.owner) S.ownerChip = d.owner;
    else if (d.act) {
      const a = d.act;
      if (a === "notify") {
        S.notify = !S.notify;
        toast(S.notify ? "Act-now alerts will notify in this tab" : "Notifications off");
      } else if (a === "copy") toast("Copied 12 alerts for handover (mock-up)");
      else if (a === "next") {
        const order = ["a1", "a4", "a2", "a3", "w1", "t1", "t2", "t3", "t4", "t5", "n1", "n2", "n3"];
        const i = order.indexOf(S.sel);
        S.sel = order[(i + 1) % order.length];
        S.chosen = true;
        S.tab = "now";
        S.pTab = "act";
        if (S.sel[0] === "t") S.open.w2 = true;
        if (S.sel[0] === "n") S.open.w3 = true;
        if (PHONE) S.sheet = true;
      } else if (a === "compose") {
        S.composer = true;
        applyTpl("ask", "adult");
      } else if (a === "closeComposer" || a === "closeScrim") S.composer = false;
      else if (a === "confirm") S.confirm = t.checked;
      else if (a === "send") {
        const c = S.c,
          n = recipients().length;
        const label =
          c.aud === "all"
            ? "Everyone"
            : c.aud === "pick"
              ? "Chosen units"
              : [
                  c.bedNow ? "Wards with a bed now" : "",
                  ...BC_GROUPS.filter((g) => c.groups.includes(g.id)).map((g) => g.label),
                ]
                  .filter(Boolean)
                  .join(", ");
        S.sent = { title: c.title, msg: c.msg, kind: c.kind, sev: c.sev, n, label, dur: c.dur };
        S.composer = false;
        S.tab = "broadcast";
        toast(`Sent to ${n} units (mock-up)`);
      } else if (a === "standdownSent") {
        S.sent = null;
        toast("Broadcast stood down (mock-up)");
      } else if (a === "standdown") {
        S.bcLive = false;
        toast("Broadcast stood down (mock-up)");
      } else if (a === "checks") {
        S.checks = !S.checks;
        e.stopPropagation();
      } else if (a === "menu") S.menu = S.menu === "more" ? null : "more";
      else if (a === "snooze") S.menu = S.menu === "snooze" ? null : "snooze";
      else if (a === "primary") toast("Mock-up only: nothing is changed");
      else if (a === "closeSheet") S.sheet = false;
      else if (a === "today") toast("Opens the Today timeline as a sheet");
      else if (a === "reason") return;
    } else if (d.sel) {
      if (S.sel !== d.sel) {
        S.reason = "";
        S.pTab = "act";
        S.menu = null;
      }
      S.sel = d.sel;
      S.chosen = true;
      if (d.sel === "w2" && S.view === "lanes") {
        S.view = "urgency";
        S.open.w2 = true;
      }
      if (PHONE) S.sheet = true;
    }
    render();
  });
  main.addEventListener("change", (e) => {
    if (e.target.dataset.act === "reason") {
      S.reason = e.target.value;
      render();
    }
    if (e.target.dataset.act === "confirm") {
      S.confirm = e.target.checked;
      render();
    }
  });
  main.addEventListener("input", (e) => {
    const f = e.target.dataset.cIn;
    if (!f) return;
    const was = !!S.c[f].trim();
    S.c[f] = e.target.value;
    const el = document.getElementById(f === "title" ? "mk-pvT" : "mk-pvM");
    if (el) el.textContent = e.target.value;
    if (was !== !!S.c[f].trim()) {
      const pos = e.target.selectionStart,
        sc = document.querySelector(".mk-cmpForm"),
        top = sc ? sc.scrollTop : 0;
      render();
      const inp = document.querySelector(`[data-c-in="${f}"]`);
      if (inp) {
        inp.focus();
        inp.setSelectionRange(pos, pos);
      }
      const s2 = document.querySelector(".mk-cmpForm");
      if (s2) s2.scrollTop = top;
    }
  });
  main.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-sel]')) {
      e.preventDefault();
      e.target.click();
    }
    if (e.key === "Escape") {
      S.composer = false;
      S.sheet = false;
      S.menu = null;
      S.checks = false;
      render();
    }
  });
  window.addEventListener("message", (e) => {
    const m = e.data || {};
    if (m.mk === "theme") {
      const dark = m.value === "dark";
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.setAttribute("data-theme", m.value);
    }
    if (m.mk === "bc") {
      S.bcLive = m.value;
      render();
    }
    if (m.mk === "state") {
      Object.assign(S, m.value);
      render();
    }
  });
  try {
    const q = new URLSearchParams(location.search);
    const th = q.get("theme");
    if (th === "dark" || th === "light") {
      document.documentElement.classList.toggle("dark", th === "dark");
      document.documentElement.setAttribute("data-theme", th);
    }
    if (q.get("bc") === "none") S.bcLive = false;
  } catch (e) {}
  render();
})();
