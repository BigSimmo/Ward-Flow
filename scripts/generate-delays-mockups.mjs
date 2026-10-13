import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("docs/ward-flow/mockups/delays-perfected-third-edition.html");
const sourceHtml = fs.readFileSync(sourcePath, "utf-8");

// Locate the crisisRadarPanel section
const startMarker = '<!-- ─── CRISIS RADAR MATRIX (Interactive Large Graph Tool) ────────── -->';
const endMarker = '<!-- ─── THREE STRATEGIC PILLARS ──────────────────────────────────────── -->';

const startIndex = sourceHtml.indexOf(startMarker);
const endIndex = sourceHtml.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find replacement boundaries in source mockup!");
  process.exit(1);
}

const beforePart = sourceHtml.slice(0, startIndex);
const afterPart = sourceHtml.slice(endIndex);

// Common styles to add for the new panels
const additionalStyles = `
      /* ─── ENHANCED TOP PANELS STYLING ─── */
      .runwayPanel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--r1);
        box-shadow: var(--lift);
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px;
        overflow: hidden;
        margin-bottom: 14px;
      }
      .runwaySentinelStrip {
        background: var(--danger-soft);
        border: 1px solid var(--danger);
        border-radius: var(--r2);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .runwaySentinelHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      }
      .runwaySentinelTitle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--t-1);
        font-weight: 700;
        color: var(--danger-ink);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .runwaySentinelBadge {
        font-family: var(--mono);
        font-size: var(--t-0);
        font-weight: 700;
        background: var(--surface);
        color: var(--danger);
        border: 1px solid var(--danger);
        padding: 2px 8px;
        border-radius: var(--pill);
      }
      .runwayPatientGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 10px;
      }
      .runwayPatientCard {
        background: var(--surface);
        border: 1.5px solid var(--danger);
        border-radius: var(--r2);
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 8px;
        text-align: left;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }
      .runwayPatientCard:hover {
        transform: translateY(-1px);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
      }
      .runwayPatientCardImminent {
        border-color: var(--warn);
      }
      .runwayPatientTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .runwayTagBreached {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--danger);
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .runwayTagImminent {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--warn);
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .runwayPatientName {
        font-size: var(--t-2);
        font-weight: 700;
        color: var(--ink);
      }
      .runwayTimeTag {
        font-family: var(--mono);
        font-size: var(--t-0);
        font-weight: 700;
        color: var(--danger);
      }
      .runwayTimeTagImminent {
        color: var(--warn-ink);
      }
      .runwayPatientMid {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: var(--t-0);
        color: var(--muted);
      }
      .runwayPatientForm {
        font-weight: 600;
        color: var(--ink-soft);
      }
      .runwayPatientBottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 6px;
        border-top: 1px solid var(--line);
        font-size: var(--t-0);
      }
      .runwayPatientWait {
        color: var(--muted);
        font-family: var(--mono);
      }
      .runwayReviewLink {
        color: var(--accent);
        font-weight: 700;
      }
      .runwayBlockersGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 12px;
      }
      .runwayOwnerCard {
        background: var(--surface-2);
        border: 1.5px solid var(--line);
        border-radius: var(--r2);
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
      }
      .runwayOwnerCard:hover {
        border-color: var(--accent);
        background: var(--surface);
      }
      .runwayOwnerHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .runwayOwnerTitle {
        font-size: var(--t-1);
        font-weight: 700;
        color: var(--ink);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .runwayOwnerCount {
        font-family: var(--mono);
        font-size: var(--t-5);
        font-weight: 700;
        color: var(--ink);
      }
      .runwayOwnerCritical {
        font-size: var(--t-0);
        font-weight: 600;
        color: var(--danger);
      }
      .runwayOwnerAllClear {
        font-size: var(--t-0);
        font-weight: 600;
        color: var(--good-ink);
      }
      .runwayOwnerFooter {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: var(--t-0);
        color: var(--muted);
        font-family: var(--mono);
        padding-top: 4px;
        border-top: 1px solid var(--line);
      }
      .runwayMacroStrip {
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: var(--r2);
        padding: 8px 14px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: var(--t-1);
      }
      .runwayMacroLegend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
        font-family: var(--mono);
        font-size: var(--t-0);
      }
      .runwayMacroItem {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
`;

function buildNavigationNav(activeOption) {
  const options = [
    { id: 1, name: "Option 1: Action Runway", file: "delays-mockup-runway.html" },
    { id: 2, name: "Option 2: Stacked Histogram", file: "delays-mockup-histogram.html" },
    { id: 3, name: "Option 3: 2×2 Decision Matrix", file: "delays-mockup-matrix.html" },
    { id: 4, name: "Option 4: Catchment Pressure", file: "delays-mockup-catchment.html" },
  ];

  return `
  <!-- TOP MOCKUP SWITCHER BANNER -->
  <nav style="background: var(--surface-2); border-bottom: 2px solid var(--accent); padding: 8px 20px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; z-index: 1000; position: sticky; top: 0; box-shadow: var(--lift); flex-wrap: wrap; gap: 8px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">Ward Flow Delays Header Mockup</span>
      <span style="color: var(--line-strong);">|</span>
      <span style="font-weight: 600; color: var(--ink);">Viewing: <strong>${options.find(o => o.id === activeOption).name}</strong></span>
    </div>
    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
      ${options.map(opt => {
        const isActive = opt.id === activeOption;
        const style = isActive
          ? "background: var(--accent); color: var(--on-accent); border: 1px solid var(--accent);"
          : "background: var(--surface); color: var(--ink); border: 1px solid var(--line);";
        return `<a href="${opt.file}" style="padding: 4px 10px; border-radius: 4px; text-decoration: none; font-size: 11.5px; font-weight: 600; ${style}">${opt.name}</a>`;
      }).join("")}
      <a href="mockups/ward-flow/delays" style="padding: 4px 10px; border-radius: 4px; text-decoration: none; font-size: 11.5px; font-weight: 600; background: var(--surface); color: var(--muted); border: 1px solid var(--line);">Back to App →</a>
    </div>
  </nav>
  `;
}

// ─── OPTION 1 CONTENT ───
const option1Html = `
          <!-- ─── OPTION 1: DUAL-HORIZON ACTION RUNWAY ────────── -->
          <section class="runwayPanel" id="actionRunwayPanel" aria-label="Action Runway Matrix">
            <!-- Tier 1: Statutory Sentinel Strip -->
            <div class="runwaySentinelStrip">
              <div class="runwaySentinelHeader">
                <div class="runwaySentinelTitle">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--danger); display: inline-block;"></span>
                  <span>Statutory &amp; Safety Sentinel · Immediate Detention / Legal Jeopardy</span>
                </div>
                <span class="runwaySentinelBadge">2 Breached · 1 Expiring &lt;60m</span>
              </div>

              <div class="runwayPatientGrid">
                <!-- Breached 1 -->
                <div class="runwayPatientCard" onclick="alert('Viewing Jane Doe (FSH) - Form 1A expired 42m ago')">
                  <div class="runwayPatientTop">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="runwayTagBreached">Breached</span>
                      <span class="runwayPatientName">Jane Doe</span>
                    </div>
                    <span class="runwayTimeTag">-42m ago</span>
                  </div>
                  <div class="runwayPatientMid">
                    <span>FSH Emergency</span>
                    <span class="runwayPatientForm">Form 1A (MHA)</span>
                  </div>
                  <div class="runwayPatientBottom">
                    <span class="runwayPatientWait">Wait: 26h in ED</span>
                    <span class="runwayReviewLink">Review Drawer →</span>
                  </div>
                </div>

                <!-- Breached 2 -->
                <div class="runwayPatientCard" onclick="alert('Viewing John Smith (SCGH) - Form 3A expired 15m ago')">
                  <div class="runwayPatientTop">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="runwayTagBreached">Breached</span>
                      <span class="runwayPatientName">John Smith</span>
                    </div>
                    <span class="runwayTimeTag">-15m ago</span>
                  </div>
                  <div class="runwayPatientMid">
                    <span>SCGH Emergency</span>
                    <span class="runwayPatientForm">Form 3A (Detention)</span>
                  </div>
                  <div class="runwayPatientBottom">
                    <span class="runwayPatientWait">Wait: 14h in ED</span>
                    <span class="runwayReviewLink">Review Drawer →</span>
                  </div>
                </div>

                <!-- Imminent 1 -->
                <div class="runwayPatientCard runwayPatientCardImminent" onclick="alert('Viewing Alex Ray (RPH) - Form 1A due in 24m')">
                  <div class="runwayPatientTop">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="runwayTagImminent">Due in 24m</span>
                      <span class="runwayPatientName">Alex Ray</span>
                    </div>
                    <span class="runwayTimeTagImminent">+24m left</span>
                  </div>
                  <div class="runwayPatientMid">
                    <span>RPH Emergency</span>
                    <span class="runwayPatientForm">Form 1A (MHA)</span>
                  </div>
                  <div class="runwayPatientBottom">
                    <span class="runwayPatientWait">Wait: 3.5h in ED</span>
                    <span class="runwayReviewLink">Review Drawer →</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tier 2: Blocker Ownership Pipeline Cards -->
            <div class="runwayBlockersGrid">
              <div class="runwayOwnerCard">
                <div class="runwayOwnerHeader">
                  <span class="runwayOwnerTitle">Yours (Coordinator)</span>
                  <span class="runwayOwnerCount">12</span>
                </div>
                <div class="runwayOwnerCritical">3 critical blockers</div>
                <div style="background: var(--line); height: 6px; border-radius: 3px; overflow: hidden; display: flex; margin: 4px 0;">
                  <div style="background: var(--danger); width: 25%;"></div>
                  <div style="background: var(--accent); width: 75%;"></div>
                </div>
                <div class="runwayOwnerFooter">
                  <span>Pending bed match</span>
                  <span style="color: var(--accent); font-weight: 700;">Filter (12) →</span>
                </div>
              </div>

              <div class="runwayOwnerCard">
                <div class="runwayOwnerHeader">
                  <span class="runwayOwnerTitle">Receiving Inpatient Wards</span>
                  <span class="runwayOwnerCount">48</span>
                </div>
                <div class="runwayOwnerCritical">40 critical blockers</div>
                <div style="background: var(--line); height: 6px; border-radius: 3px; overflow: hidden; display: flex; margin: 4px 0;">
                  <div style="background: var(--danger); width: 83%;"></div>
                  <div style="background: var(--accent); width: 17%;"></div>
                </div>
                <div class="runwayOwnerFooter">
                  <span>Waiting on ward doctor / bed clean</span>
                  <span style="color: var(--accent); font-weight: 700;">Filter (48) →</span>
                </div>
              </div>

              <div class="runwayOwnerCard">
                <div class="runwayOwnerHeader">
                  <span class="runwayOwnerTitle">Transport &amp; Escort</span>
                  <span class="runwayOwnerCount">10</span>
                </div>
                <div class="runwayOwnerAllClear">0 critical · Transit dispatch</div>
                <div style="background: var(--line); height: 6px; border-radius: 3px; overflow: hidden; display: flex; margin: 4px 0;">
                  <div style="background: var(--good); width: 100%;"></div>
                </div>
                <div class="runwayOwnerFooter">
                  <span>Secure transfer / vehicle</span>
                  <span style="color: var(--accent); font-weight: 700;">Filter (10) →</span>
                </div>
              </div>
            </div>

            <!-- Tier 3: Macro ED Duration Breakdown Strip -->
            <div class="runwayMacroStrip">
              <span style="font-weight: 600; color: var(--ink);">Emergency Department Wait Durations:</span>
              <div class="runwayMacroLegend">
                <span class="runwayMacroItem">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--muted); display: inline-block;"></span>
                  &lt;8h Standard: <strong style="color: var(--ink);">42</strong>
                </span>
                <span class="runwayMacroItem" style="color: var(--warn-ink);">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--warn); display: inline-block;"></span>
                  8–24h Access Block: <strong>23</strong>
                </span>
                <span class="runwayMacroItem" style="color: var(--danger-ink);">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--danger); display: inline-block;"></span>
                  &gt;24h Boarding: <strong>5</strong>
                </span>
              </div>
            </div>
          </section>
`;

// ─── OPTION 2 CONTENT ───
const option2Html = `
          <!-- ─── OPTION 2: STACKED ACCESS-BLOCK HISTOGRAM ────────── -->
          <section class="runwayPanel" id="histogramPanel" aria-label="Access Block Wait Distribution">
            <div class="radarHeader" style="border-radius: var(--r2); margin-bottom: 8px;">
              <div class="radarTitleCluster">
                <h3 class="radarTitle">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  Emergency Department Stay Distribution &amp; Access Block
                </h3>
                <span class="worklistCountBadge"><span class="mono">70</span> patients binned by clinical targets</span>
              </div>

              <div class="radarLegend">
                <div class="legendItem"><span class="legendDot yours"></span> Yours (12)</div>
                <div class="legendItem"><span class="legendDot wards"></span> Wards (48)</div>
                <div class="legendItem"><span class="legendDot transport"></span> Transport (10)</div>
              </div>
            </div>

            <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); padding: 16px 20px;">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; height: 210px; align-items: end; border-bottom: 2px solid var(--line-strong); padding-bottom: 8px;">
                <!-- Column 1: <4h -->
                <div style="display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: end; cursor: pointer;">
                  <span class="mono" style="font-size: 13px; font-weight: 700; margin-bottom: 4px; color: var(--ink);">26</span>
                  <div style="width: 100%; max-width: 90px; height: 60%; border-radius: 4px 4px 0 0; overflow: hidden; display: flex; flex-direction: column; justify-content: end; box-shadow: var(--lift);">
                    <div style="background: var(--accent); height: 25%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;" title="Yours: 6">6</div>
                    <div style="background: var(--muted); height: 55%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;" title="Wards: 14">14</div>
                    <div style="background: var(--stripe); height: 20%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;" title="Transport: 6">6</div>
                  </div>
                </div>

                <!-- Column 2: 4-8h -->
                <div style="display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: end; cursor: pointer; position: relative;">
                  <span style="position: absolute; top: 18px; background: var(--warn); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">1 Due Soon</span>
                  <span class="mono" style="font-size: 13px; font-weight: 700; margin-bottom: 4px; color: var(--ink);">16</span>
                  <div style="width: 100%; max-width: 90px; height: 38%; border-radius: 4px 4px 0 0; overflow: hidden; display: flex; flex-direction: column; justify-content: end; box-shadow: var(--lift);">
                    <div style="background: var(--accent); height: 25%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">4</div>
                    <div style="background: var(--muted); height: 55%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">9</div>
                    <div style="background: var(--stripe); height: 20%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">3</div>
                  </div>
                </div>

                <!-- Column 3: 8-24h -->
                <div style="display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: end; cursor: pointer; position: relative;">
                  <span style="position: absolute; top: 0px; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">1 Breached</span>
                  <span class="mono" style="font-size: 13px; font-weight: 700; margin-bottom: 4px; color: var(--danger-ink);">23</span>
                  <div style="width: 100%; max-width: 90px; height: 54%; border-radius: 4px 4px 0 0; overflow: hidden; display: flex; flex-direction: column; justify-content: end; box-shadow: var(--lift);">
                    <div style="background: var(--accent); height: 10%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">2</div>
                    <div style="background: var(--muted); height: 85%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">20</div>
                    <div style="background: var(--stripe); height: 5%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">1</div>
                  </div>
                </div>

                <!-- Column 4: >24h -->
                <div style="display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: end; cursor: pointer; position: relative;">
                  <span style="position: absolute; top: 38px; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">1 Breached</span>
                  <span class="mono" style="font-size: 13px; font-weight: 700; margin-bottom: 4px; color: var(--danger-ink);">5</span>
                  <div style="width: 100%; max-width: 90px; height: 15%; border-radius: 4px 4px 0 0; overflow: hidden; display: flex; flex-direction: column; justify-content: end; box-shadow: var(--lift);">
                    <div style="background: var(--muted); height: 100%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700;">5</div>
                  </div>
                </div>
              </div>

              <!-- Column Labels -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center; margin-top: 10px;">
                <div>
                  <strong style="display: block; font-size: 12px; color: var(--ink);">&lt; 4 Hours</strong>
                  <span style="font-size: 11px; color: var(--good-ink);">WEAT Target (26)</span>
                </div>
                <div>
                  <strong style="display: block; font-size: 12px; color: var(--ink);">4 – 8 Hours</strong>
                  <span style="font-size: 11px; color: var(--muted);">Standard Intake (16)</span>
                </div>
                <div>
                  <strong style="display: block; font-size: 12px; color: var(--danger-ink);">8 – 24 Hours</strong>
                  <span style="font-size: 11px; color: var(--warn-ink); font-weight: 600;">Severe Access Block (23)</span>
                </div>
                <div>
                  <strong style="display: block; font-size: 12px; color: var(--danger-ink);">&gt; 24 Hours</strong>
                  <span style="font-size: 11px; color: var(--danger); font-weight: 700;">Catastrophic (5)</span>
                </div>
              </div>
            </div>
          </section>
`;

// ─── OPTION 3 CONTENT ───
const option3Html = `
          <!-- ─── OPTION 3: 2×2 ACTION DECISION GRID ────────── -->
          <section class="runwayPanel" id="decisionMatrixPanel" aria-label="2x2 Action Decision Matrix">
            <div class="radarHeader" style="border-radius: var(--r2); margin-bottom: 10px;">
              <div class="radarTitleCluster">
                <h3 class="radarTitle">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  Priority Decision Matrix · 70 Waiting Patients
                </h3>
              </div>
              <span class="worklistCountBadge">4 Strategic Cohorts</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <!-- Quadrant 1: Critical Jeopardy -->
              <div style="background: var(--danger-soft); border: 2px solid var(--danger); border-radius: var(--r1); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--danger); padding-bottom: 6px; margin-bottom: 8px;">
                    <strong style="color: var(--danger-ink); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Critical Jeopardy · Past / Imminent Legal Time</strong>
                    <span class="mono" style="font-size: 18px; font-weight: 800; color: var(--danger);">2</span>
                  </div>
                  <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px;">Patients with lapsed or critically expiring detention orders in extended stay.</p>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="background: var(--surface); border: 1px solid var(--danger); border-radius: 4px; padding: 6px 10px; font-size: 11px; display: flex; justify-content: space-between;">
                      <span><strong>Jane Doe</strong> (FSH)</span>
                      <span class="mono" style="color: var(--danger); font-weight: 700;">Form 1A (-42m) · 26h wait</span>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--danger); border-radius: 4px; padding: 6px 10px; font-size: 11px; display: flex; justify-content: space-between;">
                      <span><strong>John Smith</strong> (SCGH)</span>
                      <span class="mono" style="color: var(--danger); font-weight: 700;">Form 3A (-15m) · 14h wait</span>
                    </div>
                  </div>
                </div>
                <div style="text-align: right; margin-top: 10px;">
                  <button type="button" style="background: var(--danger); color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">Filter Critical (2) →</button>
                </div>
              </div>

              <!-- Quadrant 2: Extended ED Access Block -->
              <div style="background: var(--surface-2); border: 1.5px solid var(--line-strong); border-radius: var(--r1); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-bottom: 8px;">
                    <strong style="color: var(--ink); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Extended Stay · ACEM Access Blocked (&gt;8h)</strong>
                    <span class="mono" style="font-size: 18px; font-weight: 800; color: var(--ink);">28</span>
                  </div>
                  <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px;">Legal authorities stable, but suffering protracted ED boarding waiting on inpatient bed turnaround.</p>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 6px 10px; text-align: center;">
                      <span style="font-size: 10px; color: var(--muted); display: block;">Over 24 Hours</span>
                      <strong class="mono" style="font-size: 14px; color: var(--danger);">5 patients</strong>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 6px 10px; text-align: center;">
                      <span style="font-size: 10px; color: var(--muted); display: block;">8 to 24 Hours</span>
                      <strong class="mono" style="font-size: 14px; color: var(--ink);">23 patients</strong>
                    </div>
                  </div>
                </div>
                <div style="text-align: right; margin-top: 10px;">
                  <button type="button" style="background: var(--accent); color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">Filter Access Blocked (28) →</button>
                </div>
              </div>

              <!-- Quadrant 3: Expiring Soon (<8h) -->
              <div style="background: var(--warn-soft); border: 1.5px solid var(--warn); border-radius: var(--r1); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-bottom: 8px;">
                    <strong style="color: var(--warn-ink); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Expiring Soon · Early Intake (&lt;8h)</strong>
                    <span class="mono" style="font-size: 18px; font-weight: 800; color: var(--warn);">1</span>
                  </div>
                  <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px;">Early department arrivals whose 72h referral deadline is approaching under 60 minutes.</p>
                  <div style="background: var(--surface); border: 1px solid var(--warn); border-radius: 4px; padding: 6px 10px; font-size: 11px; display: flex; justify-content: space-between;">
                    <span><strong>Alex Ray</strong> (RPH)</span>
                    <span class="mono" style="color: var(--warn); font-weight: 700;">Form 1A (+24m left) · 3.5h wait</span>
                  </div>
                </div>
                <div style="text-align: right; margin-top: 10px;">
                  <button type="button" style="background: var(--warn); color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">Filter Expiring (1) →</button>
                </div>
              </div>

              <!-- Quadrant 4: Standard Intake -->
              <div style="background: var(--surface-2); border: 1.5px solid var(--line); border-radius: var(--r1); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-bottom: 8px;">
                    <strong style="color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Standard Intake Flow (&lt;8h)</strong>
                    <span class="mono" style="font-size: 18px; font-weight: 800; color: var(--ink);">39</span>
                  </div>
                  <p style="font-size: 11px; color: var(--muted); margin: 0 0 8px;">Routine clinical intake and bed allocation progressing within normal operational tolerances.</p>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 6px 10px; text-align: center;">
                      <span style="font-size: 10px; color: var(--muted); display: block;">Yours Assigned</span>
                      <strong class="mono" style="font-size: 14px; color: var(--ink);">7 patients</strong>
                    </div>
                    <div style="background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 6px 10px; text-align: center;">
                      <span style="font-size: 10px; color: var(--muted); display: block;">Wards Reviewing</span>
                      <strong class="mono" style="font-size: 14px; color: var(--ink);">32 patients</strong>
                    </div>
                  </div>
                </div>
                <div style="text-align: right; margin-top: 10px;">
                  <button type="button" style="background: var(--surface); color: var(--ink); border: 1px solid var(--line-strong); padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">Filter Standard (39) →</button>
                </div>
              </div>
            </div>
          </section>
`;

// ─── OPTION 4 CONTENT ───
const option4Html = `
          <!-- ─── OPTION 4: CATCHMENT & HOSPITAL PRESSURE STRIP ────────── -->
          <section class="runwayPanel" id="catchmentPressurePanel" aria-label="Catchment Hospital Pressure">
            <div class="radarHeader" style="border-radius: var(--r2); margin-bottom: 8px;">
              <div class="radarTitleCluster">
                <h3 class="radarTitle">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
                    <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Statewide Delays by Health Service &amp; Emergency Department
                </h3>
                <span class="worklistCountBadge"><span class="mono">70</span> waiting across 4 services</span>
              </div>
              <span class="mono" style="font-size: 11px; color: var(--muted);">Click catchment to filter worklist</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <!-- South Metro -->
              <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); padding: 10px 14px; cursor: pointer;">
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                  <strong style="color: var(--ink);">South Metropolitan Health Service (FSH, Rockingham)</strong>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: var(--danger-soft); color: var(--danger); font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--danger);">1 Legal Breach</span>
                    <strong class="mono" style="font-size: 14px; color: var(--ink);">24 waiting</strong>
                  </div>
                </div>
                <div style="background: var(--line); height: 8px; border-radius: 4px; overflow: hidden; display: flex; margin-bottom: 4px;">
                  <div style="background: var(--danger); width: 8%;" title="1 Breached"></div>
                  <div style="background: var(--warn); width: 25%;" title="6 Access Blocked"></div>
                  <div style="background: var(--accent); width: 67%;" title="17 Routine"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);" class="mono">
                  <span>FSH ED: 18 · Rockingham ED: 6</span>
                  <span>2 &gt;24h · 7 8–24h · 15 &lt;8h</span>
                </div>
              </div>

              <!-- North Metro -->
              <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); padding: 10px 14px; cursor: pointer;">
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                  <strong style="color: var(--ink);">North Metropolitan Health Service (SCGH, Joondalup)</strong>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: var(--danger-soft); color: var(--danger); font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--danger);">1 Legal Breach</span>
                    <strong class="mono" style="font-size: 14px; color: var(--ink);">18 waiting</strong>
                  </div>
                </div>
                <div style="background: var(--line); height: 8px; border-radius: 4px; overflow: hidden; display: flex; margin-bottom: 4px;">
                  <div style="background: var(--danger); width: 6%;"></div>
                  <div style="background: var(--warn); width: 33%;"></div>
                  <div style="background: var(--accent); width: 61%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);" class="mono">
                  <span>SCGH ED: 12 · Joondalup ED: 6</span>
                  <span>1 &gt;24h · 6 8–24h · 11 &lt;8h</span>
                </div>
              </div>

              <!-- East Metro -->
              <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); padding: 10px 14px; cursor: pointer;">
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                  <strong style="color: var(--ink);">East Metropolitan Health Service (RPH, Midland)</strong>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: var(--warn-soft); color: var(--warn); font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--warn);">1 Imminent (&lt;60m)</span>
                    <strong class="mono" style="font-size: 14px; color: var(--ink);">16 waiting</strong>
                  </div>
                </div>
                <div style="background: var(--line); height: 8px; border-radius: 4px; overflow: hidden; display: flex; margin-bottom: 4px;">
                  <div style="background: var(--warn); width: 38%;"></div>
                  <div style="background: var(--accent); width: 62%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);" class="mono">
                  <span>RPH ED: 11 · Midland ED: 5</span>
                  <span>2 &gt;24h · 5 8–24h · 9 &lt;8h</span>
                </div>
              </div>

              <!-- WACHS -->
              <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--r2); padding: 10px 14px; cursor: pointer;">
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                  <strong style="color: var(--ink);">WA Country Health Service (Bunbury, Albany, Kalgoorlie)</strong>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: var(--good-soft); color: var(--good); font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--good);">All Authorities Valid</span>
                    <strong class="mono" style="font-size: 14px; color: var(--ink);">12 waiting</strong>
                  </div>
                </div>
                <div style="background: var(--line); height: 8px; border-radius: 4px; overflow: hidden; display: flex; margin-bottom: 4px;">
                  <div style="background: var(--accent); width: 100%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);" class="mono">
                  <span>Country regional transfers awaiting metro bed</span>
                  <span>0 &gt;24h · 5 8–24h · 7 &lt;8h</span>
                </div>
              </div>
            </div>
          </section>
`;

function insertStyleAndBody(content, activeOption) {
  // Inject additional styles before </style>
  const styleMarker = '</style>';
  const styleIdx = beforePart.indexOf(styleMarker);
  const styledBefore = beforePart.slice(0, styleIdx) + additionalStyles + beforePart.slice(styleIdx);

  // Inject top navigation right after <body>
  const bodyMarker = '<body>';
  const bodyIdx = styledBefore.indexOf(bodyMarker);
  const navHtml = buildNavigationNav(activeOption);
  const navigatedBefore = styledBefore.slice(0, bodyIdx + bodyMarker.length) + "\n" + navHtml + styledBefore.slice(bodyIdx + bodyMarker.length);

  return navigatedBefore + content + afterPart;
}

const mockups = [
  { id: 1, file: "delays-mockup-runway.html", content: option1Html },
  { id: 2, file: "delays-mockup-histogram.html", content: option2Html },
  { id: 3, file: "delays-mockup-matrix.html", content: option3Html },
  { id: 4, file: "delays-mockup-catchment.html", content: option4Html },
];

for (const m of mockups) {
  const fullHtml = insertStyleAndBody(m.content, m.id);
  fs.writeFileSync(path.resolve("public", m.file), fullHtml, "utf-8");
  fs.writeFileSync(path.resolve("docs/ward-flow/mockups", m.file), fullHtml, "utf-8");
  console.log(`Generated: public/${m.file} and docs/ward-flow/mockups/${m.file}`);
}
