"use client";

import { Chevron, DateTile, Icon } from "./ui";
import { useWork } from "./context";

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

const TEAM = [
  ["You", ["L", "OC", "D", "D", "L", "AL", "x"], true],
  ["Moss", ["D", "D", "L", "x", "D", "x", "L"], false],
  ["Grant", ["D", "L", "D", "OC", "x", "D", "x"], false],
  ["Lowe", ["OC", "D", "x", "L", "D", "x", "D"], false],
  ["Patel", ["D", "D", "D", "D", "D", "x", "x"], false],
  ["Nguyen", ["N", "N", "x", "x", "D", "D", "OC"], false],
  ["Chen", ["AL", "AL", "AL", "AL", "AL", "x", "x"], false],
] as const;

function Code({ code, extra }: { code: string; extra?: string }) {
  if (!code) return <i className="rost-k e" />;
  return <i className={`rost-k c-${code}${extra ? ` ${extra}` : ""}`}>{code}</i>;
}

function Check({ children, value }: { children: string; value?: string }) {
  return (
    <div className="chk">
      <span className="ok">
        <Icon id="check" />
      </span>
      <span className="tx">{children}</span>
      {value ? <em className="num">{value}</em> : null}
    </div>
  );
}

export function RosterBody() {
  const { state } = useWork();
  if (state.tab === 1) return <TeamBody />;
  if (state.tab === 2) return <SwapsBody />;
  return <MonthBody />;
}

function MonthBody() {
  const { state, dispatch } = useWork();
  return (
    <div className="body">
      <div className="card">
        <div className="row">
          <DateTile month="TUE" day="6" />
          <div className="tx">
            <b>On call tonight</b>
            <small className="num">21:00 to Wed 08:00 · from home</small>
          </div>
          <span className="tag m num">In 13 h</span>
        </div>
        <div className="row">
          <span className="ic am">
            <Icon id="alert" />
          </span>
          <div className="tx">
            <b>No break before Wed Day</b>
            <small className="num">On call ends 08:00, Day starts 08:00</small>
          </div>
          <Chevron />
        </div>
      </div>
      {state.swapAccepted ? null : (
        <div className="card">
          <div className="row">
            <span className="av">NM</span>
            <div className="tx">
              <b>Swap from Dr Moss</b>
              <small>Your Thu 8 Day for her Sun 11 Late</small>
            </div>
            <button type="button" className="btn t" onClick={() => dispatch({ type: "overlay", overlay: "swap" })}>
              Answer
            </button>
          </div>
          <div className="rost-sub num" style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 0 }}>
            <Icon id="clock" />
            Answer by 17:00 today
          </div>
        </div>
      )}
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
        <div className="rost-mc">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span className="dh" key={`${day}${index}`}>
              {day}
            </span>
          ))}
          <span />
          <span />
          <span />
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
            const weekend = (day + 2) % 7 > 4;
            const code = OCTOBER[day] ?? "";
            const extra = day === 8 ? "pd" : day === 11 ? "gh" : undefined;
            const shown = day === 11 ? "L" : code;
            return (
              <div key={day} className={`d${weekend ? " we" : ""}${day === 6 ? " td" : ""}${day < 6 ? " ps" : ""}`}>
                <b className="num">{day}</b>
                <Code code={shown} extra={extra} />
              </div>
            );
          })}
        </div>
        <div className="rost-lg">
          <span>
            <Code code="D" />
            Day
          </span>
          <span>
            <Code code="L" />
            Late
          </span>
          <span>
            <Code code="N" />
            Night
          </span>
          <span>
            <Code code="OC" />
            On call
          </span>
          <span>
            <Code code="AL" />
            Leave
          </span>
          <span>
            <Code code="L" extra="gh" />
            Swap asked
          </span>
        </div>
      </div>
      <div className="lbl">Coming up</div>
      <div className="card">
        <div className="row rost">
          <DateTile month="FRI" day="16" />
          <div className="tx">
            <b>Nights · 2 in a row</b>
            <small>Fri 16 and Sat 17 · 21:00 to 08:30</small>
          </div>
          <Code code="N" />
        </div>
        <div className="row rost">
          <DateTile month="SAT" day="10" />
          <div className="tx">
            <b>Annual leave</b>
            <small>1 day · approved</small>
          </div>
          <span className="tag g">Approved</span>
        </div>
        <div className="row rost">
          <DateTile month="NOV" day="9" />
          <div className="tx">
            <b>Professional development</b>
            <small>Mon 9 to Fri 13 Nov · 5 days</small>
          </div>
          <span className="tag n">Planned</span>
        </div>
      </div>
      <div className="card tot num" style={{ gridTemplateColumns: "repeat(4,1fr)", padding: "10px 4px" }}>
        <div>
          <small>Day</small>
          <b>13</b>
        </div>
        <div>
          <small>Late</small>
          <b>4</b>
        </div>
        <div>
          <small>Night</small>
          <b>2</b>
        </div>
        <div>
          <small>On call</small>
          <b>3</b>
        </div>
      </div>
      <div className="rost-note" style={{ textAlign: "center" }}>
        Your copy of the roster. Check official changes with your service.
      </div>
    </div>
  );
}

function TeamBody() {
  const { dispatch } = useWork();
  return (
    <div className="body">
      <div className="lbl">
        On now<em className="num">Tue 6 · day</em>
      </div>
      <div className="card">
        {[
          ["NM", "Dr Moss", "Day · until 16:30", ""],
          ["AL", "Dr Lowe", "Day · until 16:30", ""],
          ["TN", "Dr Nguyen", "Night registrar · finishing 08:30", "#e0912a"],
        ].map((person) => (
          <div className="row" key={person[0]}>
            <span className="av pr" style={person[3] ? { ["--pres" as string]: person[3] } : undefined}>
              {person[0]}
            </span>
            <div className="tx">
              <b>{person[1]}</b>
              <small className="num">{person[2]}</small>
            </div>
            <button
              type="button"
              className="ic call"
              aria-label={`Call ${person[1]}`}
              onClick={() =>
                dispatch({ type: "toast", message: "Numbers stay in On Call. Nothing is dialled from here." })
              }
            >
              <Icon id="phone" />
            </button>
          </div>
        ))}
      </div>
      <div className="lbl">On with you tonight</div>
      <div className="card">
        <div className="row">
          <span className="av">TN</span>
          <div className="tx">
            <b>Dr Nguyen</b>
            <small className="num">Night registrar · 21:00 to 08:30</small>
          </div>
          <Code code="N" />
        </div>
      </div>
      <div className="card">
        <div className="row">
          <span className="ic">
            <Icon id="bell" />
          </span>
          <div className="tx">
            <b>New roster for 12 to 25 Oct</b>
            <small>Published Sat 3 Oct · 2 shifts changed</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() =>
              dispatch({ type: "toast", message: "Two sample shifts changed. Check them with your service." })
            }
          >
            See
          </button>
        </div>
      </div>
      <div className="card pad">
        <div className="calh">
          <b className="num">Week · 5 to 11 Oct</b>
          <span>
            <i>
              <Icon id="chevl" />
            </i>
            <i>
              <Icon id="chevr" />
            </i>
          </span>
        </div>
        <div className="seg" style={{ marginBottom: 11 }}>
          <button type="button" className="on">
            Everyone
          </button>
          <button type="button">Just me</button>
          <button type="button">With me</button>
        </div>
        <div className="rota num">
          <span />
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={`${day}${index}`} className={index === 1 ? "hd on" : "hd"}>
              {day}
            </span>
          ))}
          {TEAM.map((row) => (
            <span key={row[0]} style={{ display: "contents" }}>
              <span className={row[2] ? "nm me" : "nm"}>{row[0]}</span>
              {row[1].map((code, index) => (
                <span key={`${row[0]}${index}`} className={`sc c-${code}${row[2] && code !== "x" ? " mer" : ""}`}>
                  {code === "x" ? "·" : code}
                </span>
              ))}
            </span>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 11, justifyContent: "center" }}>
          <span>D Day</span>
          <span>L Late</span>
          <span>N Night</span>
          <span>OC On call</span>
          <span>AL Leave</span>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <span className="ic am">
            <Icon id="alert" />
          </span>
          <div className="tx">
            <b>Sat 10 late not covered</b>
            <small>Nobody free on the team</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() => dispatch({ type: "toast", message: "Posting a shift is not sent until you confirm." })}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

function Give({
  day,
  date,
  title,
  detail,
  code,
}: {
  day: string;
  date: string;
  title: string;
  detail: string;
  code: string;
}) {
  return (
    <div className="give">
      <DateTile month={day} day={date} />
      <div className="tx">
        <b>{title}</b>
        <small className="num">{detail}</small>
      </div>
      <Code code={code} />
    </div>
  );
}

export function SwapPair() {
  return (
    <div className="rost-pair">
      <Give day="THU" date="8" title="You give · Day" detail="08:00 to 16:30" code="D" />
      <span className="swapic">
        <Icon id="swap" />
      </span>
      <Give day="SUN" date="11" title="You get · Late" detail="13:00 to 21:30" code="L" />
    </div>
  );
}

function SwapsBody() {
  const { state, dispatch } = useWork();
  return (
    <div className="body">
      {state.swapAccepted ? (
        <div className="card">
          <div className="empty">
            <span className="badge">
              <Icon id="check" />
            </span>
            <b>Nothing needs you</b>
            <p>You have answered every swap.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="lbl">
            Waiting on you<em className="num">Due today 17:00</em>
          </div>
          <div className="card">
            <div className="row">
              <span className="av">NM</span>
              <div className="tx">
                <b>Dr Moss asks to swap</b>
                <small>Asked yesterday at 19:20</small>
              </div>
              <span className="tag a num">By 17:00</span>
            </div>
            <SwapPair />
            <div style={{ padding: "0 12px 4px" }}>
              <Check value="39 h">Rest before Sun late</Check>
              <Check value="50.5 of 75 h">Any 7 days</Check>
              <Check>No leave clash</Check>
            </div>
            <div className="rost-btns">
              <button type="button" className="btn p" onClick={() => dispatch({ type: "acceptSwap" })}>
                Accept
              </button>
              <button
                type="button"
                className="btn s"
                onClick={() =>
                  dispatch({ type: "toast", message: "Declined. Dr Moss is told only after you confirm." })
                }
              >
                Decline
              </button>
            </div>
          </div>
          <div className="rost-note">Your roster changes only when you both agree and Dr Grant approves.</div>
        </>
      )}
      <div className="lbl">
        You sent<button type="button">History</button>
      </div>
      <div className="card">
        {state.swapAccepted ? (
          <div className="row" style={{ flexWrap: "wrap" }}>
            <span className="ic">
              <Icon id="swap" />
            </span>
            <div className="tx">
              <b>Swap Thu 8 with Dr Moss</b>
              <small>You both agreed · Dr Grant approves</small>
            </div>
          </div>
        ) : null}
        <div className="row">
          <span className="ic">
            <Icon id="send" />
          </span>
          <div className="tx">
            <b>Give away Thu 29 Day</b>
            <small>Offered to team · nobody yet</small>
          </div>
          <button
            type="button"
            className="btn s"
            onClick={() => dispatch({ type: "toast", message: "Withdrawn from the team. Nothing else was sent." })}
          >
            Withdraw
          </button>
        </div>
      </div>
      <div className="lbl">
        Open shifts you can take<button type="button">Browse all 9</button>
      </div>
      <div className="card">
        <div className="row rost">
          <DateTile month="SUN" day="25" />
          <div className="tx">
            <b>ED liaison · Example Hospital</b>
            <small>08:00 to 16:30 · no flags</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() => dispatch({ type: "toast", message: "Taking a shift is not sent until you confirm." })}
          >
            Take
          </button>
        </div>
        <div className="row rost">
          <DateTile month="SUN" day="25" />
          <div className="tx">
            <b>Ward 6 · Northgate</b>
            <small>14:00 to 22:30 · rest flag</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() => dispatch({ type: "toast", message: "This shift has a rest flag. Nothing is sent yet." })}
          >
            Take
          </button>
        </div>
      </div>
    </div>
  );
}

export function SwapSheet() {
  const { dispatch } = useWork();
  return (
    <>
      <div className="sgrp">
        <SwapPair />
      </div>
      <div className="sgrp">
        <div className="lbl">Checked against your agreement</div>
        <div className="card" style={{ padding: "2px 12px" }}>
          <Check value="39 h">Rest before Sun late</Check>
          <Check value="50.5 of 75 h">Any 7 days</Check>
          <Check value="7">Days in a row</Check>
          <Check>No leave clash</Check>
        </div>
      </div>
      <div className="rost-btns" style={{ padding: 0 }}>
        <button type="button" className="btn p w" onClick={() => dispatch({ type: "acceptSwap" })}>
          Accept
        </button>
        <button type="button" className="btn s w" onClick={() => dispatch({ type: "close" })}>
          Decline
        </button>
      </div>
    </>
  );
}
