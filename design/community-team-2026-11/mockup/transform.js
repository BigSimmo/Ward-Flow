// Runs inside the live Midland community team page. Rebuilds the hero and body in place with the
// app's own kit and ward-page classes, so the mock-up wears the real styles. Synthetic data only.
((W) => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---- classes (kit + ward page) ----
  const C = {
    btn: "button_b__ZSINe",
    sec: "button_b__ZSINe button_sec__PlXCk button_sm__AYUhM",
    ghost: "button_b__ZSINe button_ghost__EeF_Z button_sm__AYUhM",
    pri: "button_b__ZSINe button_pri__zqn8o button_sm__AYUhM",
    light: "button_b__ZSINe button_light__U8a_h button_sm__AYUhM",
    label: "button_label__IGDyR",
    sr: "primitives_srOnly__X_kG0",
    count: "primitives_count__LBEJH",
    tile: "primitives_tile__t7w_n",
    card: "card_card__Gp3oB ward-home-tab_v6Card__mhQUX",
    head: "card_head__zF3oH",
    titleWrap: "card_titleWrap__5yUqk",
    title: "card_title__IWONC",
    aside: "card_aside__GJFIz",
    seg: "choice_seg__Yj_w4",
    segItem: "choice_segItem__HtMZy",
    segOn: "choice_segOn___P2Nm",
    segK: "primitives_count__LBEJH choice_k__SSyG0",
    groupHead: "ward-home-tab_groupHead__TRA4d",
    groupTitle: "ward-home-tab_groupTitle__SHyON",
    flowList: "ward-home-tab_flowList__861ZB",
    flowRow: "ward-home-tab_flowRow__dk_Bb",
    flowMain: "ward-home-tab_flowMain__Tu6OA",
    flowTitleLine: "ward-home-tab_flowTitleLine__43Bl7",
    flowTitle: "ward-home-tab_flowTitle__A8Bjv",
    flowDetail: "ward-home-tab_flowDetail__OIY4C",
    flowWhen: "ward-home-tab_flowWhen__bPqoK",
    flowGroup: "ward-home-tab_flowGroup__UngID",
    flowFoot: "ward-home-tab_flowFoot__23EdS",
    keyLink: "ward-home-tab_keyLink__PL8Gl",
    todoGrid: "ward-home-tab_todoGrid__QevTU",
    todoCol: "ward-home-tab_todoCol__PaNMX",
    todoList: "ward-home-tab_todoList__RtCsu",
    todoItem: "ward-home-tab_todoItem__zo3aY",
    todoRow: "ward-home-tab_todoRow__NFK9W",
    todoMain: "ward-home-tab_todoMain__zDyo3",
    todoTitle: "ward-home-tab_todoTitle__qx_xw",
    todoDetail: "ward-home-tab_todoDetail__5cReq",
    todoMeta: "ward-home-tab_todoMeta__fka6s",
    tabWrap: "ward_tabBarWrap__dNWCB",
    tabList: "ward_tabList__FUkB5",
    tabBtn: "ward_tabBtn__zshEF",
    tabLabel: "ward_tabLabel__s0_au",
    tabBadge: "ward_tabBadge__Aj837",
    tabTools: "ward_tabTools__0jjdQ",
    findBox: "form_in__bieHm ward_findBox__mb4ph",
    input: "form_control___LFcp",
    tableScroll: "ward-table_tableScroll__o64_L ward-tokens_wardTokens__kjvRC",
    table: "ward-table_table__mewjL",
    stat: "hero_stat__4_myg hero_inline__01NYH",
    statToggle: "hero_statToggle__2w4Q2",
    valueLine: "hero_valueLine__Z8l5D",
    value: "hero_value__tlqQr",
    statLabel: "hero_label__lDwwB",
    check: "v10-parts_check__anTvL",
    checkLabel: "v10-parts_checkLabel__5xcS2",
    checkValue: "v10-parts_checkValue__stgL5",
  };

  // ---- icons ----
  const ic = (d, s = 16) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    home: ic('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
    users: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    bed: ic('<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>'),
    inbox: ic('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    steth: ic('<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>'),
    phone: ic('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    file: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    send: ic('<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'),
    more: ic('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    chev: ic('<path d="m6 9 6 6 6-6"/>', 14),
    cal: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    list: ic('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    flow: ic('<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>'),
    clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: ic('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    sort: ic('<path d="M3 6h18M6 12h12M10 18h4"/>'),
    check: ic('<path d="M20 6 9 17l-5-5"/>', 14),
    x: ic('<path d="M18 6 6 18M6 6l12 12"/>', 14),
    user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>'),
  };
  const G = {
    danger: W.glyph.danger,
    warning: W.glyph.warning,
    success: W.glyph.success,
    neutral: W.glyph.neutral,
    info: W.glyph.info || W.glyph.neutral,
  };

  // ---- synthetic data ----
  const STAFF = [
    { id: "hartwell", name: "Hartwell, Dr Imogen", ini: "IH", role: "Consultant psychiatrist", note: "Catchment lead", today: "on", where: "Clinic room 2", ext: "4101", med: 61 },
    { id: "ramsay", name: "Ramsay, Dr Kofi", ini: "KR", role: "Psychiatry registrar", today: "field", where: "Home visits, Swan View", ext: "4102", med: 44 },
    { id: "petrov", name: "Petrov, Dr Lena", ini: "LP", role: "Medical officer", note: "Physical health and clozapine", today: "on", where: "Clinic room 1", ext: "4103", med: 37 },
    { id: "vance", name: "Vance, Kara", ini: "KV", role: "Team leader", note: "Intake and allocation", today: "on", where: "Base", ext: "4104" },
    { id: "byrne", name: "Byrne, Tom", ini: "TB", role: "Nurse case manager", today: "duty", where: "Phone and walk-ins until 16:30", ext: "4105", load: 18, cap: 20 },
    { id: "nair", name: "Nair, Priya", ini: "PN", role: "Nurse case manager", today: "field", where: "Home visits, Midvale", ext: "4106", load: 20, cap: 20 },
    { id: "doyle", name: "Doyle, Marcus", ini: "MD", role: "Nurse case manager", today: "clinic", where: "Depot clinic 09:00–12:00", ext: "4107", load: 19, cap: 20 },
    { id: "mallard", name: "Mallard, Jodie", ini: "JM", role: "Social work case manager", today: "on", where: "Base", ext: "4108", load: 17, cap: 18 },
    { id: "walsh", name: "Walsh, Ewan", ini: "EW", role: "OT case manager", today: "leave", where: "Back Wed 4 Nov · Mallard covers", ext: "4109", load: 14, cap: 18 },
    { id: "kuroki", name: "Kuroki, Hana", ini: "HK", role: "Psychologist case manager", today: "on", where: "Clinic room 4", ext: "4110", load: 12, cap: 16 },
    { id: "bennett", name: "Bennett, Leah", ini: "LB", role: "Aboriginal mental health worker", today: "field", where: "With Priya Nair", ext: "4111", co: 9 },
    { id: "okonjo", name: "Okonjo, Sam", ini: "SO", role: "Peer support worker", today: "on", where: "Base", ext: "4112", co: 8 },
  ];
  const S = Object.fromEntries(STAFF.map((s) => [s.id, s]));
  const shortName = (id) => {
    if (!id) return "";
    const [sur, given] = S[id].name.split(", ");
    return `${sur}, ${given.replace("Dr ", "")[0]}.`;
  };
  const TODAY = {
    on: ["success", "On duty"],
    duty: ["success", "Duty officer"],
    field: ["info", "In the field"],
    clinic: ["info", "Depot clinic"],
    leave: ["neutral", "On leave"],
  };

  // where: c = community, h = in hospital
  const CLIENTS = [
    { n: "Ashcombe, Rhys", u: "UM200114", a: "34 · M", cm: "byrne", dr: "hartwell", legal: "CTO", legalD: "Ends 16 Nov", w: "c", seen: 3, next: "CTO review", nextD: "Fri 6 Nov", flags: ["cto", "ctoDue"] },
    { n: "Bellworth, Tamsin", u: "UM200121", a: "27 · F", cm: "nair", dr: "ramsay", legal: "Voluntary", w: "c", seen: 6, next: "Depot", nextD: "Tue 3 Nov" },
    { n: "Brackwater, Meredith", u: "UM100090", a: "F", cm: "kuroki", dr: "ramsay", legal: "Involuntary", w: "h", where: "RGH Adult Secure", seen: 2, next: "Ward visit", nextD: "Wed 4 Nov", flags: ["hosp"] },
    { n: "Calderbrook, Jonah", u: "UM200133", a: "45 · M", cm: "doyle", dr: "petrov", legal: "Voluntary", w: "c", seen: 1, next: "Clozapine bloods", nextD: "Wed 4 Nov" },
    { n: "Castleburn, Thaddeus", u: "UM100091", a: "M", cm: "nair", dr: "hartwell", legal: "Voluntary", w: "h", where: "Mental Health Unit", seen: 4, next: "Discharge meeting", nextD: "Thu 5 Nov", flags: ["hosp"] },
    { n: "Driftwood, Yolanda", u: "UM100092", a: "F", cm: "nair", dr: "ramsay", legal: "Involuntary", w: "h", where: "Graylands Adult Secure", seen: 5, next: "Ward visit", nextD: "Fri 6 Nov", flags: ["hosp"] },
    { n: "Dunmore, Felicity", u: "UM200140", a: "52 · F", cm: "mallard", dr: "hartwell", legal: "Voluntary", w: "c", seen: 31, next: "None booked", nextD: "", flags: ["notSeen"] },
    { n: "Elmsworth, Kai", u: "UM200152", a: "19 · M", cm: null, dr: "ramsay", legal: "Voluntary", w: "c", seen: null, next: "First appointment", nextD: "Not booked", flags: ["unalloc"] },
    { n: "Emberfall, Cassia", u: "UM100093", a: "F", cm: null, dr: "hartwell", legal: "Voluntary", w: "h", where: "SJGM Adult Open", seen: null, next: "Discharge date passed", nextD: "", flags: ["hosp", "unalloc"] },
    { n: "Fairhaven, Odette", u: "UM200167", a: "61 · F", cm: null, dr: "hartwell", legal: "Voluntary", w: "c", seen: 42, next: "Psychiatrist review", nextD: "Thu 12 Nov", psychOnly: true },
    { n: "Foxglenn, Marguerite", u: "UM100094", a: "F", cm: "walsh", dr: "petrov", legal: "Voluntary", w: "h", where: "BTY Older Adult", seen: 6, next: "Ward visit", nextD: "Mon 9 Nov", flags: ["hosp"] },
    { n: "Glenmorrow, Ivo", u: "UM200171", a: "38 · M", cm: "byrne", dr: "hartwell", legal: "CTO", legalD: "Ends 2 Dec", w: "c", seen: 8, next: "Depot", nextD: "Thu 5 Nov", flags: ["cto"] },
    { n: "Greymantle, Ottoline", u: "UM100095", a: "F", cm: "mallard", dr: "hartwell", legal: "Voluntary", w: "h", where: "Moodjar", seen: 3, next: "Follow-up", nextD: "Not booked", flags: ["hosp"] },
    { n: "Hollinsby, Mae", u: "UM200185", a: "23 · F", cm: "kuroki", dr: "ramsay", legal: "Voluntary", w: "c", seen: 2, next: "Therapy", nextD: "Thu 5 Nov" },
    { n: "Inverleith, Saul", u: "UM200192", a: "47 · M", cm: "walsh", dr: "petrov", legal: "Voluntary", w: "c", seen: 12, next: "Review", nextD: "Mon 9 Nov" },
    { n: "Ironbrook, Barnaby", u: "UM100096", a: "M", cm: "doyle", dr: "petrov", legal: "Involuntary", w: "h", where: "Moodjar", seen: 9, next: "Ward visit", nextD: "Tue 3 Nov", flags: ["hosp"] },
    { n: "Jessop, Rowan", u: "UM200204", a: "30 · M", cm: "doyle", dr: "ramsay", legal: "CTO", legalD: "Ends 9 Nov", w: "c", seen: 4, next: "CTO review", nextD: "Wed 4 Nov", flags: ["cto", "ctoDue"] },
    { n: "Kettlewell, Baxter", u: "UM100097", a: "M", cm: "doyle", dr: "hartwell", legal: "Involuntary", w: "h", where: "FSH Adult Secure", seen: 11, next: "Ward visit", nextD: "Thu 5 Nov", flags: ["hosp"] },
    { n: "Kilbride, Noor", u: "UM200219", a: "41 · F", cm: "nair", dr: "hartwell", legal: "Voluntary", w: "c", seen: 29, next: "Home visit", nextD: "Tue 3 Nov", flags: ["notSeen"] },
    { n: "Larkspur, Edie", u: "UM200226", a: "72 · F", cm: null, dr: "petrov", legal: "Voluntary", w: "c", seen: 63, next: "Psychiatrist review", nextD: "Mon 16 Nov", psychOnly: true },
    { n: "Marrowby, Ines", u: "UM100003", a: "F", cm: "byrne", dr: "hartwell", legal: "Voluntary", w: "h", where: "Dabakarn", seen: 2, next: "Follow-up booked", nextD: "Thu 5 Nov", flags: ["hosp"] },
    { n: "Mortlake, Ari", u: "UM200238", a: "26 · M", cm: null, dr: "hartwell", legal: "Voluntary", w: "c", seen: null, next: "First appointment", nextD: "Not booked", flags: ["unalloc"] },
    { n: "Nettlefold, Grace", u: "UM200241", a: "35 · F", cm: "mallard", dr: "ramsay", legal: "Voluntary", w: "c", seen: 5, next: "Review", nextD: "Fri 6 Nov" },
    { n: "Oakridge, Tobias", u: "UM200257", a: "58 · M", cm: "byrne", dr: "petrov", legal: "CTO", legalD: "Ends 20 Nov", w: "c", seen: 10, next: "CTO review", nextD: "Tue 10 Nov", flags: ["cto", "ctoDue"] },
  ];

  const INPATIENTS = CLIENTS.filter((c) => c.w === "h");
  const IN_BED = {
    "Marrowby, Ines": { bed: 6, out: "Thu 5 Nov", outIn: "in 3 days", contact: "Visited 2d ago", fu: "Thu 5 Nov 10:00, home" },
    "Castleburn, Thaddeus": { bed: 6, out: "Fri 6 Nov", outIn: "in 4 days", contact: "Visited 4d ago", fu: "" },
    "Kettlewell, Baxter": { bed: 122, out: "Not set", contact: "Phoned 11d ago", fu: "" },
    "Greymantle, Ottoline": { bed: 12, out: "Wed 4 Nov", outIn: "in 2 days", contact: "Visited 3d ago", fu: "" },
    "Ironbrook, Barnaby": { bed: 48, out: "Passed 30 Oct", passed: true, contact: "Visited 9d ago", fu: "" },
    "Emberfall, Cassia": { bed: 20, out: "Passed 28 Oct", passed: true, contact: "No team contact", none: true, fu: "" },
    "Brackwater, Meredith": { bed: 6, out: "Not set", contact: "Visited 2d ago", fu: "" },
    "Foxglenn, Marguerite": { bed: 6, out: "Mon 9 Nov", outIn: "in 7 days", contact: "Phoned 6d ago", fu: "" },
    "Driftwood, Yolanda": { bed: 6, out: "Not set", contact: "Phoned 5d ago", fu: "" },
  };
  const DISCHARGED = [
    { n: "Thornbury, Cleo", u: "UM200288", from: "RGH Adult Secure", left: "Mon 26 Oct", cm: "byrne", state: "due", label: "Due today", detail: "Day 7 · not seen yet" },
    { n: "Ulverston, Pip", u: "UM200295", from: "Graylands Adult Open", left: "Fri 30 Oct", cm: "mallard", state: "none", label: "Not booked", detail: "Due by Fri 6 Nov" },
    { n: "Yarrowdale, Ben", u: "UM200270", from: "SJGM Adult Open", left: "Thu 29 Oct", cm: "nair", state: "booked", label: "Booked Tue 3 Nov", detail: "Home visit 10:00" },
    { n: "Wexcombe, Lila", u: "UM200263", from: "Moodjar", left: "Wed 28 Oct", cm: "kuroki", state: "seen", label: "Seen day 2", detail: "Fri 30 Oct, clinic" },
  ];
  const REFERRALS = [
    {
      id: "r1", n: "Sallowfield, June", u: "UM200322", a: "58 · F", since: "3d 1h", over: "1h overdue", pct: 100,
      from: "GP", fromD: "Midvale Family Practice", via: "e-referral from GP", received: "Fri 30 Oct 09:41", dueAt: "Mon 2 Nov 09:41",
      ask: "Psychiatrist review", urgency: "Routine", legal: "Voluntary", needs: "Transport", interp: "Not needed", lives: "Mundaring", catch: "In catchment",
      known: "Midland 2019–2020, closed well",
      why: "Low mood for 2 months. GP asks for a medication review.",
      isbar: [
        ["Situation", "Low mood for 2 months, with poor sleep and appetite. Has stopped going to her walking group."],
        ["Background", "Depression treated by this team 2019–2020, discharged well to GP. On sertraline 100 mg for 18 months. Lives alone since her husband died in March."],
        ["Assessment", "PHQ-9 score 19. No plans to harm herself; says she would not act on passing thoughts. Daughter visits twice a week. Bloods normal on Fri 30 Oct."],
        ["Recommendation", "Psychiatrist review of medication within 2 weeks. GP happy to share care."],
      ],
      docs: [["GP referral letter", "2 pages · Fri 30 Oct · Dr M. Castell"], ["Medication list", "1 page · Fri 30 Oct"], ["Blood results", "1 page · Fri 30 Oct"], ["PHQ-9 score sheet", "1 page · Thu 29 Oct"], ["Midland discharge summary", "3 pages · Mar 2020 · this team"]],
      contacts: [["Referrer", "Castell, Dr Mira", "GP · Midvale Family Practice", "08 5550 0144"], ["Carer", "Sallowfield, Ellen", "Daughter · visits twice a week", "0400 000 512"]],
      checks: [["pass", "Lives in the Midland catchment", "Mundaring is in the S2015 catchment"], ["pass", "Adult age band", "58, adult team covers 18–64"], ["pass", "Not open to another team", "No open episode found"], ["pass", "Referral letter attached", "GP letter and medication list"], ["pass", "Consent to the referral", "Recorded by GP on Fri 30 Oct"], ["info", "Triage", "Routine, by Vance, K. on Fri 30 Oct"]],
      timeline: [["Mon 2 Nov 09:41", "Answer time passed", ""], ["Fri 30 Oct 15:02", "Blood results added", "Vance, K."], ["Fri 30 Oct 14:20", "Phoned GP for bloods", "Vance, K."], ["Fri 30 Oct 11:05", "Triaged routine", "Vance, K."], ["Fri 30 Oct 09:41", "Referral received", "e-referral, Dr M. Castell"]],
      firstContact: "Within 14 days",
    },
    {
      id: "r2", n: "Quillon, Hattie", u: "UM200301", a: "33 · F", since: "1d 2h", due: "Due in 1d 22h", pct: 36,
      from: "ED", fromD: "RPH emergency", via: "ED referral", received: "Sun 1 Nov 08:40", dueAt: "Wed 4 Nov 08:40",
      ask: "Case management", urgency: "Urgent, 72 hours", legal: "Voluntary", needs: "Interpreter, Dari", interp: "Dari, for every contact", lives: "Midvale", catch: "In catchment",
      known: "New to mental health services",
      why: "First contact with services. Medically cleared in ED; home with a safety plan.",
      isbar: [
        ["Situation", "Seen in RPH ED overnight after taking extra paracetamol during a family argument. Medically cleared."],
        ["Background", "No earlier mental health contact. Arrived in Australia in 2022. Two children under 5. Low mood since her second baby."],
        ["Assessment", "Regrets the overdose and has no current plan. Agreed a safety plan with her husband, who is supportive."],
        ["Recommendation", "Contact within 72 hours and case management. Book a Dari interpreter for every contact."],
      ],
      docs: [["ED discharge summary", "2 pages · Sun 1 Nov · RPH ED"], ["ED risk assessment", "1 page · Sun 1 Nov"], ["Safety plan", "1 page · Sun 1 Nov"], ["Medical clearance and bloods", "1 page · Sun 1 Nov"]],
      contacts: [["Referrer", "Ito, Dr Sam", "ED registrar · RPH", "08 5550 0230"], ["Carer", "Quillon, Arash", "Husband · Dari speaker", "0400 000 318"]],
      checks: [["pass", "Lives in the Midland catchment", "Midvale is in the S2015 catchment"], ["pass", "Adult age band", "33"], ["pass", "Not open to another team", "No open episode found"], ["pass", "Discharge summary attached", "ED summary and safety plan"], ["info", "Interpreter", "Not booked yet"], ["info", "Triage", "Urgent, by Vance, K. today 09:10"]],
      timeline: [["Mon 2 Nov 09:10", "Triaged urgent", "Vance, K."], ["Sun 1 Nov 08:55", "Receipt sent to ED", "Automatic"], ["Sun 1 Nov 08:40", "Referral received", "Dr S. Ito, RPH ED"]],
      firstContact: "Within 72 hours",
    },
    {
      id: "r3", n: "Rendlesham, Otto", u: "UM200315", a: "49 · M", since: "4h", due: "Due in 2d 20h", pct: 6,
      from: "Ward", fromD: "Moodjar", via: "Ward referral", received: "Mon 2 Nov 06:42", dueAt: "Thu 5 Nov 06:42",
      ask: "Follow-up after discharge", urgency: "Before discharge, Thu 5 Nov", legal: "Voluntary", needs: "—", interp: "Not needed", lives: "Swan View", catch: "In catchment",
      known: "Midland 2015–2023, closed well",
      why: "Expected home Thu 5 Nov. Ward asks for a case manager and 7-day follow-up.",
      isbar: [
        ["Situation", "Admitted 3 weeks ago with a relapse of schizophrenia after stopping medication. Expected home Thu 5 Nov."],
        ["Background", "Known to this team 2015–2023, closed when well. Lives with his brother in Swan View."],
        ["Assessment", "Settled on paliperidone depot, next due Thu 19 Nov. Insight improving. Voluntary since Fri."],
        ["Recommendation", "Case manager to meet him before discharge, 7-day follow-up, and a depot clinic booking."],
      ],
      docs: [["Discharge plan, draft", "2 pages · Mon 2 Nov · Moodjar"], ["Medication chart", "1 page · Mon 2 Nov"], ["Depot schedule", "1 page · next due Thu 19 Nov"], ["Midland closure summary", "2 pages · Jun 2023 · this team"]],
      contacts: [["Referrer", "Lindqvist, Dr Pia", "Consultant · Moodjar", "08 5550 0371"], ["Carer", "Rendlesham, Hugo", "Brother · lives with him", "0400 000 774"]],
      checks: [["pass", "Lives in the Midland catchment", "Swan View is in the S2015 catchment"], ["pass", "Adult age band", "49"], ["pass", "Not open to another team", "No open episode found"], ["pass", "Discharge plan attached", "Draft, final to follow"], ["info", "Discharge meeting", "Wed 4 Nov 11:00 at Moodjar"]],
      timeline: [["Mon 2 Nov 07:15", "Invited to discharge meeting", "Wed 4 Nov 11:00"], ["Mon 2 Nov 06:42", "Referral received", "Dr P. Lindqvist, Moodjar"]],
      firstContact: "Before discharge",
    },
  ];
  const SENT = [
    { n: "Dunmore, Felicity", u: "UM200140", to: "Bed request · East Metro", state: "Waiting", when: "2h ago" },
    { n: "Larkspur, Edie", u: "UM200226", to: "Older adult team, Bentley", state: "Accepted", when: "Yesterday" },
  ];
  const ANSWERED = [
    { n: "Pembury, Ada", u: "UM200196", ask: "Case management", ans: "Accepted", by: "Vance, K.", when: "Fri 30 Oct", to: "Kuroki, H." },
    { n: "Tolland, Reece", u: "UM200203", ask: "Psychiatrist review", ans: "Declined", by: "Vance, K.", when: "Thu 29 Oct", to: "Out of catchment, sent to Armadale" },
    { n: "Mortlake, Ari", u: "UM200238", ask: "Case management", ans: "Accepted", by: "Vance, K.", when: "Sat 31 Oct", to: "Not allocated yet" },
    { n: "Elmsworth, Kai", u: "UM200152", ask: "Case management", ans: "Accepted", by: "Vance, K.", when: "Thu 29 Oct", to: "Not allocated yet" },
  ];

  // ---- helpers ----
  const person = (n, u, sub) =>
    `<div class="mk-person"><span class="mk-name">${esc(n)}</span><span class="mk-sub"><span class="mk-mono">${esc(u)}</span>${sub ? ` · ${esc(sub)}` : ""}</span></div>`;
  const tag = (tone, text, glyph = true) => `<span class="mk-tag" data-tone="${tone}">${glyph && G[tone] ? G[tone] : ""}${esc(text)}</span>`;
  const btn = (cls, text, extra = "", icon = "") => `<button type="button" class="${cls} ${extra}">${icon}<span class="${C.label}">${esc(text)}</span></button>`;
  const segBtns = (items, group) =>
    `<div class="${C.seg}" role="tablist" data-seg="${group}">${items
      .map(
        ([key, label, n], i) =>
          `<button type="button" role="tab" aria-selected="${i === 0}" class="${C.segItem}${i === 0 ? " " + C.segOn : ""}" data-key="${key}">${esc(label)}${
            n != null ? `<span class="${C.segK}"><span>${n}</span></span>` : ""
          }</button>`,
      )
      .join("")}</div>`;
  const cardHead = (icon, title, aside = "") =>
    `<div class="${C.head}"><span class="${C.tile}">${icon}</span><div class="${C.titleWrap}"><h2 class="${C.title}">${title}</h2></div><div class="${C.aside}">${aside}</div></div>`;
  const cmCell = (c) =>
    c.cm
      ? `<span class="mk-cm"><span class="mk-av">${S[c.cm].ini}</span>${esc(shortName(c.cm))}</span>`
      : c.psychOnly
        ? `<span class="mk-muted">Psychiatrist only</span>`
        : tag("warning", "Not allocated");
  const seenCell = (d) =>
    d == null ? `<span class="mk-muted">Not yet</span>` : d >= 28 ? `<span class="mk-strong">${G.warning}${d >= 35 ? Math.round(d / 7) + " weeks" : d + "d"}</span>` : d >= 35 ? `${Math.round(d / 7)} weeks` : `${d}d`;
  const seenTxt = (c) => (c.seen == null ? `<span class="mk-muted">Not yet</span>` : c.seen >= 28 && !c.psychOnly ? `<span class="mk-strong">${G.warning}${c.seen}d</span>` : c.seen >= 35 ? `${Math.round(c.seen / 7)} weeks` : `${c.seen}d`);

  // ---- 1. HERO ----
  const hero = $("section.hero_hero__6AGeu");
  const eyebrow = $(".hero_eyebrow__egAeQ", hero);
  eyebrow.textContent = "Midland · Community mental health · East Metro · Adult";
  const titleLine = $(".hero_titleLine__xNxIs", hero);
  titleLine.innerHTML = `<h1 class="hero_title__R82xM">142 on the caseload<span class="sr-only">, Midland community team</span></h1>
    <span class="hero_titleMeta__egQH_"><span class="mk-heroSub">9 in hospital · 5 waiting for a case manager</span><button type="button" class="${W.switchCls}"><span>Switch team</span>${I.chev}</button></span>`;
  $(".hero_aside__lA8t7", hero).innerHTML = `${W.live}${btn(C.light, "Refer from team", "mk-ctl", I.plus)}`;
  const bar = $(".hero_barRow__9wqdf", hero);
  const stat = (v, l, tab, glyph = "") =>
    `<div class="${C.stat}"><button type="button" class="${C.statToggle}" data-go="${tab}"><span class="${C.valueLine}"><span class="${C.value}">${v}</span></span><span class="${C.statLabel}">${glyph}<span>${l}</span></span></button></div>`;
  bar.innerHTML = `<div class="hero_bar__iW8aX"><div class="mk-pills">
      ${stat(3, "Act now", "home", G.danger)}
      ${stat(3, "Referrals to answer", "referrals", G.neutral)}
      ${stat(4, "Leaving hospital in 7 days", "hospital")}
      ${stat(3, "CTO reviews due", "caseload")}
    </div></div>
    <div class="hero_aside__lA8t7"><button type="button" class="mk-heroLink" data-go="clinicians"><b>11 of 12</b> working today · Clinicians</button></div>`;
  const foot = $(".hero_footMain__WoHk_", hero);
  const chev = ic('<path d="m9 6 6 6-6 6"/>', 14);
  foot.innerHTML = `<div class="mk-glance">
      <button type="button" class="mk-gl" data-go="clinicians">${I.phone}<span>Duty officer</span><b>Byrne, T.</b><span class="mk-glMono">ext 4105</span>${chev}</button>
      <button type="button" class="mk-gl" data-go="referrals">${I.clock}<span>Oldest referral</span><b class="mk-glMono">3d 1h</b><b>Sallowfield, June</b><span>from GP</span>${chev}</button>
      <button type="button" class="mk-gl" data-go="hospital">${I.home}<span>Next home</span><b class="mk-glMono">Wed 4 Nov</b><b>Greymantle, Ottoline</b><span>Moodjar</span>${chev}</button>
    </div>`;
  const fa = $(".hero_footAside__5YTMQ", hero);
  if (fa) fa.innerHTML = `<span>Open 08:30–16:30 weekdays</span>`;

  // ---- 2. BODY ----
  const main = $("main");
  const standing = $(".community-team-v6_standing__KXSPE");
  [...main.children].forEach((el) => {
    if (el !== standing && !el.matches("h1, .sr-only")) el.remove();
  });
  [...standing.children].forEach((el) => {
    if (el !== hero) el.remove();
  });

  const TABS = [
    ["home", "Team home", null],
    ["caseload", "Caseload", "142"],
    ["hospital", "In hospital", "9"],
    ["referrals", "Referrals", "3"],
    ["clinicians", "Clinicians", "12"],
  ];
  const tabBar = `<nav class="${C.tabWrap} mk-tabBar" aria-label="Team sections">
    <ul class="${C.tabList}" role="tablist">${TABS.map(
      ([k, l, b], i) =>
        `<li><button type="button" role="tab" class="${C.tabBtn}" aria-selected="${i === 0}" data-tab="${k}"><span class="${C.tabLabel}">${l}</span>${
          b ? `<span class="${C.tabBadge}">${b}</span>` : ""
        }</button></li>`,
    ).join("")}</ul>
    <div class="${C.tabTools}">
      <div class="${C.findBox} mk-find">${I.search}<input class="${C.input}" placeholder="Find client or clinician" aria-label="Find client or clinician"><kbd>/</kbd></div>
      ${btn(C.ghost, "Record contact", "mk-ctl", I.phone)}
      <span class="mk-moreWrap">${btn(C.ghost, "More", "mk-ctl mk-moreBtn", I.more)}
        <div class="mk-menu" hidden role="menu"><button type="button" role="menuitem">CTO register</button><button type="button" role="menuitem">Catchment counts</button><button type="button" role="menuitem">How to reach the team</button><button type="button" role="menuitem">Demo samples</button><button type="button" role="menuitem">About this data</button></div></span>
    </div>
  </nav>`;

  // ---- Team home ----
  const todoItem = (glyph, title, detail, action, meta = "", go = "") =>
    `<li class="${C.todoItem}"><div class="${C.todoRow}">${G[glyph]}<span class="${C.todoMain}"><span class="${C.todoTitle}">${title}</span><span class="${C.todoDetail}">${detail}</span></span>${
      meta ? `<span class="${C.todoMeta}">${meta}</span>` : ""
    }${btn(C.sec, action, "mk-ctl", "")}</div></li>`.replace("<button", `<button data-go="${go}"`);
  function listGroup(glyph, title, n, hint, rows) {
    return `<section class="mk-lg"><div class="mk-lgHead">${G[glyph]}<h3>${title}</h3><span class="${C.count}"><span>${n}</span></span><span class="mk-lgHint">${hint}</span></div><ul class="mk-lgList">${rows.join("")}</ul></section>`;
  }
  function listRow(glyph, title, name, umrn, detail, t1, t2, action, go, primary) {
    return `<li class="mk-lr${glyph === "danger" ? " mk-urgent" : ""}">${G[glyph]}<span class="mk-lrMain"><span class="mk-lrTitle">${title}</span><span class="mk-lrDetail"><b>${esc(name)}</b> <span class="mk-mono">${umrn}</span> · ${esc(detail)}</span></span><span class="mk-lrWhen"><b class="mk-mono">${t1}</b><span>${t2}</span></span><button type="button" class="${primary ? C.pri : C.sec} mk-ctl" data-go="${go}">${action}<span class="${C.sr}"> ${esc(name)}</span></button></li>`;
  }
  const tile = (go, n, label, right, barParts, lines) => `
    <button type="button" class="mk-tile" data-go="${go}">
      <span class="mk-tileTop"><b class="mk-tileN">${n}</b><span class="mk-tileL">${label}</span><span class="mk-tileR">${right}</span></span>
      <span class="mk-bar" aria-hidden="true">${barParts.map(([w, c]) => `<i style="flex:${w};background:var(${c})"></i>`).join("")}</span>
      <span class="mk-tileLines">${lines.map(([g, txt]) => `<span>${g ? G[g] : ""}${txt}</span>`).join("")}</span>
    </button>`;
  const summary = `
  <section class="${C.card} mk-summary">
    <div class="mk-tiles">
      ${tile("caseload", 142, "Caseload", "6 case managers", [[100, "--wf-data-1"], [37, "--wf-data-2"], [5, "--wf-warning"]], [["", "<b>100</b> managed"], ["", "<b>37</b> psychiatrist only"], ["warning", "<b>5</b> unallocated"]])}
      ${tile("hospital", 9, "In hospital", "longest 122d", [[4, "--wf-data-1"], [3, "--wf-data-2"], [2, "--wf-warning"]], [["", "<b>4</b> home in 7 days"], ["warning", "<b>2</b> dates passed"]])}
      ${tile("referrals", 3, "Referrals", "oldest 3d 1h", [[2, "--wf-data-1"], [1, "--wf-warning"]], [["warning", "<b>1</b> past its time"], ["", "<b>2</b> due this week"]])}
      ${tile("hospital", 4, "Follow-up", "within 7 days", [[1, "--wf-success"], [1, "--wf-data-1"], [1, "--wf-warning"], [1, "--wf-danger"]], [["danger", "<b>1</b> due today"], ["warning", "<b>1</b> not booked"]])}
    </div>
    <div class="mk-key"><span><i style="background:var(--wf-data-1)"></i>On track</span><span><i style="background:var(--wf-data-2)"></i>Other</span><span><i style="background:var(--wf-warning)"></i>Needs a look</span><span class="mk-keyNote">Choose a figure to open its list.</span></div>
  </section>`;
  const home = `
  ${summary}
  <div class="mk-grid">
    <div class="mk-col">
      <section class="${C.card}">
        ${cardHead(I.list, "Team list", segBtns([["todo", "To do", 7], ["log", "Today's log", 6]], "list"))}
        <div class="mk-pane" data-pane-of="list" data-key="todo">
          ${listGroup("danger", "Act now", 3, "needs someone today", [
            listRow("danger", "7-day follow-up due today", "Thornbury, Cleo", "UM200288", "left RGH Adult Secure · Byrne, T.", "Day 7", "of 7", "Record contact", "hospital", true),
            listRow("warning", "Referral past its answer time", "Sallowfield, June", "UM200322", "from GP · psychiatrist review", "3d 1h", "1h overdue", "Answer", "referrals"),
            listRow("warning", "Leaving hospital, no follow-up booked", "Greymantle, Ottoline", "UM100095", "Moodjar · Mallard, J.", "Wed 4 Nov", "in 2 days", "Book", "hospital"),
          ])}
          ${listGroup("neutral", "This week", 4, "oldest first", [
            listRow("neutral", "Waiting for a case manager", "Elmsworth, Kai", "UM200152", "+4 more · accepted Thu 29 Oct", "4d", "oldest", "Allocate", "caseload"),
            listRow("neutral", "CTO review due", "Jessop, Rowan", "UM200204", "+2 more · Doyle, M. · ends 9 Nov", "Wed 4 Nov", "in 2 days", "Open", "caseload"),
            listRow("neutral", "Not seen in 4 weeks", "Dunmore, Felicity", "UM200140", "+1 more · Mallard, J.", "31d", "since seen", "Open", "caseload"),
            listRow("neutral", "Admitted with no case manager", "Emberfall, Cassia", "UM100093", "SJGM Adult Open · discharge date passed", "20d", "in bed", "Allocate", "hospital"),
          ])}
        </div>
        <div class="mk-pane" data-pane-of="list" data-key="log" hidden>
          <ul class="mk-log">
            ${[
              ["10:31", "Contact recorded", "Calderbrook, Jonah · clozapine bloods taken · Doyle, M."],
              ["10:05", "Referral received", "Rendlesham, Otto · from Moodjar ward"],
              ["09:40", "Follow-up booked", "Yarrowdale, Ben · Tue 3 Nov 10:00 · Nair, P."],
              ["09:12", "Admitted", "Brackwater, Meredith · RGH Adult Secure"],
              ["08:55", "Referral accepted", "Pembury, Ada · case manager Kuroki, H."],
              ["08:40", "Depot fridge checked", "Doyle, M."],
            ]
              .map(([w, a, d]) => `<li><span class="mk-mono mk-logT">${w}</span><span class="mk-person"><span class="mk-logA">${a}</span><span class="mk-sub">${esc(d)}</span></span></li>`)
              .join("")}
          </ul>
        </div>
      </section>
      <section class="${C.card}">
        ${cardHead(I.users, "Caseload by case manager", `<button type="button" class="${C.keyLink}" data-go="caseload">Open caseload</button>`)}
        <div class="mk-loadList">
          ${STAFF.filter((s) => s.load)
            .map(
              (s) => `<button type="button" class="mk-loadRow" data-go="caseload" data-cm="${s.id}">
                <span class="mk-cm"><span class="mk-av">${s.ini}</span><span class="mk-loadName">${esc(s.name)}</span></span>
                <span class="mk-loadRole">${esc(s.role.replace(" case manager", ""))}${s.today === "leave" ? " · on leave" : ""}</span>
                <span class="mk-track" aria-hidden="true"><span style="width:${(s.load / 20) * 100}%"></span><i style="left:${(s.cap / 20) * 100}%"></i></span>
                <span class="mk-loadN"><b>${s.load}</b> of ${s.cap}</span></button>`,
            )
            .join("")}
          <div class="mk-loadFoot"><span><b>37</b> psychiatrist only</span><span><b>5</b> waiting for a case manager</span><span class="mk-keyMark"><i></i> agreed limit</span></div>
        </div>
      </section>
    </div>
    <div class="mk-col">
      <section class="card_card__Gp3oB ward-home-tab_flowCard__Ogrn1 ward-home-tab_v6Card__mhQUX">
        ${cardHead(I.flow, "Team flow", `<span class="ward-home-tab_v6Meta__GssYU">10:42</span>`)}
        <div class="ward-home-tab_flowSwitch__H0_9D">${segBtns(
          [
            ["ref", "Referrals", 3],
            ["adm", "Admitted", 5],
            ["dis", "Leaving", 4],
          ],
          "flow",
        )}</div>
        <div class="ward-home-tab_flowBody__0wL4x">
          <div class="mk-pane" data-pane-of="flow" data-key="ref">
            ${flowGroup(
              "Awaiting your answer",
              REFERRALS.map((r) => flowRow(r.n, `${r.from} · ${r.ask}`, r.over || r.since, r.over ? "warning" : "neutral", "Open", "referrals")),
            )}
            ${flowGroup("Sent by the team", [flowRow(SENT[0].n, SENT[0].to, SENT[0].when, "neutral", "Open", "referrals")])}
          </div>
          <div class="mk-pane" data-pane-of="flow" data-key="adm" hidden>
            ${flowGroup(
              "Admitted in the last 7 days",
              ["Marrowby, Ines", "Castleburn, Thaddeus", "Brackwater, Meredith", "Foxglenn, Marguerite", "Driftwood, Yolanda"].map((n) => {
                const c = CLIENTS.find((x) => x.n === n);
                return flowRow(n, `${c.where} · ${c.cm ? shortName(c.cm) : "no case manager"}`, "6 days ago", "neutral", "Open", "hospital");
              }),
            )}
          </div>
          <div class="mk-pane" data-pane-of="flow" data-key="dis" hidden>
            ${flowGroup("Leaving in the next 7 days", [
              flowRow("Greymantle, Ottoline", "Moodjar · follow-up not booked", "Wed 4 Nov", "warning", "Book", "hospital"),
              flowRow("Marrowby, Ines", "Dabakarn · follow-up Thu 5 Nov", "Thu 5 Nov", "success", "Open", "hospital"),
              flowRow("Castleburn, Thaddeus", "Mental Health Unit · follow-up not booked", "Fri 6 Nov", "neutral", "Book", "hospital"),
              flowRow("Foxglenn, Marguerite", "BTY Older Adult · follow-up not booked", "Mon 9 Nov", "neutral", "Book", "hospital"),
            ])}
          </div>
        </div>
        <div class="${C.flowFoot}"><span>2 discharge dates passed</span><button type="button" class="${C.keyLink}" data-go="hospital">All in hospital</button></div>
      </section>
      <section class="${C.card}">
        ${cardHead(I.phone, "How to reach", `<span class="mk-meta">Invented for the demo</span>`)}
        <dl class="mk-dl">
          <div><dt>Intake</dt><dd><span class="mk-mono">08 5550 0107</span></dd></div>
          <div><dt>Duty officer</dt><dd>Byrne, T. · <span class="mk-mono">ext 4105</span></dd></div>
          <div><dt>After hours</dt><dd>Mental Health Emergency Response Line</dd></div>
          <div><dt>Referrals</dt><dd>midland@example.health</dd></div>
          <div><dt>Address</dt><dd>281 Great Eastern Highway, Midland</dd></div>
        </dl>
      </section>
    </div>
  </div>`;
  function flowRow(title, detail, when, glyph, action, go) {
    return `<li class="${C.flowRow}">${G[glyph]}<span class="${C.flowMain}"><span class="${C.flowTitleLine}"><span class="${C.flowTitle}">${esc(title)}</span><span class="${C.flowWhen}">${esc(
      when,
    )}</span></span><span class="${C.flowDetail}">${esc(detail)}</span></span><button type="button" class="${C.sec} mk-ctl" data-go="${go}">${esc(action)}<span class="${C.sr}"> ${esc(title)}</span></button></li>`;
  }
  function flowGroup(title, rows) {
    return `<section class="${C.flowGroup}"><div class="${C.groupHead}"><h3 class="${C.groupTitle}">${title}</h3><span class="${C.count}"><span>${rows.length}</span></span></div><ul class="${C.flowList}">${rows.join("")}</ul></section>`;
  }

  // ---- Caseload ----
  const cmOptions = STAFF.filter((s) => s.load).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  const caseRows = CLIENTS.map((c) => {
    const flags = (c.flags || []).join(" ");
    const legal =
      c.legal === "CTO"
        ? `<span class="mk-strong">CTO</span><span class="mk-sub">${esc(c.legalD)}</span>`
        : `<span>${esc(c.legal)}</span>`;
    const where = c.w === "h" ? `<span class="mk-where">${I.bed}<span>${esc(c.where)}</span></span>` : `<span class="mk-muted">Community</span>`;
    return `<tr data-flags="${flags}" data-cm="${c.cm || ""}" data-psych="${c.psychOnly ? 1 : 0}">
      <td>${person(c.n, c.u, c.a)}</td>
      <td>${cmCell(c)}</td>
      <td>${esc(shortName(c.dr))}</td>
      <td>${legal}</td>
      <td>${where}</td>
      <td class="mk-n">${seenTxt(c)}</td>
      <td><span class="mk-nextT">${esc(c.next)}</span>${c.nextD ? `<span class="mk-sub">${esc(c.nextD)}</span>` : ""}</td>
      <td class="mk-actCell"><button type="button" class="${C.sec} mk-ctl">Open<span class="${C.sr}"> ${esc(c.n)}</span></button></td>
    </tr>`;
  }).join("");
  const caseload = `
  <section class="${C.card} mk-wide">
    ${cardHead(I.users, "Caseload", `<span class="mk-meta">142 clients · 9 in hospital</span>`)}
    <div class="mk-filters">
      ${segBtns(
        [
          ["all", "All", 142],
          ["hosp", "In hospital", 9],
          ["cto", "On a CTO", 22],
          ["ctoDue", "CTO review due", 3],
          ["notSeen", "Not seen in 4 weeks", 2],
          ["unalloc", "No case manager", 5],
        ],
        "case",
      )}
      <label class="mk-select"><span class="sr-only">Case manager</span><select class="mk-cmSel mk-ctl"><option value="">Any case manager</option>${cmOptions}<option value="psych">Psychiatrist only</option></select>${I.chev}</label>
    </div>
    <div class="${C.tableScroll} mk-tableWrap">
      <table class="${C.table} mk-table">
        <thead><tr><th>Client</th><th>Case manager</th><th>Psychiatrist</th><th>Legal</th><th>Where now</th><th class="mk-n">Last seen</th><th>Next</th><th><span class="sr-only">Action</span></th></tr></thead>
        <tbody>${caseRows}</tbody>
      </table>
    </div>
    <div class="mk-tableFoot"><span class="mk-shown">Showing 24 of 142</span><button type="button" class="${C.ghost} mk-ctl">Show all 142</button></div>
  </section>`;

  // ---- In hospital ----
  const hospRows = INPATIENTS.map((c) => {
    const b = IN_BED[c.n];
    const out = b.passed ? `<span class="mk-strong">${G.warning}${esc(b.out)}</span>` : b.out === "Not set" ? `<span class="mk-muted">Not set</span>` : `<span>${esc(b.out)}</span><span class="mk-sub">${esc(b.outIn)}</span>`;
    const fu = b.fu
      ? tag("success", "Booked") + `<span class="mk-sub">${esc(b.fu)}</span>`
      : b.out === "Not set"
        ? `<span class="mk-muted">Not needed yet</span>`
        : `<button type="button" class="${C.sec} mk-ctl">Book<span class="${C.sr}"> follow-up for ${esc(c.n)}</span></button>`;
    return `<tr><td>${person(c.n, c.u, c.a)}</td><td>${esc(c.where)}</td><td>${cmCell(c)}</td><td>${esc(c.legal)}</td><td class="mk-n">${b.bed}d</td><td>${out}</td>
      <td>${b.none ? `<span class="mk-strong">${G.warning}No team contact</span>` : esc(b.contact)}</td><td>${fu}</td></tr>`;
  }).join("");
  const disRows = DISCHARGED.map((d) => {
    const t = d.state === "seen" ? tag("success", d.label) : d.state === "booked" ? tag("neutral", d.label) : d.state === "due" ? tag("danger", d.label) : tag("warning", d.label);
    const act =
      d.state === "seen"
        ? `<span class="mk-muted">Done</span>`
        : d.state === "booked"
          ? `<button type="button" class="${C.sec} mk-ctl">Open<span class="${C.sr}"> ${esc(d.n)}</span></button>`
          : d.state === "due"
            ? `<button type="button" class="${C.pri} mk-ctl">Record contact<span class="${C.sr}"> ${esc(d.n)}</span></button>`
            : `<button type="button" class="${C.sec} mk-ctl">Book<span class="${C.sr}"> ${esc(d.n)}</span></button>`;
    return `<tr${d.state === "due" ? ' class="mk-urgent"' : ""}><td>${person(d.n, d.u)}</td><td>${esc(d.from)}</td><td>${esc(d.left)}</td><td><span class="mk-cm"><span class="mk-av">${S[d.cm].ini}</span>${esc(
      shortName(d.cm),
    )}</span></td><td>${t}<span class="mk-sub">${esc(d.detail)}</span></td><td class="mk-actCell">${act}</td></tr>`;
  }).join("");
  const hospital = `
  <section class="${C.card} mk-wide">
    ${cardHead(I.bed, "In hospital now", `<span class="mk-meta">9 clients · 2 discharge dates passed</span>`)}
    <div class="${C.tableScroll} mk-tableWrap">
      <table class="${C.table} mk-table">
        <thead><tr><th>Client</th><th>Ward</th><th>Case manager</th><th>Legal</th><th class="mk-n">In bed</th><th>Expected out</th><th>Team contact</th><th>Follow-up</th></tr></thead>
        <tbody>${hospRows}</tbody>
      </table>
    </div>
  </section>
  <section class="${C.card} mk-wide">
    ${cardHead(I.home, "Back home: 7-day follow-up", `<span class="mk-meta">Discharged in the last 14 days · seen within 7 days of leaving</span>`)}
    <div class="${C.tableScroll} mk-tableWrap">
      <table class="${C.table} mk-table">
        <thead><tr><th>Client</th><th>Left from</th><th>Left</th><th>Case manager</th><th>7-day contact</th><th><span class="sr-only">Action</span></th></tr></thead>
        <tbody>${disRows}</tbody>
      </table>
    </div>
  </section>`;

  // ---- Referrals ----
  const refRows = REFERRALS.map(
    (r, i) => `<tr data-ref="${r.id}" class="mk-refRow${i === 0 ? " mk-sel" : ""}${r.over ? " mk-overRow" : ""}" tabindex="0">
      <td>${person(r.n, r.u, r.a)}</td>
      <td><span class="mk-mono mk-strong">${r.since}</span><span class="mk-sub">${r.over ? `<span class="mk-overTxt">${G.warning}${esc(r.over)}</span>` : esc(r.due)}</span></td>
      <td><span>${esc(r.fromD)}</span><span class="mk-sub">${esc(r.from === "GP" ? "GP" : r.from === "ED" ? "Emergency department" : "Inpatient ward")} · ${esc(r.lives)}</span></td>
      <td><span>${esc(r.ask)}</span>${r.needs === "—" ? "" : `<span class="mk-sub">Needs ${esc(r.needs.toLowerCase().replace("dari", "Dari"))}</span>`}</td>
      <td class="mk-actCell"><button type="button" class="${C.sec} mk-ctl mk-openRef" data-ref="${r.id}">Open<span class="${C.sr}"> full referral for ${esc(r.n)}</span></button></td>
    </tr>`,
  ).join("");
  const sentRows = SENT.map(
    (s) => `<tr><td>${person(s.n, s.u)}</td><td>${esc(s.to)}</td><td>${s.state === "Accepted" ? tag("success", s.state) : tag("neutral", s.state)}</td><td>${esc(s.when)}</td><td class="mk-actCell"><button type="button" class="${C.sec} mk-ctl">Open</button></td></tr>`,
  ).join("");
  const ansRows = ANSWERED.map(
    (s) => `<tr><td>${person(s.n, s.u)}</td><td>${esc(s.ask)}</td><td>${s.ans === "Accepted" ? tag("success", s.ans) : tag("neutral", s.ans)}</td><td>${esc(s.to)}</td><td>${esc(s.by)} · ${esc(s.when)}</td></tr>`,
  ).join("");
  const cmSelect = (cls = "") =>
    `<span class="mk-select ${cls}"><select class="mk-ctl"><option>Allocate later</option>${STAFF.filter((s) => s.load && s.today !== "leave")
      .map((s) => `<option>${esc(s.name)} · ${s.load} of ${s.cap}</option>`)
      .join("")}</select>${I.chev}</span>`;
  const timeCard = (r) => `
    <div class="mk-timeCard${r.over ? " mk-timeOver" : ""}">
      <div class="mk-tcTop"><span><b class="mk-mono">${r.since}</b> waiting</span><span class="mk-tcLeft">${r.over ? `${G.warning}<b>${esc(r.over)}</b>` : `<b class="mk-mono">${esc(r.due.replace("Due in ", ""))}</b> left`}</span></div>
      <span class="mk-tcBar" aria-hidden="true"><i style="width:${r.pct}%"></i></span>
      <div class="mk-tcFoot"><span>Received ${esc(r.received)}</span><span>Answer by ${esc(r.dueAt)}</span></div>
    </div>`;
  const avatar = (n) => `<span class="mk-bigAv">${n.split(", ").map((x) => x[0]).reverse().join("")}</span>`;
  const detail = (r) => `
    <div class="mk-detail" data-detail="${r.id}"${r.id === "r1" ? "" : " hidden"}>
      <div class="mk-dHead">${avatar(r.n)}<div class="mk-person"><span class="mk-dName">${esc(r.n)}</span><span class="mk-sub"><span class="mk-mono">${r.u}</span> · ${esc(r.a)}</span></div>${tag(r.urgency.startsWith("Urgent") ? "warning" : "neutral", r.urgency.split(",")[0], false)}</div>
      ${timeCard(r)}
      <div class="mk-facts">
        <div><span>From</span><b>${esc(r.fromD)}</b><em>${esc(r.from === "GP" ? "General practice" : r.from === "ED" ? "Emergency department" : "Inpatient ward")}</em></div>
        <div><span>Asking for</span><b>${esc(r.ask)}</b><em>${esc(r.urgency)}</em></div>
        <div><span>Lives in</span><b>${esc(r.lives)}</b><em class="mk-ok">${G.success}${esc(r.catch)}</em></div>
        <div><span>Needs</span><b>${esc(r.needs === "—" ? "Nothing extra" : r.needs)}</b><em>${esc(r.legal)}</em></div>
      </div>
      <p class="mk-dWhy">${esc(r.why)}</p>
      <button type="button" class="mk-docsLink mk-openRef" data-ref="${r.id}">${I.file}<span><b>Full referral</b> · handover, ${r.docs.length} documents, contacts and timeline</span>${ic('<path d="m9 6 6 6-6 6"/>', 14)}</button>
      <label class="mk-field"><span>Case manager</span>${cmSelect()}</label>
      <div class="mk-dActions">${btn(C.pri, "Accept for Midland", "mk-ctl mk-accept", I.check)}${btn(C.sec, "Decline", "mk-ctl mk-decline", "")}</div>
    </div>`;
  // Extra detail for the full referral page (all invented)
  const EXTRA = {
    r1: {
      riskBy: "GP · Fri 30 Oct",
      risk: [["Harm to self", "Low", "Passing thoughts, no plan or intent"], ["Harm to others", "Low", "None reported"], ["Vulnerability", "Moderate", "Lives alone, widowed in March"]],
      safety: "Daughter visits twice a week",
      treat: [["Medicine", "Sertraline 100 mg", "Each morning · 18 months"], ["Allergies", "None known", ""], ["Physical health", "Bloods normal", "Fri 30 Oct"], ["GP", "Castell, Dr Mira", "Midvale Family Practice"]],
      hist: { years: "2019–2020", what: "Depression. Closed well to her GP in Mar 2020.", cm: "Mallard, J.", cmNow: "Still on the team · 17 of 18" },
      pickLabel: "Psychiatrist",
      picks: [["Petrov, Dr Lena", "First slot Mon 9 Nov", "Soonest", 0], ["Ramsay, Dr Kofi", "First slot Tue 10 Nov", "", 0], ["Hartwell, Dr Imogen", "First slot Thu 12 Nov", "Saw her in 2020", 0]],
      later: "Book later",
      people: [["Client", "Sallowfield, June", "Mobile · prefers mornings", "0400 000 201"]],
    },
    r2: {
      riskBy: "RPH ED · Sun 1 Nov",
      risk: [["Harm to self", "Moderate", "Overdose Sun 1 Nov. Regrets it, no current plan"], ["Harm to others", "Low", "None reported"], ["Vulnerability", "Moderate", "Two children under 5 · new to services"]],
      safety: "Safety plan agreed with her husband",
      treat: [["Medicine", "None regular", ""], ["Allergies", "None known", ""], ["Physical health", "Medically cleared", "Paracetamol level safe · Sun 1 Nov"], ["GP", "Farouk, Dr Amina", "Midvale Medical Centre"]],
      hist: null,
      pickLabel: "Case manager",
      picks: [["Kuroki, Hana", "12 of 16 · room for 4", "Most room", 12 / 16], ["Mallard, Jodie", "17 of 18 · room for 1", "", 17 / 18], ["Byrne, Tom", "18 of 20 · duty today", "", 18 / 20]],
      later: "Allocate later",
      people: [["Client", "Quillon, Hattie", "Mobile · Dari speaker", "0400 000 317"], ["GP", "Farouk, Dr Amina", "Midvale Medical Centre", "08 5550 0412"]],
    },
    r3: {
      riskBy: "Moodjar · Mon 2 Nov",
      risk: [["Harm to self", "Low", "None this admission"], ["Harm to others", "Low", "No aggression when unwell"], ["Vulnerability", "Moderate", "Stopped medicine before this admission"]],
      safety: "Lives with his brother, who will tell the team early signs",
      treat: [["Medicine", "Paliperidone depot 150 mg", "Monthly · next due Thu 19 Nov"], ["Allergies", "Penicillin", "Rash"], ["Physical health", "Metabolic bloods done", "Mon 26 Oct · weight up 3 kg"], ["GP", "Whitcombe, Dr Jon", "Swan View Medical"]],
      hist: { years: "2015–2023", what: "Schizophrenia. Closed well in Jun 2023 to his GP and depot clinic.", cm: "Nair, P.", cmNow: "Still on the team · 20 of 20, full" },
      pickLabel: "Case manager",
      picks: [["Nair, Priya", "20 of 20 · full", "Knew him 2015–2023", 1], ["Doyle, Marcus", "19 of 20 · runs depot clinic", "", 19 / 20], ["Kuroki, Hana", "12 of 16 · room for 4", "Most room", 12 / 16]],
      later: "Allocate later",
      people: [["Client", "Rendlesham, Otto", "On Moodjar until Thu 5 Nov", "08 5550 0370"], ["GP", "Whitcombe, Dr Jon", "Swan View Medical", "08 5550 0588"]],
    },
  };
  const fromKind = (r) => (r.from === "GP" ? "GP" : r.from === "ED" ? "Emergency department" : "Inpatient ward");
  const docIc = ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>');
  const shieldIc = ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>');
  const pillIc = ic('<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>');
  const histIc = ic('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>');
  const left = ic('<path d="m15 6-6 6 6 6"/>');
  const right = ic('<path d="m9 6 6 6-6 6"/>');
  const refPage = (r, i) => {
    const x = EXTRA[r.id];
    const N = REFERRALS.length;
    const prev = REFERRALS[(i + N - 1) % N], next = REFERRALS[(i + 1) % N];
    const passN = r.checks.filter((c) => c[0] === "pass").length;
    const firstName = r.n.split(", ")[1];
    const pick = ([name, sub, flag, load], k) => {
      const full = load >= 1;
      return `<label class="mk-pick${full ? " mk-pickFull" : ""}"><input type="radio" name="pick-${r.id}" value="${esc(name)}"${!full && k === (r.id === "r1" ? 0 : r.id === "r2" ? 0 : 2) ? " checked" : ""}>
        <span class="mk-person"><span class="mk-pickN">${esc(name)}</span><span class="mk-sub">${esc(sub)}</span></span>
        ${flag ? `<span class="mk-pickFlag">${esc(flag)}</span>` : ""}
      </label>`;
    };
    return `
    <div class="mk-refPage" data-refpage="${r.id}" hidden>
      <div class="mk-rpBar">
        <button type="button" class="${C.ghost} mk-ctl mk-rpBack">${left}<span class="${C.label}">Referrals</span></button>
        <span class="mk-rpSep" aria-hidden="true">/</span>
        <span class="mk-rpCrumb">${esc(r.n)}</span>
        <span class="mk-rpNav" aria-label="Move between referrals">
          <span class="mk-rpPos"><b>${i + 1}</b> of ${N} to answer</span>
          <button type="button" class="${C.sec} mk-ctl mk-rpStep mk-icoBtn" data-step="${prev.id}"${i === 0 ? " disabled" : ""} aria-label="Previous referral${i === 0 ? "" : ", " + esc(prev.n)}">${left}</button>
          <button type="button" class="${C.sec} mk-ctl mk-rpStep mk-icoBtn" data-step="${next.id}"${i === N - 1 ? " disabled" : ""} aria-label="Next referral${i === N - 1 ? "" : ", " + esc(next.n)}">${right}</button>
        </span>
      </div>

      <section class="${C.card} mk-rpHead">
        <div class="mk-rpWho">
          <span class="mk-bigAv mk-av48">${r.n.split(", ").map((y) => y[0]).reverse().join("")}</span>
          <div class="mk-person">
            <h2 class="mk-rpName" tabindex="-1">${esc(r.n)} <span class="mk-mono">${r.u}</span></h2>
            <span class="mk-sub">${esc(r.a)} · ${esc(r.lives)}, ${esc(r.catch.toLowerCase())} · ${esc(r.known)}</span>
          </div>
          <span class="mk-rpTags">${tag(r.urgency.startsWith("Urgent") ? "warning" : "neutral", r.urgency, r.urgency.startsWith("Urgent"))}${tag("neutral", r.legal, false)}</span>
        </div>
        <dl class="mk-rpStrip">
          <div><dt>Asking for</dt><dd>${esc(r.ask)}</dd></div>
          <div><dt>From</dt><dd>${esc(r.fromD)}</dd><dd class="mk-sub">${esc(fromKind(r))}</dd></div>
          <div><dt>Interpreter</dt><dd>${esc(r.interp)}</dd></div>
          <div><dt>Transport</dt><dd>${r.needs === "Transport" ? "Needed" : "Not needed"}</dd>${r.needs === "Transport" ? `<dd class="mk-sub">Does not drive</dd>` : ""}</div>
          <div><dt>First contact asked</dt><dd>${esc(r.firstContact)}</dd></div>
        </dl>
      </section>

      <div class="mk-rpGrid">
        <div class="mk-col">
          <section class="${C.card}">
            ${cardHead(I.inbox, "Handover", `<span class="mk-meta">${esc(r.contacts[0][1])} · ${esc(r.received)}</span>`)}
            <dl class="mk-isbar">${r.isbar.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
          </section>

          <div class="mk-two">
            <section class="${C.card}">
              ${cardHead(shieldIc, "Risk summary", `<span class="mk-meta">${esc(x.riskBy)}</span>`)}
              <ul class="mk-kv">${x.risk
                .map(([k, lvl, note]) => `<li><span class="mk-kvK">${k}</span><span class="mk-kvV">${lvl === "Low" ? `<span class="mk-lvl">${lvl}</span>` : tag("warning", lvl, false)}<span class="mk-sub">${esc(note)}</span></span></li>`)
                .join("")}
                <li><span class="mk-kvK">Safety</span><span class="mk-kvV"><span class="mk-kvT">${esc(x.safety)}</span></span></li>
              </ul>
            </section>
            <section class="${C.card}">
              ${cardHead(pillIc, "Treatment and health", "")}
              <ul class="mk-kv">${x.treat
                .map(([k, v, s]) => `<li><span class="mk-kvK">${k}</span><span class="mk-kvV"><span class="mk-kvT">${esc(v)}</span>${s ? `<span class="mk-sub">${esc(s)}</span>` : ""}</span></li>`)
                .join("")}</ul>
            </section>
          </div>

          <section class="${C.card}">
            ${cardHead(I.file, `Documents <span class="${C.count}"><span>${r.docs.length}</span></span>`, btn(C.ghost, "Ask for more", "mk-ctl mk-askMore", I.send))}
            <ul class="mk-docs">${r.docs
              .map(
                ([name, meta]) => `<li><span class="mk-docIc">${docIc}</span><span class="mk-person"><span class="mk-docName">${esc(name)}</span><span class="mk-sub">PDF · ${esc(meta)}</span></span><button type="button" class="${C.sec} mk-ctl mk-viewDoc" data-doc="${esc(name)}" data-meta="${esc(meta)}" data-who="${esc(r.n)}">View<span class="${C.sr}"> ${esc(name)}</span></button></li>`,
              )
              .join("")}</ul>
          </section>

          <section class="${C.card}">
            ${cardHead(I.users, "People", "")}
            <ul class="mk-people">${[...x.people.slice(0, 1), ...r.contacts.slice(1), r.contacts[0], ...x.people.slice(1)]
              .map(
                ([role, name, sub, ph]) => `<li><span class="mk-bigAv mk-avSm">${name.replace("Dr ", "").split(", ").map((y) => y[0]).reverse().join("")}</span><span class="mk-person"><span class="mk-docName">${esc(name)}</span><span class="mk-sub">${role} · ${esc(sub)}</span></span><span class="mk-mono mk-ph">${ph}</span><button type="button" class="${C.ghost} mk-ctl mk-icoBtn" aria-label="Call ${esc(name)}">${I.phone}</button></li>`,
              )
              .join("")}</ul>
          </section>
          <section class="${C.card}">
            ${cardHead(histIc, "With this team before", "")}
            ${
              x.hist
                ? `<div class="mk-hist"><div><span class="mk-histY mk-mono">${x.hist.years}</span><span class="mk-kvT">${esc(x.hist.what)}</span></div>
                   <div class="mk-histCm"><span class="mk-av">${x.hist.cm.split(", ").map((y) => y[0]).reverse().join("")}</span><span class="mk-person"><span class="mk-docName">Case manager ${esc(x.hist.cm)}</span><span class="mk-sub">${esc(x.hist.cmNow)}</span></span></div></div>`
                : `<p class="mk-hist mk-kvT">New to mental health services. No earlier record found.</p>`
            }
          </section>
        </div>

        <div class="mk-col">
          <section class="${C.card} mk-rpDecide">
            ${cardHead(I.check, "Answer", `<span class="mk-passChip">${G.success}${passN} checks pass</span>`)}
            <div class="mk-rpTime">${timeCard(r)}</div>
            <ul class="mk-checks">${r.checks
              .map(
                ([k, title, d]) =>
                  `<li data-k="${k}">${k === "pass" ? `<span class="mk-ckOk">${I.check}</span>` : `<span class="mk-ckInfo">i</span>`}<span class="mk-person"><span class="mk-ckT">${esc(title)}</span><span class="mk-sub">${esc(d)}</span></span>${
                    title === "Interpreter" ? btn(C.sec, "Book", "mk-ctl mk-sm") : ""
                  }</li>`,
              )
              .join("")}</ul>
            <div class="mk-decide">
              <fieldset class="mk-picks"><legend>${x.pickLabel}</legend>
                ${x.picks.map(pick).join("")}
                <label class="mk-pick mk-pickLater"><input type="radio" name="pick-${r.id}" value="${x.later}"><span class="mk-person"><span class="mk-pickN">${x.later}</span><span class="mk-sub">Team leader allocates at Tuesday intake</span></span></label>
              </fieldset>
              <label class="mk-field"><span>First contact</span><span class="mk-select"><select class="mk-ctl">${["Within 72 hours", "Within 7 days", "Within 14 days", "Before discharge"].map((o) => `<option${o === r.firstContact ? " selected" : ""}>${o}</option>`).join("")}</select>${I.chev}</span></label>
              <div class="mk-dActions">
                ${btn(C.pri, "Accept for Midland", "mk-ctl mk-accept", I.check)}
                <div class="mk-dRow">${btn(C.sec, "Ask for more", "mk-ctl mk-askMore", I.send)}${btn(C.sec, "Decline", "mk-ctl mk-decline", "")}</div>
              </div>
              <p class="mk-small mk-after">Accepting tells ${esc(r.contacts[0][1].replace(/^(\w+), (Dr )?(\w+)$/, "$2$3 $1"))} and adds ${esc(firstName)} to the caseload.</p>
            </div>
          </section>

          <section class="${C.card}">
            ${cardHead(I.clock, "Timeline", "")}
            <form class="mk-note"><input class="${C.input} mk-ctl" placeholder="Add a note for the team" aria-label="Add a note for the team"><button type="submit" class="${C.sec} mk-ctl">Add</button></form>
            <ol class="mk-tl">${r.timeline.map(([w, a, d]) => `<li><span class="mk-tlDot"></span><span class="mk-person"><span class="mk-tlA">${esc(a)}</span><span class="mk-sub">${esc(w)}${d ? ` · ${esc(d)}` : ""}</span></span></li>`).join("")}</ol>
          </section>
        </div>
      </div>
    </div>`;
  };
  const referrals = `
  <div class="mk-refGrid">
    <section class="${C.card}">
      ${cardHead(
        I.inbox,
        "Referrals",
        segBtns(
          [
            ["q", "To answer", 3],
            ["s", "Sent by team", 2],
            ["h", "Answered", 14],
          ],
          "ref",
        ),
      )}
      <div class="mk-pane" data-pane-of="ref" data-key="q">
        <div class="${C.tableScroll} mk-tableWrap"><table class="${C.table} mk-table mk-refTable"><thead><tr><th>Client</th><th>Since referral</th><th>From</th><th>Asking for</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${refRows}</tbody></table></div>
        <div class="mk-tableFoot"><span class="mk-shown">Answer within 3 days · oldest first</span></div>
      </div>
      <div class="mk-pane" data-pane-of="ref" data-key="s" hidden>
        <div class="${C.tableScroll} mk-tableWrap"><table class="${C.table} mk-table"><thead><tr><th>Client</th><th>Sent to</th><th>Answer</th><th>Sent</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${sentRows}</tbody></table></div>
      </div>
      <div class="mk-pane" data-pane-of="ref" data-key="h" hidden>
        <div class="${C.tableScroll} mk-tableWrap"><table class="${C.table} mk-table"><thead><tr><th>Client</th><th>Asked for</th><th>Answer</th><th>Allocated to</th><th>By</th></tr></thead><tbody>${ansRows}</tbody></table></div>
        <div class="mk-tableFoot"><span class="mk-shown">Showing 4 of 14 this month</span></div>
      </div>
    </section>
    <section class="${C.card} mk-detailCard">
      ${REFERRALS.map(detail).join("")}
    </section>
  </div>
  ${REFERRALS.map(refPage).join("")}`;

  // ---- Clinicians ----
  const staffRows = STAFF.map((s) => {
    const [tone, label] = TODAY[s.today];
    const load = s.load
      ? `<span class="mk-track mk-trackSm" aria-hidden="true"><span style="width:${(s.load / 20) * 100}%"></span><i style="left:${(s.cap / 20) * 100}%"></i></span><span class="mk-loadN"><b>${s.load}</b> of ${s.cap}</span>`
      : s.med
        ? `<span class="mk-loadN"><b>${s.med}</b> medical</span>`
        : s.co
          ? `<span class="mk-loadN"><b>${s.co}</b> shared</span>`
          : `<span class="mk-muted">—</span>`;
    return `<tr data-today="${s.today}"><td><span class="mk-cm mk-cmLg"><span class="mk-av">${s.ini}</span><span class="mk-name">${esc(s.name)}</span></span></td>
      <td><span>${esc(s.role)}</span>${s.note ? `<span class="mk-sub">${esc(s.note)}</span>` : ""}</td>
      <td>${tag(tone, label)}<span class="mk-sub">${esc(s.where)}</span></td>
      <td><span class="mk-loadCell">${load}</span></td>
      <td class="mk-mono">${s.ext}</td>
      <td class="mk-actCell">${btn(C.sec, "Call", "mk-ctl", I.phone)}</td></tr>`;
  }).join("");
  const clinicians = `
  <div class="mk-three">
      <section class="${C.card}">
        ${cardHead(I.cal, "Today's cover", `<span class="mk-meta">Mon 2 Nov</span>`)}
        <dl class="mk-dl">
          <div><dt>Duty officer</dt><dd>Byrne, T. · <span class="mk-mono">4105</span></dd></div>
          <div><dt>Intake</dt><dd>Vance, K. · <span class="mk-mono">4104</span></dd></div>
          <div><dt>Doctor of the day</dt><dd>Petrov, Dr L. · <span class="mk-mono">4103</span></dd></div>
          <div><dt>Leave cover</dt><dd>Mallard, J. for Walsh, E.</dd></div>
        </dl>
      </section>
      <section class="${C.card}">
        ${cardHead(I.cal, "This week", "")}
        <ul class="mk-week">
          <li><b>Mon</b><span>Allocation meeting 13:30</span></li>
          <li><b>Tue</b><span>Clozapine clinic 09:00</span></li>
          <li><b>Wed</b><span>Team review 14:00</span></li>
          <li><b>Thu</b><span>Depot clinic 09:00</span></li>
          <li><b>Fri</b><span>CTO reviews, Dr Hartwell</span></li>
        </ul>
      </section>
      <section class="${C.card}">
        ${cardHead(I.pin, "Rooms and cars", `<span class="mk-meta">Sample</span>`)}
        <dl class="mk-dl">
          <div><dt>Interview rooms</dt><dd>2 of 4 free</dd></div>
          <div><dt>Cars</dt><dd>1 of 3 at base · next back 12:30</dd></div>
          <div><dt>Depot fridge</dt><dd>Checked 08:40 · Doyle, M.</dd></div>
        </dl>
      </section>
  </div>
  <section class="${C.card} mk-wide">
    ${cardHead(
      I.steth,
      "Clinicians",
      segBtns(
        [
          ["all", "All", 12],
          ["in", "At base", 8],
          ["field", "In the field", 3],
          ["away", "Away", 1],
        ],
        "staff",
      ),
    )}
    <div class="${C.tableScroll} mk-tableWrap"><table class="${C.table} mk-table mk-staffTable"><thead><tr><th>Clinician</th><th>Role</th><th>Today</th><th>Caseload</th><th>Ext</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${staffRows}</tbody></table></div>
  </section>`;

  const body = document.createElement("div");
  body.className = "mk-body";
  body.innerHTML = `${tabBar}
    <section class="mk-panel" data-panel="home">${home}</section>
    <section class="mk-panel" data-panel="caseload" hidden>${caseload}</section>
    <section class="mk-panel" data-panel="hospital" hidden>${hospital}</section>
    <section class="mk-panel" data-panel="referrals" hidden>${referrals}</section>
    <section class="mk-panel" data-panel="clinicians" hidden>${clinicians}</section>
    <footer class="mk-foot"><span class="mk-chip">Synthetic prototype</span><span>Mock-up · invented people and numbers · not approved for clinical use</span><button type="button" class="${C.ghost} mk-ctl mk-notesBtn">Mock-up notes</button></footer>`;
  standing.after(body);

  // Top bar title and rail stay as rendered by the app.
})(window.__W);
