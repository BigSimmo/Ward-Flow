"use client";

import { DateTile, Icon, StatusBar } from "./ui";
import { useWork } from "./context";

const SUGGESTIONS = [
  ["When am I next on nights?", "nights"],
  ["What is due this month?", "due"],
  ["Am I working tomorrow?", "tomorrow"],
] as const;

export function SearchOverlay() {
  const { state, dispatch } = useWork();
  const query = state.searchQuery.trim();
  const lowered = query.toLowerCase();
  const answer =
    state.searchAnswer ??
    (lowered.includes("night")
      ? "nights"
      : lowered.includes("tomorrow")
        ? "tomorrow"
        : lowered.includes("due")
          ? "due"
          : null);

  return (
    <>
      <div className="srbg" />
      <div className="srp" role="dialog" aria-modal="true" aria-label="Search your work">
        <StatusBar time="07:40" />
        <div className="srtop">
          <div className="sf glass">
            <Icon id="search" />
            <input
              value={state.searchQuery}
              placeholder="Search shifts, leave, CPD"
              aria-label="Search shifts, leave and CPD"
              onChange={(event) => dispatch({ type: "search", query: event.target.value })}
            />
            {query ? (
              <button
                type="button"
                className="clr"
                aria-label="Clear search"
                onClick={() => dispatch({ type: "search", query: "" })}
              >
                <Icon id="x" />
              </button>
            ) : null}
          </div>
          <button type="button" className="cnc" onClick={() => dispatch({ type: "close" })}>
            Cancel
          </button>
        </div>
        <div className="achs">
          <span className="ach on">All</span>
          <span className="ach rost">
            <i />
            Roster
          </span>
          <span className="ach teach">
            <i />
            Teaching
          </span>
          <span className="ach admin">
            <i />
            Admin
          </span>
        </div>
        <div className="srb">
          {!query ? (
            <Idle onAsk={(text, answerId) => dispatch({ type: "answer", query: text, answer: answerId })} />
          ) : null}
          {answer === "nights" ? <Nights /> : null}
          {answer === "tomorrow" ? <Tomorrow /> : null}
          {answer === "due" ? <Due /> : null}
          {query && !answer ? (
            <div className="card">
              <div className="empty">
                <span className="badge">
                  <Icon id="search" />
                </span>
                <b>No records match</b>
                <p>Search looks at your roster, teaching, CPD and admin. Call notes are never searched.</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="srft">
          <Icon id="shield" />
          Your own records only. Never call notes or patient details.
        </div>
      </div>
    </>
  );
}

function Idle({ onAsk }: { onAsk: (query: string, answer: "nights" | "tomorrow" | "due") => void }) {
  return (
    <>
      <div className="lbl">Recent</div>
      <div className="card">
        <div className="row">
          <span className="ic n">
            <Icon id="history" />
          </span>
          <div className="tx">
            <b style={{ fontWeight: 600 }}>leave form</b>
          </div>
        </div>
        <div className="row">
          <span className="ic n">
            <Icon id="history" />
          </span>
          <div className="tx">
            <b style={{ fontWeight: 600 }}>bls</b>
          </div>
        </div>
      </div>
      <div className="lbl">Next up</div>
      <div className="card">
        <div className="row admin">
          <DateTile month="SEP" day="23" />
          <div className="tx">
            <b>Basic life support</b>
            <small>Lapsed Wed 23 Sep</small>
          </div>
          <span className="tag a">Overdue</span>
        </div>
        <div className="row rost">
          <DateTile month="TUE" day="6" />
          <div className="tx">
            <b>On call</b>
            <small>21:00 to 08:00 Wed · Ward 4</small>
          </div>
          <span className="tag m">Tonight</span>
        </div>
        <div className="row teach">
          <DateTile month="WED" day="7" />
          <div className="tx">
            <b>Catatonia</b>
            <small>08:00 · Seminar room 3 · you present</small>
          </div>
        </div>
      </div>
      <div className="lbl">Try asking</div>
      <div className="card">
        {SUGGESTIONS.map((item) => (
          <button
            type="button"
            className="row ask"
            key={item[0]}
            style={{ width: "100%" }}
            onClick={() => onAsk(item[0], item[1])}
          >
            <span className="ic">
              <Icon id="star" />
            </span>
            <div className="tx">
              <b>{item[0]}</b>
            </div>
            <Icon id="arrowr" className="chev2" />
          </button>
        ))}
      </div>
    </>
  );
}

function Nights() {
  return (
    <>
      <div className="hero rost">
        <div className="k">Your next night</div>
        <div className="ans2">
          <span className="dbig num">
            <small>OCT</small>6
          </span>
          <div>
            <h3>Tonight, Tuesday 6 October</h3>
            <p className="num">21:00 to 08:00 Wed · Ward 4</p>
            <p className="in num">On call overnight · in 13 h</p>
          </div>
        </div>
      </div>
      <div className="from rost">
        <Icon id="cal" />
        From your Roster
      </div>
      <div className="lbl">
        <span>Roster</span>
        <em>3 matches</em>
      </div>
      <div className="card">
        <div className="row rost">
          <DateTile month="WED" day="14" />
          <div className="tx">
            <b>On call</b>
            <small>21:00 to 08:00 Thu · Ward 4</small>
          </div>
        </div>
        <div className="row rost">
          <DateTile month="FRI" day="16" />
          <div className="tx">
            <b>Night shift</b>
            <small>21:00 to 08:30 Sat · Ward 4</small>
          </div>
        </div>
        <div className="row rost">
          <DateTile month="SAT" day="17" />
          <div className="tx">
            <b>Night shift</b>
            <small>21:00 to 08:30 Sun · Ward 4</small>
          </div>
        </div>
      </div>
    </>
  );
}

function Tomorrow() {
  return (
    <>
      <div className="hero rost">
        <div className="k">Tomorrow</div>
        <div className="ans2">
          <span className="dbig num">
            <small>OCT</small>7
          </span>
          <div>
            <h3>Wednesday 7 October</h3>
            <p className="num">08:00 to 16:30 · Day shift · Ward 4</p>
            <p className="in num">Yes, rostered</p>
          </div>
        </div>
        <div className="srch-also hpanel">
          <Icon id="moon" />
          After on call overnight, which ends 08:00
        </div>
      </div>
      <div className="from rost">
        <Icon id="cal" />
        From your Roster
      </div>
      <div className="lbl">Also tomorrow</div>
      <div className="card">
        <div className="row teach">
          <DateTile month="WED" day="7" />
          <div className="tx">
            <b>Catatonia</b>
            <small>08:00 to 08:45 · Seminar room 3 · you present</small>
          </div>
          <span className="tag m">Talk</span>
        </div>
      </div>
    </>
  );
}

function Due() {
  const rows = [
    ["SEP", "23", "Basic life support", "Lapsed Wed 23 Sep", "Overdue"],
    ["OCT", "6", "Sign leave form", "Today", "Today"],
    ["OCT", "9", "Supervisor report", "Fri 9 Oct", ""],
    ["OCT", "14", "Respirator mask fit test", "Book by Wed 14 Oct", ""],
    ["OCT", "18", "Manual handling", "Expires Sun 18 Oct", ""],
    ["OCT", "31", "Fire and evacuation", "Expires Sat 31 Oct", ""],
  ];
  return (
    <>
      <div className="lbl">
        Due this month <em>6</em>
      </div>
      <div className="card">
        {rows.map((row) => (
          <div className="row admin" key={row[2]}>
            <DateTile month={row[0]} day={row[1]} />
            <div className="tx">
              <b>{row[2]}</b>
              <small>{row[3]}</small>
            </div>
            {row[4] ? <span className={row[4] === "Overdue" ? "tag a" : "tag n"}>{row[4]}</span> : null}
          </div>
        ))}
      </div>
    </>
  );
}
