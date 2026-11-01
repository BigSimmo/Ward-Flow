(() => {
  // Fit the 1440px desktop picture to narrower screens instead of scrolling sideways.
  const fit = () => {
    const z = Math.min(1, window.innerWidth / 1440);
    document.documentElement.style.zoom = z < 1 ? String(z) : "";
    document.documentElement.style.setProperty("--mk-vh", window.innerHeight / z + "px");
  };
  fit();
  addEventListener("resize", fit);
  // Follow the viewer's light or dark setting, as the app does.
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const theme = () => {
    document.documentElement.classList.toggle("dark", mq.matches);
    const shell = document.querySelector(".ward-flow-layout_shellContent__jg7kj");
    if (shell) document.documentElement.style.setProperty("--mk-canvas", getComputedStyle(shell).backgroundColor);
  };
  theme();
  mq.addEventListener?.("change", theme);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SEG_ON = "choice_segOn___P2Nm";
  const G_OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  // Toast
  const toast = document.createElement("div");
  toast.className = "mk-toast";
  toast.setAttribute("role", "status");
  toast.hidden = true;
  document.body.appendChild(toast);
  let tt;
  const say = (msg, undo) => {
    toast.innerHTML = `<span>${msg}</span>${undo ? '<button type="button">Undo</button>' : ""}`;
    toast.hidden = false;
    if (undo) toast.querySelector("button").onclick = () => { undo(); toast.hidden = true; };
    clearTimeout(tt);
    tt = setTimeout(() => (toast.hidden = true), 5000);
  };

  // Main tabs
  const showTab = (key) => {
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === key)));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== key));
    const bar = $(".mk-tabBar");
    const top = bar.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight) bar.scrollIntoView({ block: "start" });
  };
  document.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { closeRef(); return showTab(tab.dataset.tab); }
    const go = e.target.closest("[data-go]");
    if (go && go.dataset.go) {
      showTab(go.dataset.go);
      if (go.dataset.cm) {
        const sel = $(".mk-cmSel");
        sel.value = go.dataset.cm;
        filterCaseload();
      }
      return;
    }
    // Segments
    const seg = e.target.closest("[data-seg] [role=tab]");
    if (seg) {
      const group = seg.closest("[data-seg]");
      $$("[role=tab]", group).forEach((b) => {
        const on = b === seg;
        b.classList.toggle(SEG_ON, on);
        b.setAttribute("aria-selected", String(on));
      });
      const name = group.dataset.seg;
      $$(`[data-pane-of="${name}"]`).forEach((p) => (p.hidden = p.dataset.key !== seg.dataset.key));
      if (name === "case") filterCaseload();
      if (name === "staff") filterStaff(seg.dataset.key);
      return;
    }
    // Referral rows
    const row = e.target.closest(".mk-refRow");
    if (row && !e.target.closest("button")) return pickRef(row);
    // More menu
    const more = e.target.closest(".mk-moreBtn");
    const menu = $(".mk-menu");
    if (more) { menu.hidden = !menu.hidden; return; }
    if (!e.target.closest(".mk-menu")) menu.hidden = true;
    else if (e.target.textContent === "About this data") { openNotes(); menu.hidden = true; return; }
    // Accept / decline
    const acc = e.target.closest(".mk-accept");
    if (acc) {
      const d = acc.closest(".mk-detail, .mk-refPage");
      const name = (d.querySelector(".mk-dName, .mk-rpName").childNodes[0].textContent || "").trim();
      const radio = d.querySelector("input[type=radio]:checked");
      const who = radio ? radio.value : d.querySelector("select").value;
      const role = d.querySelector(".mk-picks legend")?.textContent.toLowerCase() || "case manager";
      const actions = acc.closest(".mk-dActions");
      const html = actions.outerHTML;
      const later = /later/i.test(who);
      const after = d.querySelector(".mk-after");
      actions.outerHTML = `<div class="mk-done">${G_OK}<span>Accepted${later ? ", not allocated yet" : ". " + role[0].toUpperCase() + role.slice(1) + ": " + who.split(" · ")[0]}</span></div>`;
      if (after) after.hidden = true;
      say(`Accepted ${name}`, () => { d.querySelector(".mk-done").outerHTML = html; if (after) after.hidden = false; });
      return;
    }
    const open = e.target.closest(".mk-openRef, .mk-rpStep");
    if (open) return openRef(open.dataset.ref || open.dataset.step);
    if (e.target.closest(".mk-rpBack")) return closeRef();
    const vd = e.target.closest(".mk-viewDoc");
    if (vd) return viewDoc(vd);
    if (e.target.closest(".mk-dvClose") || e.target.classList.contains("mk-docView")) return closeDoc();
    if (e.target.closest(".mk-askMore")) { say("Ask for more opens a message to the referrer, with a list of what is missing (mock-up)"); return; }
    if (e.target.closest(".mk-decline")) { say("Decline opens a reason list and where to send the person (mock-up)"); return; }
    if (e.target.closest(".mk-notesBtn")) return openNotes();
    if (e.target.closest(".mk-notes .mk-x")) { $(".mk-notes").hidden = true; return; }
    const b = e.target.closest(".mk-body button, .hero_hero__6AGeu button");
    if (b && !b.closest("[data-seg]")) {
      const label = (b.querySelector(".button_label__IGDyR") || b).textContent.trim().split(" ")[0] ? (b.querySelector(".button_label__IGDyR") || b).childNodes[0]?.textContent?.trim() || b.textContent.trim() : "";
      if (label) say(`${label}: opens in the build (mock-up)`);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList?.contains("mk-refRow")) pickRef(e.target);
    if (e.key === "Escape") { const n = $(".mk-notes"); if (n) n.hidden = true; closeDoc(); }
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); $(".mk-find input").focus(); }
  });

  function openRef(id) {
    showTab("referrals");
    $(".mk-refGrid").hidden = true;
    $$("[data-refpage]").forEach((p) => (p.hidden = p.dataset.refpage !== id));
    const bar = $(".mk-tabBar");
    if (bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: "start", behavior: "smooth" });
    $(`[data-refpage="${id}"] .mk-rpName`).focus({ preventScroll: true });
  }
  function closeRef() {
    $$("[data-refpage]").forEach((p) => (p.hidden = true));
    $(".mk-refGrid").hidden = false;
  }
  function pickRef(row) {
    $$(".mk-refRow").forEach((r) => r.classList.toggle("mk-sel", r === row));
    $$("[data-detail]").forEach((d) => (d.hidden = d.dataset.detail !== row.dataset.ref));
  }

  // Caseload filters
  const filterCaseload = () => {
    const key = $('[data-seg="case"] [aria-selected="true"]')?.dataset.key || "all";
    const cm = $(".mk-cmSel").value;
    let n = 0;
    $$('[data-panel="caseload"] tbody tr').forEach((tr) => {
      const okKey = key === "all" || tr.dataset.flags.split(" ").includes(key);
      const okCm = !cm || (cm === "psych" ? tr.dataset.psych === "1" : tr.dataset.cm === cm);
      tr.hidden = !(okKey && okCm);
      if (!tr.hidden) n++;
    });
    $('[data-panel="caseload"] .mk-shown').textContent = key === "all" && !cm ? "Showing 24 of 142" : `${n} shown in this sample`;
  };
  $(".mk-cmSel").addEventListener("change", filterCaseload);

  // Search filters the caseload and clinicians
  $(".mk-find input").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q && $('[data-panel="caseload"]').hidden && $('[data-panel="clinicians"]').hidden) showTab("caseload");
    $$('[data-panel="caseload"] tbody tr, [data-panel="clinicians"] tbody tr').forEach((tr) => (tr.hidden = q && !tr.textContent.toLowerCase().includes(q)));
  });

  const filterStaff = (key) => {
    $$('[data-panel="clinicians"] tbody tr').forEach((tr) => {
      const t = tr.dataset.today;
      tr.hidden = !(key === "all" || (key === "in" && t !== "leave" && t !== "field") || (key === "field" && t === "field") || (key === "away" && t === "leave"));
    });
  };

  // Team notes on the timeline
  document.addEventListener("submit", (e) => {
    const f = e.target.closest(".mk-note");
    if (!f) return;
    e.preventDefault();
    const inp = f.querySelector("input");
    const t = inp.value.trim();
    if (!t) return inp.focus();
    const li = document.createElement("li");
    li.className = "mk-tlNew";
    li.innerHTML = `<span class="mk-tlDot"></span><span class="mk-person"><span class="mk-tlA"></span><span class="mk-sub">Just now · You</span></span>`;
    li.querySelector(".mk-tlA").textContent = t;
    f.nextElementSibling.prepend(li);
    inp.value = "";
    say("Note added");
  });

  // Document viewer (sample pages only)
  const dv = document.createElement("div");
  dv.className = "mk-docView";
  dv.hidden = true;
  dv.innerHTML = `<div class="mk-dvBox" role="dialog" aria-modal="true" aria-labelledby="mk-dvT"><div class="mk-dvHead"><div class="mk-person"><span class="mk-docName" id="mk-dvT"></span><span class="mk-sub"></span></div><button type="button" class="button_b__ZSINe button_sec__PlXCk button_sm__AYUhM mk-ctl">Download</button><button type="button" class="button_b__ZSINe button_ghost__EeF_Z button_sm__AYUhM mk-ctl mk-icoBtn mk-dvClose" aria-label="Close document"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="mk-dvBody"><div class="mk-paper"></div></div></div>`;
  document.body.appendChild(dv);
  let lastDocBtn = null;
  function viewDoc(b) {
    lastDocBtn = b;
    dv.querySelector("#mk-dvT").textContent = b.dataset.doc;
    dv.querySelector(".mk-dvHead .mk-sub").textContent = `${b.dataset.who} · PDF · ${b.dataset.meta}`;
    const w = [92, 100, 84, 96, 70, 0, 100, 88, 94, 60, 0, 98, 90, 76, 100, 52];
    dv.querySelector(".mk-paper").innerHTML = `<h3></h3><p></p>${w.map((x) => (x ? `<i style="width:${x}%"></i>` : '<i style="height:0;margin:0 0 22px"></i>')).join("")}<div class="mk-wm">SAMPLE · NOT A REAL RECORD</div>`;
    dv.querySelector(".mk-paper h3").textContent = b.dataset.doc;
    dv.querySelector(".mk-paper p").textContent = `${b.dataset.who} · ${b.dataset.meta}`;
    dv.hidden = false;
    dv.querySelector(".mk-dvClose").focus();
  }
  function closeDoc() { if (dv.hidden) return; dv.hidden = true; lastDocBtn?.focus(); }

  // Notes
  function openNotes() { $(".mk-notes").hidden = false; $(".mk-notes .mk-x").focus(); }
})();
