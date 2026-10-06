"use client";

import type { ReactNode } from "react";

import { Chevron, DateTile, Foot, Icon, Ring } from "./ui";
import { useWork } from "./context";

const WEEK = [
  ["MON", "5", "L"],
  ["TUE", "6", "OC"],
  ["WED", "7", "D"],
  ["THU", "8", "D"],
  ["FRI", "9", "L"],
  ["SAT", "10", "AL"],
  ["SUN", "11", ""],
] as const;

const OCTOBER: Record<number, string> = {
  1: "D",
  2: "D",
  5: "L",
  6: "OC",
  7: "D",
  8: "D",
  9: "L",
  10: "AL",
  12: "D",
  13: "D",
  14: "OC",
  15: "D",
  16: "N",
  17: "N",
  20: "D",
  21: "D",
  22: "L",
  23: "L",
  26: "D",
  27: "OC",
  28: "D",
  29: "D",
  30: "D",
};
const DUE = new Set([6, 9, 14, 18, 31]);

const STARRED = [
  ["n", "book", "MDD criteria", "DSM"],
  ["n", "pill", "Clozapine", "Medicines"],
  ["n", "doc", "Form 1A", "MHA"],
  ["call", "phone", "Main line", "On Call"],
  ["admin", "shield", "Renewals", "Admin"],
  ["teach", "board", "Presenting", "Teaching"],
  ["cpd", "award", "CPD log", "CPD"],
  ["rost", "cal", "My shifts", "Roster"],
] as const;

function WeekStrip({ on }: { on: number }) {
  return (
    <div className="wk num">
      {WEEK.map((day, index) => (
        <div key={day[0]} className={index === on ? "wd on" : "wd"}>
          {day[0]}
          <b>{day[1]}</b>
          <i className={day[2] ? `s${day[2]}` : undefined} />
        </div>
      ))}
    </div>
  );
}

function HeroToday() {
  const { dispatch } = useWork();
  return (
    <div className="hero">
      <div className="hrow">
        <Ring value="13 h" caption="to start" fraction={0.47} />
        <div>
          <div className="k">On call tonight</div>
          <h3 className="num">Starts in 13 h 20 min</h3>
          <p className="num">Tue 21:00 to Wed 08:00</p>
        </div>
      </div>
      <div className="track">
        <span className="blk num" style={{ left: "57.7%", width: "42.3%" }}>
          On call 11 h
        </span>
        <span className="now" style={{ left: "6.4%" }} />
      </div>
      <div className="day-tks num">
        <span className="s n" style={{ left: "0%" }}>
          Now 07:40
        </span>
        <span style={{ left: "23.1%" }}>12:00</span>
        <span style={{ left: "46.2%" }}>18:00</span>
        <span style={{ left: "57.7%" }}>21:00</span>
        <span className="e" style={{ left: "100%" }}>
          Wed 08:00
        </span>
      </div>
      <div className="hpanel day-hp">
        <div className="k">Next up · Wed 08:00 to 08:45</div>
        <div className="day-hpr">
          <div>
            <b>Catatonia, you present</b>
            <small>Seminar room 3 or Teams</small>
          </div>
          <button
            type="button"
            className="day-hb"
            onClick={() =>
              dispatch({ type: "toast", message: "Catatonia, seminar room 3 or Teams. The quiz is still to do." })
            }
          >
            Details
          </button>
        </div>
        <div className="day-clash">
          <Icon id="alert" />
          Starts as on call ends. Quiz not done.
        </div>
      </div>
    </div>
  );
}

function NeedRow({
  tone,
  icon,
  title,
  detail,
  action,
  onAction,
}: {
  tone: string;
  icon: string;
  title: string;
  detail: React.ReactNode;
  action: string | null;
  onAction?: () => void;
}) {
  return (
    <div className="row day-ny">
      <span className={`ic ${tone}`}>
        <Icon id={icon} />
      </span>
      <div className="tx">
        <b>{title}</b>
        <small>{detail}</small>
      </div>
      {action ? (
        <div className="day-act">
          <button type="button" className="btn t" onClick={onAction}>
            {action}
          </button>
          <button type="button" className="day-later" onClick={onAction}>
            Later
          </button>
        </div>
      ) : (
        <Chevron />
      )}
    </div>
  );
}

export function DayBody() {
  const { state, dispatch } = useWork();
  if (state.view === "needs") return <NeedsYou />;
  if (state.tab === 1) return state.weekAsMonth ? <MonthBody /> : <WeekBody />;
  if (state.tab === 2) return <HoursBody />;
  return <TodayBody />;
}

function TodayBody() {
  const { state, dispatch } = useWork();
  return (
    <div className="body">
      <HeroToday />
      <div className="day-warn">
        <span className="ic r">
          <Icon id="shield" />
        </span>
        <div className="tx">
          <b>Basic life support has lapsed</b>
          <small>Date passed 23 Sep, 13 days ago</small>
        </div>
        <button type="button" className="btn am" onClick={() => dispatch({ type: "mode", mode: "admin" })}>
          Book
        </button>
      </div>
      <div className="qa">
        <button
          type="button"
          className="q tile"
          onClick={() => dispatch({ type: "toast", message: "Call notes stay on this phone until you save them." })}
        >
          <span className="ic call">
            <Icon id="phone" />
          </span>
          <b>Log a call</b>
        </button>
        <button type="button" className="q tile" onClick={() => dispatch({ type: "mode", mode: "cpd" })}>
          <span className="ic cpd">
            <Icon id="award" />
          </span>
          <b>Log CPD</b>
        </button>
        <button type="button" className="q tile" onClick={() => dispatch({ type: "mode", mode: "rost", tab: 1 })}>
          <span className="ic rost">
            <Icon id="users" />
          </span>
          <b>Who&apos;s on</b>
        </button>
        <button type="button" className="q tile" onClick={() => dispatch({ type: "mode", mode: "rost" })}>
          <span className="ic rost">
            <Icon id="cal" />
          </span>
          <b>Roster</b>
        </button>
      </div>
      <div className="lbl">
        Needs you
        <button type="button" onClick={() => dispatch({ type: "view", view: "needs" })}>
          All 8
        </button>
      </div>
      <div className="card">
        <NeedRow
          tone="rost"
          icon="swap"
          title="Swap from Dr Moss"
          detail="Thu 8 Day for Sun 11 Late · by 17:00"
          action="Answer"
          onAction={() => dispatch({ type: "overlay", overlay: "swap" })}
        />
        <NeedRow
          tone="admin"
          icon="pen"
          title="Sign leave form"
          detail="Today · Admin"
          action={state.leaveSigned ? "Signed" : "Sign"}
          onAction={() => dispatch({ type: "signLeave" })}
        />
        <NeedRow
          tone="teach"
          icon="board"
          title="Catatonia, finish prep"
          detail="Quiz and de-identification · Wed 08:00"
          action="Prep"
          onAction={() => dispatch({ type: "mode", mode: "teach" })}
        />
      </div>
      <div className="day-stamp">
        <i />
        Checked 07:40 · On Call, Roster, CPD, Teaching, Admin
      </div>
      <div className="lbl">
        Starred{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "toast", message: "Nine starred items. Each opens the page that owns it." })}
        >
          All 9
        </button>
      </div>
      <div className="card day-shelf">
        {STARRED.map((item) => (
          <button
            type="button"
            key={item[2]}
            onClick={() => dispatch({ type: "toast", message: `${item[2]} is a sample shortcut.` })}
          >
            <span className={`ic ${item[0]}`}>
              <Icon id={item[1]} />
            </span>
            <b>
              {item[2]}
              <small>{item[3]}</small>
            </b>
          </button>
        ))}
      </div>
      <div className="card pad">
        <div className="lbl">
          This week
          <span className="day-mseg">
            <button type="button" className="on" onClick={() => dispatch({ type: "tab", index: 1 })}>
              Week
            </button>
            <button type="button" onClick={() => dispatch({ type: "weekMonth", month: true })}>
              Month
            </button>
          </span>
        </div>
        <div style={{ marginTop: 9 }}>
          <WeekStrip on={1} />
        </div>
      </div>
      <div className="card">
        <div className="row call">
          <DateTile month="TUE" day="6" />
          <div className="tx">
            <b>On call tonight</b>
            <small>21:00 to Wed 08:00 · Roster</small>
          </div>
        </div>
        <div className="row teach">
          <DateTile month="WED" day="7" />
          <div className="tx">
            <b>Catatonia, you present</b>
            <small>08:00 · Seminar room 3 · Teaching</small>
          </div>
        </div>
        <div className="row rost">
          <DateTile month="SAT" day="10" />
          <div className="tx">
            <b>Annual leave</b>
            <small>Approved · Roster</small>
          </div>
          <span className="tag g">Leave</span>
        </div>
      </div>
      <div className="legend" style={{ padding: "0 4px" }}>
        <span>
          <i className="sD" />
          Day
        </span>
        <span>
          <i className="sL" />
          Late
        </span>
        <span>
          <i className="sOC" />
          On call
        </span>
        <span>
          <i className="sAL" />
          Leave
        </span>
        <button
          type="button"
          style={{ marginLeft: "auto", color: "var(--m)", fontWeight: 700 }}
          onClick={() => dispatch({ type: "tab", index: 1 })}
        >
          Open week
        </button>
      </div>
      <div className="card pad cpd">
        <div className="lbl">
          CPD this year
          <button type="button" onClick={() => dispatch({ type: "mode", mode: "cpd" })}>
            Open CPD
          </button>
        </div>
        <div className="day-big num">
          <b>
            32.5<small> of 50 h</small>
          </b>
          <span>65%</span>
        </div>
        <div className="meter" style={{ marginTop: 8, height: 8, gap: 2, background: "var(--wash)" }}>
          <i style={{ width: "32%", background: "var(--m)" }} />
          <i style={{ width: "13%", background: "var(--m2)", opacity: 0.75 }} />
          <i style={{ width: "20%", background: "#e3b98d" }} />
        </div>
        <div className="day-kvs">
          <div className="day-kv">
            <i style={{ background: "var(--m)" }} />
            <span>Educational</span>
            <b className="num">16 h</b>
            <em>met</em>
          </div>
          <div className="day-kv">
            <i style={{ background: "#c48650" }} />
            <span>Reviewing performance</span>
            <b className="num">6.5 h</b>
          </div>
          <div className="day-kv">
            <i style={{ background: "#e3b98d" }} />
            <span>Measuring outcomes</span>
            <b className="num">10 h</b>
          </div>
        </div>
        <Foot icon="cal">
          17.5 h to go by 31 Dec, about 1.5 h a week. Reviewing and outcomes are 8.5 h short of 25 h.
        </Foot>
      </div>
      <div className="card admin">
        <div className="pad" style={{ paddingBottom: 4 }}>
          <div className="lbl">
            Renewals, next 6 months
            <button type="button" onClick={() => dispatch({ type: "mode", mode: "admin", tab: 1 })}>
              Admin
            </button>
          </div>
          <div className="day-run num">
            <i className="day-now" style={{ left: "2.7%" }} />
            <i className="day-nx" style={{ left: "9.3%" }} />
            <i style={{ left: "16.5%" }} />
            <i style={{ left: "24.2%" }} />
            <span style={{ left: "0" }}>Oct</span>
            <span style={{ left: "16.9%" }}>Nov</span>
            <span style={{ left: "33.3%" }}>Dec</span>
            <span style={{ left: "50.3%" }}>Jan</span>
            <span style={{ left: "67.3%" }}>Feb</span>
            <span style={{ left: "83.4%" }}>Mar</span>
          </div>
        </div>
        <div className="row admin">
          <DateTile month="OCT" day="18" />
          <div className="tx">
            <b>Manual handling</b>
            <small>Expires in 12 days</small>
          </div>
          <button type="button" className="btn t" onClick={() => dispatch({ type: "mode", mode: "admin", tab: 1 })}>
            Renew
          </button>
        </div>
        <div className="row admin">
          <DateTile month="OCT" day="31" />
          <div className="tx">
            <b>Fire and evacuation</b>
            <small>In 25 days</small>
          </div>
        </div>
        <div className="row admin">
          <DateTile month="NOV" day="14" />
          <div className="tx">
            <b>Working with Children Check</b>
            <small>Renew by then · in 39 days</small>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="tile row"
        style={{ borderRadius: 14, width: "100%" }}
        onClick={() => dispatch({ type: "overlay", overlay: "customise" })}
      >
        <span className="ic">
          <Icon id="sliders" />
        </span>
        <div className="tx">
          <b>Customise My Day</b>
          <small>Show, hide or reorder cards</small>
        </div>
        <Chevron />
      </button>
    </div>
  );
}

function WeekBody() {
  const { dispatch } = useWork();
  return (
    <div className="body">
      <div className="seg">
        <button type="button" className="on">
          Week
        </button>
        <button type="button" onClick={() => dispatch({ type: "weekMonth", month: true })}>
          Month
        </button>
      </div>
      <WeekStrip on={1} />
      <div className="card day-ag">
        <div className="day-dd">
          <div className="day-dn num">
            <small>MON</small>
            <b>5</b>
          </div>
          <div className="day-its">
            <div className="day-it past">
              <span className="t num">13:00</span>
              <div>
                <b>Late shift</b>
                <small>
                  <i className="rost" />
                  Until 21:30 · Roster
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="day-dd td">
          <div className="day-dn num">
            <small>TUE</small>
            <b>6</b>
          </div>
          <div className="day-its">
            <div className="day-nowl num">07:42 now</div>
            <div className="day-it">
              <span className="t num">Today</span>
              <div>
                <b>Sign leave form</b>
                <small>
                  <i className="admin" />
                  Due today · Admin
                </small>
              </div>
            </div>
            <div className="day-it">
              <span className="t num">17:00</span>
              <div>
                <b>Answer swap from Dr Moss</b>
                <small>
                  <i className="rost" />
                  Due by 17:00 · Roster
                </small>
              </div>
            </div>
            <div className="day-it">
              <span className="t num">21:00</span>
              <div>
                <b>On call</b>
                <small>
                  <i className="call" />
                  Until Wed 08:00 · Example Hospital
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="day-dd">
          <div className="day-dn num">
            <small>WED</small>
            <b>7</b>
          </div>
          <div className="day-its">
            <div className="day-it">
              <span className="t num">08:00</span>
              <div>
                <b>Catatonia, you present</b>
                <small>
                  <i className="teach" />
                  Seminar room 3 or Teams · Teaching
                </small>
              </div>
            </div>
            <div className="day-wclash">
              <Icon id="alert" />
              Starts as on call ends
            </div>
            <div className="day-it">
              <span className="t num">08:00</span>
              <div>
                <b>Day shift</b>
                <small>
                  <i className="rost" />
                  Until 16:30 · Ward 4
                </small>
              </div>
            </div>
            <div className="day-it">
              <span className="t num">10:00</span>
              <div>
                <b>Mask fit test slot</b>
                <small>
                  <i className="admin" />
                  Offered, not booked · Admin
                </small>
              </div>
              <span className="tag n">Offer</span>
            </div>
          </div>
        </div>
        <div className="day-dd">
          <div className="day-dn num">
            <small>THU</small>
            <b>8</b>
          </div>
          <div className="day-its">
            <div className="day-it">
              <span className="t num">08:00</span>
              <div>
                <b>Day shift</b>
                <small>
                  <i className="rost" />
                  Until 16:30 · Dr Moss asks to swap
                </small>
              </div>
              <span className="tag a">Swap</span>
            </div>
          </div>
        </div>
        <div className="day-dd">
          <div className="day-dn num">
            <small>FRI</small>
            <b>9</b>
          </div>
          <div className="day-its">
            <div className="day-it">
              <span className="t num">Due</span>
              <div>
                <b>Supervisor report</b>
                <small>
                  <i className="admin" />
                  Admin
                </small>
              </div>
            </div>
            <div className="day-it">
              <span className="t num">13:00</span>
              <div>
                <b>Late shift</b>
                <small>
                  <i className="rost" />
                  Until 21:30 · Roster
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="day-dd">
          <div className="day-dn num">
            <small>SAT</small>
            <b>10</b>
          </div>
          <div className="day-its">
            <div className="day-it">
              <span className="t num">All day</span>
              <div>
                <b>Annual leave</b>
                <small>
                  <i className="rost" />
                  Approved · Roster
                </small>
              </div>
              <span className="tag g">Leave</span>
            </div>
          </div>
        </div>
        <div className="day-dd">
          <div className="day-dn num">
            <small>SUN</small>
            <b>11</b>
          </div>
          <div className="day-its">
            <div className="day-quiet">Nothing on</div>
          </div>
        </div>
      </div>
      <div className="card">
        <button
          type="button"
          className="row"
          style={{ width: "100%" }}
          onClick={() => dispatch({ type: "mode", mode: "rost" })}
        >
          <span className="ic rost">
            <Icon id="cal" />
          </span>
          <div className="tx">
            <b>All your shifts are in Roster</b>
            <small>Swaps, leave and your team</small>
          </div>
          <Chevron />
        </button>
      </div>
      <Foot icon="layers">From Roster, Teaching, CPD and Admin. Each item opens the page that owns it.</Foot>
    </div>
  );
}

function MonthBody() {
  const { dispatch } = useWork();
  const cells = Array.from({ length: 31 }, (_, index) => index + 1);
  return (
    <div className="body">
      <div className="seg">
        <button type="button" onClick={() => dispatch({ type: "weekMonth", month: false })}>
          Week
        </button>
        <button type="button" className="on">
          Month
        </button>
      </div>
      <div className="card pad">
        <div className="calh">
          <b>October 2026</b>
          <span>
            <i>
              <Icon id="chevl" />
            </i>
            <i>
              <Icon id="chevr" />
            </i>
          </span>
        </div>
        <div className="cal num">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
            <div key={day} className="dh">
              {day}
            </div>
          ))}
          <div />
          <div />
          <div />
          {cells.map((day) => {
            const weekday = (day + 2) % 7;
            const code = OCTOBER[day];
            return (
              <div
                key={day}
                className={`cd${weekday > 4 ? " we" : ""}${day === 6 ? " today" : ""}${day === 9 ? " day-sel" : ""}`}
              >
                <b>{day}</b>
                <i className={code ? `s${code}` : undefined} />
                {DUE.has(day) ? <i className="day-cdot" /> : null}
              </div>
            );
          })}
        </div>
        <div className="legend" style={{ marginTop: 10 }}>
          <span>
            <i className="sD" />
            Day
          </span>
          <span>
            <i className="sL" />
            Late
          </span>
          <span>
            <i className="sN" />
            Night
          </span>
          <span>
            <i className="sOC" />
            On call
          </span>
          <span>
            <i className="sAL" />
            Leave
          </span>
          <span>
            <i style={{ background: "var(--ink4)" }} />
            Due
          </span>
        </div>
      </div>
      <div className="lbl">Friday 9 October</div>
      <div className="card">
        <div className="row">
          <span className="ic rost">
            <Icon id="clock" />
          </span>
          <div className="tx">
            <b>Late shift</b>
            <small>13:00 to 21:30 · Ward 4</small>
          </div>
          <Chevron />
        </div>
        <div className="row">
          <span className="ic admin">
            <Icon id="doc" />
          </span>
          <div className="tx">
            <b>Supervisor report due</b>
            <small>Admin</small>
          </div>
          <button type="button" className="btn t" onClick={() => dispatch({ type: "mode", mode: "admin" })}>
            Open
          </button>
        </div>
      </div>
    </div>
  );
}

const HOURS = [
  [8.5, "L"],
  [11, "OC"],
  [8.5, "D"],
  [8.5, "D"],
  [8.5, "L"],
  [0, "AL"],
  [0, ""],
] as const;

function HoursBody() {
  const { dispatch } = useWork();
  return (
    <div className="body">
      <div className="seg">
        <button type="button" className="on">
          Week
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "toast", message: "Fortnight view is 92 rostered hours." })}
        >
          Fortnight
        </button>
      </div>
      <div className="card pad">
        <div className="lbl">
          5 to 11 October <em className="num">5 shifts</em>
        </div>
        <div className="day-big num">
          <b>
            50.5<small> h rostered</small>
          </b>
          <span>Fortnight 92 h</span>
        </div>
        <div className="chart" style={{ gridTemplateColumns: "repeat(7,1fr)", height: 76 }}>
          {HOURS.map((bar, index) => (
            <div className="c" key={index}>
              {bar[0] ? (
                <i className={`s${bar[1]}`} style={{ height: `${(bar[0] / 12) * 100}%`, borderRadius: 4 }} />
              ) : bar[1] === "AL" ? (
                <i className="sAL" style={{ height: "12%", borderRadius: 4, opacity: 0.5 }} />
              ) : (
                <i style={{ height: "6%", background: "var(--wash)", borderRadius: 4 }} />
              )}
            </div>
          ))}
          <span className="gl" style={{ bottom: `${(10.1 / 12) * 100}%` }} />
        </div>
        <div className="cx num" style={{ gridTemplateColumns: "repeat(7,1fr)" }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((letter, index) => (
            <span key={`${letter}${index}`}>{letter}</span>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 9 }}>
          <span>
            <i className="sD" />
            Day
          </span>
          <span>
            <i className="sL" />
            Late
          </span>
          <span>
            <i className="sOC" />
            On call
          </span>
          <span>
            <i className="sAL" />
            Leave
          </span>
          <span style={{ marginLeft: "auto" }}>Average 10.1 h a shift</span>
        </div>
      </div>
      <div className="card pad">
        <div className="lbl">
          Agreement limits, next 7 days{" "}
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "toast",
                message: "Limits in this sample follow the roster agreement. They are not a pay calculation.",
              })
            }
          >
            Rules
          </button>
        </div>
        <div style={{ marginTop: 4 }}>
          <div className="chk">
            <span className="ok">
              <Icon id="check" />
            </span>
            <span className="tx">Most hours in 7 days, 75 h</span>
            <em className="num">50.5 h</em>
          </div>
          <div className="chk">
            <span className="ok">
              <Icon id="check" />
            </span>
            <span className="tx">Days in a row before 48 h off, 12</span>
            <em className="num">5</em>
          </div>
          <div className="chk">
            <span className="ok">
              <Icon id="check" />
            </span>
            <span className="tx">Break between shifts, 10 h</span>
            <em className="num">Met</em>
          </div>
        </div>
        <Foot icon="doc">The agreement&apos;s limits, not a safety judgement.</Foot>
      </div>
      <div className="lbl">
        Leave{" "}
        <button
          type="button"
          onClick={() => dispatch({ type: "toast", message: "Leave requests are not sent until you confirm." })}
        >
          Request
        </button>
      </div>
      <div className="card pad stat">
        <div className="v num">
          <b>
            10<small> of 15 days left</small>
          </b>
          <span>Annual leave</span>
        </div>
        <div className="meter">
          <i style={{ width: "66.7%", background: "linear-gradient(90deg,var(--m2),var(--m))" }} />
        </div>
      </div>
      <div className="card">
        <div className="row rost">
          <DateTile month="OCT" day="10" />
          <div className="tx">
            <b>Annual leave</b>
            <small>Sat 10 Oct · 1 day</small>
          </div>
          <span className="tag g">Approved</span>
        </div>
        <div className="row rost">
          <DateTile month="NOV" day="9" />
          <div className="tx">
            <b>Professional development</b>
            <small>Mon 9 to Fri 13 Nov</small>
          </div>
          <span className="tag n">Planned</span>
        </div>
        <div className="row rost">
          <DateTile month="DEC" day="21" />
          <div className="tx">
            <b>Annual leave</b>
            <small>21 Dec to 4 Jan</small>
          </div>
          <span className="tag a">Waiting</span>
        </div>
      </div>
      <div className="lbl">Overtime</div>
      <div className="card">
        <div className="row">
          <span className="ic rost">
            <Icon id="clock" />
          </span>
          <div className="tx">
            <b>2 h claim</b>
            <small>Mon 28 Sep · late handover</small>
          </div>
          <span className="tag a">Pending</span>
        </div>
      </div>
      <div className="card">
        <button
          type="button"
          className="row"
          style={{ width: "100%" }}
          onClick={() => dispatch({ type: "mode", mode: "rost" })}
        >
          <span className="ic rost">
            <Icon id="grid" />
          </span>
          <div className="tx">
            <b>Open shifts</b>
            <small>Extra shifts you could pick up</small>
          </div>
          <Chevron />
        </button>
      </div>
      <Foot icon="cal">From your roster. On call from home and leave are not counted as worked hours.</Foot>
    </div>
  );
}

function NeedsYou() {
  const { state, dispatch } = useWork();
  return (
    <div className="body">
      <div className="chips day-chs">
        <span className="ch on num">All 8</span>
        <span className="ch num">Admin 5</span>
        <span className="ch">Roster</span>
        <span className="ch">Teaching</span>
        <span className="ch">CPD</span>
      </div>
      <div className="lbl">
        Overdue <em className="num">2</em>
      </div>
      <div className="card">
        <NeedRow
          tone="admin"
          icon="shield"
          title="Basic life support"
          detail={
            <>
              <span className="day-red">Lapsed Wed 23 Sep</span> · Admin
            </>
          }
          action="Book"
          onAction={() => dispatch({ type: "mode", mode: "admin" })}
        />
        <NeedRow
          tone="cpd"
          icon="award"
          title="Log journal club"
          detail={
            <>
              <span className="day-late">Attended 15 Sep, not logged</span> · CPD
            </>
          }
          action="Log"
          onAction={() => dispatch({ type: "mode", mode: "cpd", tab: 1 })}
        />
      </div>
      <div className="lbl">
        Today <em className="num">2</em>
      </div>
      <div className="card">
        <NeedRow
          tone="rost"
          icon="swap"
          title="Swap from Dr Moss"
          detail="Thu 8 Day for Sun 11 Late · by 17:00"
          action="Answer"
          onAction={() => dispatch({ type: "overlay", overlay: "swap" })}
        />
        <NeedRow
          tone="admin"
          icon="pen"
          title="Sign leave form"
          detail="Today · Admin"
          action={state.leaveSigned ? "Signed" : "Sign"}
          onAction={() => dispatch({ type: "signLeave" })}
        />
      </div>
      <div className="lbl">
        This week <em className="num">3</em>
      </div>
      <div className="card">
        <NeedRow
          tone="teach"
          icon="board"
          title="Catatonia, finish prep"
          detail="Quiz and de-identification · Wed 08:00"
          action="Prep"
          onAction={() => dispatch({ type: "mode", mode: "teach" })}
        />
        <NeedRow
          tone="admin"
          icon="doc"
          title="Supervisor report"
          detail="Due Fri 9 Oct · Admin"
          action="Open"
          onAction={() => dispatch({ type: "mode", mode: "assess" })}
        />
        <NeedRow
          tone="admin"
          icon="shield"
          title="Book mask fit test"
          detail="By Wed 14 Oct · slot Wed 10:00 offered"
          action="Book"
          onAction={() => dispatch({ type: "mode", mode: "admin", tab: 1 })}
        />
      </div>
      <div className="lbl">
        Later <em className="num">1</em>
      </div>
      <div className="card">
        <NeedRow
          tone="admin"
          icon="shield"
          title="Manual handling"
          detail="Expires Sun 18 Oct · in 12 days"
          action="Renew"
          onAction={() => dispatch({ type: "mode", mode: "admin", tab: 1 })}
        />
      </div>
      <div className="day-stamp">
        <i />
        Checked 07:45 · all 5 areas loaded
      </div>
      <Foot icon="history">
        Later hides an item until tomorrow. Swipe left for Done. Each item opens the page that owns it.
      </Foot>
    </div>
  );
}

export function QuickAddSheet() {
  const { dispatch } = useWork();
  const tiles = [
    ["bell", "", "Remind me"],
    ["phone", "call", "Log a call"],
    ["award", "cpd", "Log CPD"],
    ["leave", "rost", "Request leave"],
    ["swap", "rost", "Swap a shift"],
    ["shield", "admin", "Renewal date"],
  ] as const;
  return (
    <>
      <div className="sgrp">
        <div className="rq">
          {tiles.map((tile, index) => (
            <button
              type="button"
              key={tile[2]}
              className={index === 0 ? "tile on" : "tile"}
              onClick={() => {
                if (tile[2] === "Log CPD") dispatch({ type: "mode", mode: "cpd" });
                else if (tile[2] === "Swap a shift") dispatch({ type: "mode", mode: "rost", tab: 2 });
                else if (tile[2] === "Renewal date") dispatch({ type: "mode", mode: "admin", tab: 1 });
                else dispatch({ type: "toast", message: `${tile[2]} stays on this phone until you save it.` });
              }}
            >
              <span className={`ic ${tile[1]}`.trim()}>
                <Icon id={tile[0]} />
              </span>
              {tile[2]}
            </button>
          ))}
        </div>
      </div>
      <div className="sgrp">
        <div className="lbl">Suggested</div>
        <div className="card">
          <div className="row">
            <span className="ic cpd">
              <Icon id="award" />
            </span>
            <div className="tx">
              <b>Log journal club, 15 Sep</b>
              <small>1 h educational · from Teaching</small>
            </div>
            <button type="button" className="btn t" onClick={() => dispatch({ type: "mode", mode: "cpd", tab: 1 })}>
              Log
            </button>
          </div>
        </div>
      </div>
      <button type="button" className="btn p w" onClick={() => dispatch({ type: "close" })}>
        Continue
      </button>
    </>
  );
}

export function CustomiseSheet() {
  const rows = [
    ["Up next", "Shift countdown and next talk", true],
    ["Most important now", "One overdue item", true],
    ["Quick actions", "", true],
    ["Needs you", "So nothing is missed", "always"],
    ["Starred", "First eight", true],
    ["This week", "Week and Month", true],
    ["CPD this year", "", true],
    ["Renewals", "Next 6 months", false],
  ] as const;
  return (
    <>
      <div className="sgrp">
        <div className="lbl">Today, top to bottom</div>
        <div className="card">
          {rows.map((row) => (
            <div className="tg" key={row[0]}>
              <span className="day-grip">
                <Icon id="menu" />
              </span>
              <div className="tx">
                <b>{row[0]}</b>
                {row[1] ? <small>{row[1]}</small> : null}
              </div>
              {row[2] === "always" ? (
                <span className="tag n">Always on</span>
              ) : (
                <span className={row[2] ? "sw on" : "sw"} />
              )}
            </div>
          ))}
        </div>
      </div>
      <Foot icon="sliders">Drag to reorder. Hidden cards wait here.</Foot>
    </>
  );
}
