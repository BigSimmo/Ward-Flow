"use client";

import { Chevron, DateTile, Dock, Icon, MiniRing, Ring } from "./ui";
import { useWork } from "./context";

export function TeachBody() {
  const { state, dispatch } = useWork();
  if (state.tab === 1) return <TeachWeek />;
  if (state.tab === 2) return <TeachLogbook />;
  return (
    <div className="body">
      <div className="hero">
        <div className="hrow">
          <Ring value="4:45" caption="to start" fraction={0.3} />
          <div>
            <div className="k">Next up · today</div>
            <h3>Grand rounds</h3>
            <p className="num">12:30 to 13:30 · Lecture theatre</p>
          </div>
        </div>
        <div className="teach-hnote hpanel">
          <Icon id="clock" />
          Check-in opens 12:15 · also on Teams
        </div>
        <div className="hbtns">
          <button
            type="button"
            className="hw"
            onClick={() =>
              dispatch({
                type: "toast",
                message: "Teams opens only after you tap. This sample does not leave the phone.",
              })
            }
          >
            <Icon id="ext" />
            Join on Teams
          </button>
          <button
            type="button"
            className="hg"
            onClick={() => dispatch({ type: "toast", message: "Grand rounds, lecture theatre, Example Hospital." })}
          >
            Details
          </button>
        </div>
      </div>
      <div className="lbl">
        Needs you <em className="num">4</em>
      </div>
      <div className="card">
        <div className="row">
          <span className="ic">
            <Icon id="board" />
          </span>
          <div className="tx">
            <b>You present tomorrow</b>
            <small>Catatonia · 3 of 4 ready · patient check open</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() =>
              dispatch({ type: "toast", message: "Quiz still to do. Nothing is shared until you choose." })
            }
          >
            Prepare
          </button>
        </div>
        <div className="row">
          <span className="ic am">
            <Icon id="award" />
          </span>
          <div className="tx">
            <b>Journal club to log</b>
            <small>Attended Tue 15 Sep · overdue</small>
          </div>
          <button type="button" className="btn am" onClick={() => dispatch({ type: "mode", mode: "cpd", tab: 1 })}>
            Log
          </button>
        </div>
        <div className="row">
          <span className="ic">
            <Icon id="star5" />
          </span>
          <div className="tx">
            <b>Give feedback</b>
            <small>Case conference, Mon 5 Oct · taps only</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() => dispatch({ type: "toast", message: "Feedback stays private until you send it." })}
          >
            Give
          </button>
        </div>
        <div className="row">
          <span className="ic">
            <Icon id="history" />
          </span>
          <div className="tx">
            <b>Catch up</b>
            <small>Education meeting, Mon 5 Oct · recording</small>
          </div>
          <button
            type="button"
            className="btn t"
            onClick={() =>
              dispatch({ type: "toast", message: "The recording stays in Teaching. Nothing is downloaded." })
            }
          >
            Watch
          </button>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <span className="ic">
            <Icon id="cal" />
          </span>
          <div className="tx">
            <b>Rest of this week</b>
            <small>5 more sessions · next Wed 08:00</small>
          </div>
          <Chevron />
        </div>
        <div className="row">
          <span className="ic">
            <Icon id="grid" />
          </span>
          <div className="tx">
            <b>Open from other services</b>
            <small>3 sessions · Example Mental Health Service</small>
          </div>
          <Chevron />
        </div>
      </div>
      <div className="two">
        <div className="card pad">
          <div className="lbl">Attendance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
            <MiniRing value="8/10" fraction={0.8} />
            <div className="tx">
              <b>8 of 10</b>
              <small>This term</small>
            </div>
          </div>
        </div>
        <div className="card pad">
          <div className="lbl">Your feedback</div>
          <div style={{ marginTop: 7 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="big num" style={{ fontSize: 24 }}>
                4.6
              </span>
              <small style={{ color: "var(--ink3)", fontSize: 11.5, fontWeight: 600 }}>of 5</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeachWeek() {
  const { dispatch } = useWork();
  const rows: Array<[string, string, Array<[string, string, string, string?]>]> = [
    [
      "Monday 5",
      "",
      [
        ["12:30", "Case conference", "Lecture theatre", "in"],
        ["16:00", "Education meeting", "Lecture theatre · no check-in", "watch"],
      ],
    ],
    [
      "Tuesday 6",
      "today",
      [
        ["12:30", "Grand rounds", "Lecture theatre · checked in"],
        ["20:30", "On call briefing", "From On Call · Ward 4"],
      ],
    ],
    [
      "Wednesday 7",
      "",
      [
        ["08:00", "Registrar teaching: Catatonia", "Seminar room 3 and Teams", "you"],
        ["13:00", "Supervision group", "Room 4"],
      ],
    ],
    ["Thursday 8", "", [["12:00", "Clinical skills workshop", "Moved to Simulation suite B"]]],
    ["Friday 9", "", [["08:00", "Psychotherapy seminar", "Seminar room 1"]]],
  ];
  return (
    <div className="body">
      <div className="card pad">
        <div className="calh">
          <b>5 to 11 October</b>
        </div>
        <div className="teach-rail num">
          {[
            ["MON", "5", 2],
            ["TUE", "6", 2],
            ["WED", "7", 2],
            ["THU", "8", 1],
            ["FRI", "9", 1],
            ["SAT", "10", 0],
            ["SUN", "11", 0],
          ].map((day, index) => (
            <div key={day[0]} className={`${index < 1 ? "past" : ""}${index === 1 ? " td on" : ""}`}>
              {day[0]}
              <b>{day[1]}</b>
              <s>
                {Array.from({ length: Number(day[2]) }, (_, dot) => (
                  <i key={dot} />
                ))}
              </s>
            </div>
          ))}
        </div>
        <div className="seg" style={{ marginTop: 10 }}>
          <button type="button" className="on">
            Whole service
          </button>
          <button type="button">Presenting</button>
        </div>
      </div>
      <div className="lbl">This week · 8 sessions</div>
      {rows.map((day) => (
        <div key={day[0]}>
          <div className="teach-day">
            {day[0]}
            {day[1] ? <em> · today</em> : null}
          </div>
          <div className="card">
            {day[2].map((session) => (
              <div className="row" key={session[1]}>
                <span className="tcol num">{session[0]}</span>
                <div className="tx">
                  <b>{session[1]}</b>
                  <small>{session[2]}</small>
                </div>
                {session[3] === "in" ? <span className="tag g">Checked in</span> : null}
                {session[3] === "watch" ? (
                  <button
                    type="button"
                    className="btn t"
                    onClick={() =>
                      dispatch({ type: "toast", message: "The recording stays in Teaching. Nothing is downloaded." })
                    }
                  >
                    Watch
                  </button>
                ) : null}
                {session[3] === "you" ? <span className="tag m">You present</span> : null}
                {!session[3] ? <Chevron /> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeachLogbook() {
  const { dispatch } = useWork();
  return (
    <div className="body">
      <div className="card">
        <div className="row">
          <span className="ic">
            <Icon id="layers" />
          </span>
          <div className="tx">
            <b>Term 4 · week 6 of 10</b>
            <small>8 of 10 sessions · reviews Thu 15 Oct</small>
          </div>
          <Chevron />
        </div>
      </div>
      <div className="card pad">
        <div className="lbl">
          Last 12 weeks <em className="num">18 sessions</em>
        </div>
        <b style={{ display: "block", fontSize: 14.5, fontWeight: 750, letterSpacing: "-.01em", marginTop: 6 }}>
          You checked in at teaching in 11 of the last 12 weeks.
        </b>
      </div>
      <div className="lbl">
        Not yet in CPD · 3 <em className="num">3 h</em>
      </div>
      <div className="card">
        <div className="row">
          <div className="tx">
            <b>Journal club</b>
            <small>Tue 15 Sep</small>
          </div>
          <span className="tag a">Overdue</span>
          <span className="teach-hrs num">1 h</span>
        </div>
        <div className="row">
          <div className="tx">
            <b>Case conference</b>
            <small>Mon 5 Oct</small>
          </div>
          <span className="teach-hrs num">1 h</span>
        </div>
        <div className="row">
          <div className="tx">
            <b>Grand rounds</b>
            <small>Tue 6 Oct</small>
          </div>
          <span className="teach-hrs num">1 h</span>
        </div>
      </div>
      <button type="button" className="btn p w" onClick={() => dispatch({ type: "mode", mode: "cpd", tab: 1 })}>
        Log 3 sessions to my CPD
      </button>
      <div className="teach-ft">
        <Icon id="shield" />
        <span>Your CPD log is private. Logged sessions show in CPD, under Log.</span>
      </div>
    </div>
  );
}

export function AssessBody() {
  const { state, dispatch } = useWork();
  if (state.tab === 1) return <Progress />;
  if (state.tab === 2) return <Supervision />;
  return (
    <>
      <div className="body dk">
        <div className="hero">
          <div className="k">Overdue since Fri 2 Oct</div>
          <div className="hrow" style={{ marginTop: 6 }}>
            <Ring value="3/7" caption="steps" fraction={3 / 7} />
            <div>
              <h3>Dr Nguyen · mid-term</h3>
              <p>PGY2. Your draft is saved. Meeting Thu 8 Oct, 12:30</p>
            </div>
          </div>
          <div className="hbtns">
            <button
              type="button"
              className="hw"
              onClick={() =>
                dispatch({ type: "toast", message: "Draft stays on this phone. Nothing is sent to the MEU yet." })
              }
            >
              <Icon id="pen" />
              Continue draft
            </button>
            <button
              type="button"
              className="hg"
              onClick={() => dispatch({ type: "toast", message: "A time request is not sent until you confirm it." })}
            >
              <Icon id="send" />
              Ask MEU for time
            </button>
          </div>
        </div>
        <div className="lbl">
          Requests <em className="num">3</em>
        </div>
        <div className="card">
          <div className="row">
            <span className="av">DP</span>
            <div className="tx">
              <b>Dr Patel · EPA 1</b>
              <small>Clinical assessment · by Sun 8 Nov</small>
            </div>
            <button
              type="button"
              className="btn t"
              onClick={() =>
                dispatch({ type: "toast", message: "EPA notes must leave out anything that could identify a patient." })
              }
            >
              Record
            </button>
          </div>
          <div className="row">
            <span className="av">TN</span>
            <div className="tx">
              <b>Dr Nguyen · EPA 2</b>
              <small>Acutely unwell · asked Fri 2 Oct</small>
            </div>
            <button
              type="button"
              className="btn t"
              onClick={() =>
                dispatch({ type: "toast", message: "EPA notes must leave out anything that could identify a patient." })
              }
            >
              Record
            </button>
          </div>
          <div className="row">
            <span className="ic">
              <Icon id="users" />
            </span>
            <div className="tx">
              <b>Confirm supervision</b>
              <small>Dr Patel today, Dr Nguyen correction</small>
            </div>
            <span className="tag m num">2</span>
            <Chevron />
          </div>
        </div>
        <div className="card">
          <div className="row">
            <span className="ic admin">
              <Icon id="doc" />
            </span>
            <div className="tx">
              <b>Supervisor report</b>
              <small>In Admin · due Fri 9 Oct</small>
            </div>
            <span className="tag a">Fri</span>
            <Chevron />
          </div>
        </div>
        <div className="lbl">Coming up</div>
        <div className="card">
          <div className="row">
            <DateTile month="THU" day="8" />
            <div className="tx">
              <b>Meeting with Dr Nguyen</b>
              <small>Mid-term · Ward 4 office · 12:30</small>
            </div>
            <span className="tag n">Booked</span>
          </div>
          <div className="row">
            <DateTile month="OCT" day="26" />
            <div className="tx">
              <b>End-of-term window opens</b>
              <small>No times offered yet</small>
            </div>
            <button
              type="button"
              className="btn s"
              onClick={() => dispatch({ type: "toast", message: "Times offered: six sample slots from 26 Oct." })}
            >
              Set times
            </button>
          </div>
          <div className="row">
            <DateTile month="NOV" day="20" />
            <div className="tx">
              <b>Forms due to the MEU</b>
              <small>End-of-term, both doctors</small>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="row">
            <span className="ic n">
              <Icon id="shield" />
            </span>
            <div className="tx">
              <b>You rate first</b>
              <small>
                You see a doctor&apos;s self-ratings only after your draft is done. You sign after the meeting.
              </small>
            </div>
          </div>
        </div>
      </div>
      <Dock
        primary={
          <>
            <Icon id="plus" />
            Record EPA
          </>
        }
        secondary={
          <>
            <Icon id="clock" />
            Your times
          </>
        }
        onPrimary={() =>
          dispatch({ type: "toast", message: "EPA notes must leave out anything that could identify a patient." })
        }
        onSecondary={() => dispatch({ type: "toast", message: "Times offered: six sample slots from 26 Oct." })}
      />
    </>
  );
}

function Progress() {
  return (
    <div className="body">
      <div className="seg">
        <button type="button" className="on">
          This term
        </button>
        <button type="button">This year</button>
      </div>
      <div className="card pad">
        <div className="lbl">
          Psychiatry <em>31 Aug to 8 Nov</em>
        </div>
        <div className="note" style={{ marginTop: 9, justifyContent: "center" }}>
          Booking opens Mon 26 Oct. Forms due Fri 20 Nov.
        </div>
      </div>
      <div className="card">
        <div className="row">
          <span className="av">TN</span>
          <div className="tx">
            <b>Dr Nguyen</b>
            <small>PGY2 · term 4 of 4</small>
          </div>
          <span className="tag r">Overdue</span>
          <Chevron />
        </div>
        <div className="kv">
          <span>Mid-term</span>
          <b style={{ color: "var(--red)" }}>Overdue since Fri 2 Oct</b>
        </div>
        <div className="kv">
          <span>End-of-term</span>
          <b>Window opens 26 Oct</b>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <span className="av">DP</span>
          <div className="tx">
            <b>Dr Patel</b>
            <small>PGY1 · term 4 of 5</small>
          </div>
          <span className="tag a">EPA 1</span>
          <Chevron />
        </div>
        <div className="kv">
          <span>Mid-term</span>
          <b>Signed Fri 2 Oct</b>
        </div>
        <div className="kv">
          <span>End-of-term</span>
          <b>Not asked yet</b>
        </div>
      </div>
      <div className="note" style={{ justifyContent: "center" }}>
        <Icon id="shield" />
        Counts are records here. CLA stays the official record.
      </div>
    </div>
  );
}

function Supervision() {
  const { state, dispatch } = useWork();
  return (
    <div className="body">
      <div className="lbl">
        Waiting for you <em className="num">{state.supervisionConfirmed ? 1 : 2}</em>
      </div>
      <div className="card">
        {state.supervisionConfirmed ? null : (
          <div className="row">
            <span className="av">DP</span>
            <div className="tx">
              <b>Dr Patel · today</b>
              <small>12:30 · 60 min · individual</small>
            </div>
            <button type="button" className="btn p" onClick={() => dispatch({ type: "confirmSupervision" })}>
              Confirm
            </button>
          </div>
        )}
        <div className="row">
          <span className="av">TN</span>
          <div className="tx">
            <b>Dr Nguyen · correction</b>
            <small>Thu 24 Sep · 60 min to 90 min</small>
          </div>
          <button
            type="button"
            className="btn s"
            onClick={() => dispatch({ type: "toast", message: "The correction stays here until you review it." })}
          >
            Review
          </button>
        </div>
      </div>
      <div className="lbl">This term</div>
      <div className="card">
        <div className="row">
          <span className="av">DP</span>
          <div className="tx">
            <b>Dr Patel</b>
            <small>Weekly, Tuesday 12:30</small>
          </div>
          <Chevron />
        </div>
        <div className="row">
          <span className="av">TN</span>
          <div className="tx">
            <b>Dr Nguyen</b>
            <small>Weekly, Thursday 12:30</small>
          </div>
          <Chevron />
        </div>
      </div>
      <div className="note" style={{ justifyContent: "center", textAlign: "center" }}>
        <Icon id="shield" />
        Topics only, never patient details. Not CPD credit.
      </div>
    </div>
  );
}

export function CpdBody() {
  const { state, dispatch } = useWork();
  if (state.tab === 1) return <CpdLog />;
  if (state.tab === 2) return <CpdLearn />;
  return (
    <>
      <div className="body dk">
        <div className="hero">
          <div className="cpd-top">
            <div>
              <div className="k num">2026 · 12 weeks left</div>
              <div className="cpd-big num">
                <b>32.5</b>
                <small>of 50 h logged</small>
              </div>
            </div>
            <span className="cpd-pct num">65%</span>
          </div>
          <div className="cpd-bar">
            <i className="e" style={{ width: "32%" }} />
            <i className="r" style={{ width: "13%" }} />
            <i className="o" style={{ width: "20%" }} />
            <i className="rt" style={{ width: "18%" }} />
          </div>
          <div className="cpd-leg num">
            <div>
              <i className="e" />
              Educational<b>16 h</b>
            </div>
            <div>
              <i className="r" />
              Reviewing<b>6.5 h</b>
            </div>
            <div>
              <i className="o" />
              Outcomes<b>10 h</b>
            </div>
            <div>
              <i className="rt" />
              Routines likely<b>9 h</b>
            </div>
          </div>
          <button
            type="button"
            className="cpd-pace hpanel"
            onClick={() =>
              dispatch({ type: "toast", message: "17.5 h to go. After routines, 8.5 h is still to find." })
            }
          >
            <Icon id="pulse" />
            <div className="tx">
              <b className="num">17.5 h to go · about 1.5 h a week</b>
              <small className="num">After routines, 8.5 h is still to find</small>
            </div>
            <Chevron />
          </button>
        </div>
        <div className="lbl">To log</div>
        <div className="card">
          <div className="row">
            <span className="ic teach">
              <Icon id="board" />
            </span>
            <div className="tx">
              <b>Journal club</b>
              <small>Tue 15 Sep · 1 h · attended, not logged</small>
            </div>
            <button type="button" className="btn t" onClick={() => dispatch({ type: "tab", index: 1 })}>
              Log
            </button>
          </div>
          <div className="row">
            <span className="ic">
              <Icon id="users" />
            </span>
            <div className="tx">
              <b>Case review meeting</b>
              <small>Routine due today · usually 1.5 h</small>
            </div>
            <button
              type="button"
              className="btn t num"
              onClick={() =>
                dispatch({ type: "toast", message: "1.5 h is ready to log. Nothing is saved until you confirm." })
              }
            >
              Log 1.5 h
            </button>
          </div>
        </div>
        <div className="lbl">What&apos;s left · 5</div>
        <div className="card">
          <div className="row">
            <span className="ic">
              <Icon id="users" />
            </span>
            <div className="tx">
              <b>Reviewing and outcomes</b>
              <small className="num">16.5 of 25 h · 8.5 h short</small>
            </div>
            <button type="button" className="btn p" onClick={() => dispatch({ type: "tab", index: 1 })}>
              Log
            </button>
          </div>
          <div className="row">
            <span className="ic n">
              <Icon id="award" />
            </span>
            <div className="tx">
              <b>Hours in total</b>
              <small className="num">32.5 of 50 h</small>
            </div>
            <span className="cpd-mini">
              <i style={{ width: "65%" }} />
            </span>
          </div>
          <div className="row">
            <span className="ic n">
              <Icon id="pen" />
            </span>
            <div className="tx">
              <b>Annual self-evaluation</b>
              <small>Not started</small>
            </div>
            <button
              type="button"
              className="btn t"
              onClick={() =>
                dispatch({ type: "toast", message: "The self-evaluation stays on this phone until you submit it." })
              }
            >
              Start
            </button>
          </div>
        </div>
        <div className="lbl">About this year</div>
        <div className="card cpd-kv">
          <div className="kv">
            <span>Year</span>
            <b className="num">1 Jan to 31 Dec · 86 days left</b>
          </div>
          <div className="kv">
            <span>CPD home</span>
            <b>RANZCP</b>
          </div>
          <div className="kv">
            <span>Targets</span>
            <b className="num">Confirmed 3 Feb</b>
          </div>
        </div>
      </div>
      <Dock
        primary={
          <>
            <Icon id="plus" />
            Log an activity
          </>
        }
        onPrimary={() => dispatch({ type: "tab", index: 1 })}
      />
    </>
  );
}

function CpdLog() {
  const { dispatch } = useWork();
  const entries: Array<[string, string, string, string, string, string]> = [
    ["2", "OCT", "Mental health update evening", "e", "Not marked copied", "1 h"],
    ["1", "OCT", "Peer review group", "r", "No reflection", "1.5 h"],
    ["29", "SEP", "Clozapine audit, part 2", "o", "Marked copied", "1.5 h"],
    ["22", "SEP", "Grand round: perinatal mood", "e", "No evidence", "1 h"],
    ["8", "SEP", "Case review meeting", "r", "Marked copied", "1.5 h"],
  ];
  return (
    <>
      <div className="body dk">
        <div className="seg">
          <button type="button" className="on">
            Activities
          </button>
          <button type="button">To finish · 2</button>
          <button type="button">Routines</button>
        </div>
        <div className="field">
          <Icon id="search" />
          <span className="ph">Search titles and reflections</span>
        </div>
        <div className="lbl">
          October <em className="num">2.5 h</em>
        </div>
        <div className="card">
          {entries.slice(0, 2).map((row) => (
            <div className="row" key={row[2]}>
              <DateTile month={row[1]} day={row[0]} />
              <div className="tx">
                <b>{row[2]}</b>
                <small>
                  <span className={`cpd-d ${row[3]}`} />
                  {row[4]}
                </small>
              </div>
              <b className="cpd-h num">{row[5]}</b>
            </div>
          ))}
        </div>
        <div className="lbl">
          September <em className="num">4 h</em>
        </div>
        <div className="card">
          {entries.slice(2).map((row) => (
            <div className="row" key={row[2]}>
              <DateTile month={row[1]} day={row[0]} />
              <div className="tx">
                <b>{row[2]}</b>
                <small>
                  <span className={`cpd-d ${row[3]}`} />
                  {row[4]}
                </small>
              </div>
              <b className="cpd-h num">{row[5]}</b>
            </div>
          ))}
        </div>
        <div className="note">
          <Icon id="shield" />
          Leave patient details out of reflections
        </div>
      </div>
      <Dock
        primary={
          <>
            <Icon id="plus" />
            Log an activity
          </>
        }
        onPrimary={() =>
          dispatch({ type: "toast", message: "A new activity is not saved until you confirm the hours." })
        }
      />
    </>
  );
}

function CpdLearn() {
  return (
    <div className="body">
      <div className="seg">
        <button type="button" className="on">
          Upcoming · 6
        </button>
        <button type="button">Past</button>
      </div>
      <div className="chips">
        <span className="ch on">Psychiatry and open to all</span>
        <span className="ch">Every specialty</span>
      </div>
      <div className="lbl">Next</div>
      <div className="card">
        <div className="cpd-crs">
          <span className="dt">
            <small>OCT</small>
            <b className="num">14</b>
          </span>
          <div className="tx">
            <span className="tag m num">In 8 days</span>
            <b>Global Mental Health Summit 2026</b>
            <small>World Federation for Mental Health</small>
            <small className="num">Wed 14 to Fri 16 Oct · Optus Stadium, Perth</small>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="cpd-crs">
          <span className="dt">
            <small>OCT</small>
            <b className="num">24</b>
          </span>
          <div className="tx">
            <span className="tag m num">In 18 days</span>
            <b>WA Psychiatry Update</b>
            <small>Conference · Example College</small>
            <small className="num">Sat 24 Oct, 08:30 to 16:30 · Free for members</small>
          </div>
        </div>
      </div>
      <div className="lbl">Later this year · 2</div>
      <div className="card">
        <div className="row">
          <DateTile month="NOV" day="10" />
          <div className="tx">
            <b>Clinical audit workshop</b>
            <small>Tue 10 Nov · Online</small>
          </div>
          <span className="tag g">PD leave</span>
        </div>
        <div className="row">
          <DateTile month="NOV" day="26" />
          <div className="tx">
            <b>Regional Mental Health Forum</b>
            <small>Thu 26 Nov · In person · Example Hospital</small>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <span className="ic teach">
            <Icon id="board" />
          </span>
          <div className="tx">
            <b>Your hospital&apos;s teaching</b>
            <small>In Teaching</small>
          </div>
          <Chevron />
        </div>
      </div>
    </div>
  );
}

export function AdminBody() {
  const { state, dispatch } = useWork();
  if (state.tab === 1) return <Renewals />;
  if (state.tab === 2) return <NewJob />;
  return (
    <>
      <div className="body dk">
        <div className="hero">
          <div className="k">Renew next</div>
          <div className="hrow" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h3>Basic life support</h3>
              <p className="num">Date passed Wed 23 Sep · 13 days ago</p>
            </div>
          </div>
          <div className="track" style={{ height: 10, marginTop: 12 }}>
            <div className="done" style={{ left: 2, width: "35%" }} />
            <div className="now" style={{ left: "35%" }} />
          </div>
          <div className="admin-hl num">
            <span>
              Passed <b>23 Sep</b>
            </span>
            <span>Today</span>
            <span>
              Extension <b>30 Oct</b>
            </span>
          </div>
          <div className="hpanel admin-hp">
            <Icon id="clock" />
            <span>Extension asked to Fri 30 Oct. Waiting for Medical Workforce.</span>
          </div>
          <div className="hbtns">
            <button
              type="button"
              className="hw"
              onClick={() =>
                dispatch({ type: "toast", message: "Course booking stays on this phone until you confirm." })
              }
            >
              <Icon id="cal" />
              Book a course
            </button>
            <button
              type="button"
              className="hg"
              onClick={() => dispatch({ type: "toast", message: "Renewal steps open in Admin. Nothing is sent yet." })}
            >
              <Icon id="ext" />
              How to renew
            </button>
          </div>
        </div>
        <div className="lbl">
          Needs you <em className="num">4</em>
        </div>
        <div className="card">
          <div className="row">
            <span className="ic r">
              <Icon id="pen" />
            </span>
            <div className="tx">
              <b>Sign leave form</b>
              <small>Today</small>
            </div>
            {state.leaveSigned ? (
              <span className="tag g">Signed</span>
            ) : (
              <button type="button" className="btn t" onClick={() => dispatch({ type: "signLeave" })}>
                Sign
              </button>
            )}
          </div>
          <div className="row">
            <span className="ic am">
              <Icon id="shield" />
            </span>
            <div className="tx">
              <b>Book mask fit test</b>
              <small className="num">By Wed 14 Oct · slot Wed 7 Oct 10:00</small>
            </div>
            <button
              type="button"
              className="btn t"
              onClick={() =>
                dispatch({ type: "toast", message: "The Wednesday 10:00 slot is held until you confirm." })
              }
            >
              Book
            </button>
          </div>
          <div className="row">
            <span className="ic am">
              <Icon id="doc" />
            </span>
            <div className="tx">
              <b>Supervisor report</b>
              <small>Due Fri 9 Oct</small>
            </div>
            <Chevron />
          </div>
          <div className="row">
            <span className="ic n">
              <Icon id="clock" />
            </span>
            <div className="tx">
              <b>1 date not recorded</b>
              <small>Family and domestic violence training</small>
            </div>
            <button
              type="button"
              className="btn s"
              onClick={() => dispatch({ type: "toast", message: "A date is saved only after you enter it." })}
            >
              Record
            </button>
          </div>
        </div>
        <div className="cnts">
          <div className="card">
            <b className="num">1</b>
            <small>Date passed</small>
          </div>
          <div className="card">
            <b className="num">5</b>
            <small>Due in 90 days</small>
          </div>
          <div className="card">
            <b className="num">1</b>
            <small>Not recorded</small>
          </div>
        </div>
        <div className="lbl">
          Coming up{" "}
          <button type="button" onClick={() => dispatch({ type: "tab", index: 1 })}>
            Renewals
          </button>
        </div>
        <div className="card">
          <div className="row admin">
            <DateTile month="OCT" day="14" />
            <div className="tx">
              <b>Respirator fit test</b>
              <small>Book by Wed · in 8 days</small>
            </div>
            <span className="tag a">Due</span>
          </div>
          <div className="row admin">
            <DateTile month="OCT" day="18" />
            <div className="tx">
              <b>Manual handling</b>
              <small>Expires Sun · in 12 days</small>
            </div>
          </div>
          <div className="row admin">
            <DateTile month="OCT" day="31" />
            <div className="tx">
              <b>Fire and evacuation</b>
              <small>Expires Sat · in 25 days</small>
            </div>
          </div>
          <div className="row admin">
            <DateTile month="NOV" day="14" />
            <div className="tx">
              <b>Working with Children Check</b>
              <small>Renew by Sat · in 5 weeks</small>
            </div>
          </div>
        </div>
        <div className="lbl">
          New job{" "}
          <button type="button" onClick={() => dispatch({ type: "tab", index: 2 })}>
            Open
          </button>
        </div>
        <div className="card pad">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="tx">
              <b>Starts Mon 2 Nov</b>
              <small>Older adult psychiatry · in 4 weeks</small>
            </div>
            <b className="num" style={{ fontSize: 12 }}>
              3 of 7
            </b>
          </div>
          <div className="meter" style={{ marginTop: 9 }}>
            <i style={{ width: "43%", background: "var(--m)" }} />
          </div>
          <div className="admin-ck">
            <Icon id="arrowr" />
            Next: prescribing system access
          </div>
        </div>
      </div>
      <Dock
        primary={
          <>
            <Icon id="upload" />
            Add or upload
          </>
        }
        secondary={
          <>
            <Icon id="plus" />
            Add renewal
          </>
        }
        onPrimary={() =>
          dispatch({
            type: "toast",
            message: "Uploads stay with your signed-in account. Nothing is sent from this sample.",
          })
        }
        onSecondary={() => dispatch({ type: "tab", index: 1 })}
      />
    </>
  );
}

function Renewals() {
  const items = [
    ["Basic life support", "Passed 23 Sep · 13 days ago", "Extension asked"],
    ["Respirator fit test", "Book by 14 Oct · in 8 days", "Requested"],
    ["Manual handling", "Renew by 18 Oct · in 12 days", "Rule to confirm"],
    ["Fire and evacuation", "Renew by 31 Oct · in 25 days", "Rule to confirm"],
    ["Family and domestic violence", "Requested, due 31 Oct", ""],
    ["Working with Children Check", "Renew by 14 Nov · in 5 weeks", ""],
  ];
  return (
    <div className="body dk">
      <div className="seg">
        <button type="button" className="on">
          Checklist
        </button>
        <button type="button">Personal</button>
      </div>
      <div className="card pad">
        <div className="lbl">
          At a glance · 22 items <em>1 not for this job</em>
        </div>
        <div className="admin-gl">
          <div>
            <b className="num">1</b>
            <span>Date passed</span>
            <em>Extension asked</em>
          </div>
          <div className="on">
            <b className="num">5</b>
            <span>Start renewing</span>
            <em>Next 60 days</em>
          </div>
          <div>
            <b className="num">1</b>
            <span>Not recorded yet</span>
            <em>Requested</em>
          </div>
          <div>
            <b className="num">15</b>
            <span>Recorded</span>
          </div>
        </div>
      </div>
      <div className="lbl">
        Needs action · soonest first <em className="num">7</em>
      </div>
      <div className="card">
        {items.map((item) => (
          <div className="row" key={item[0]}>
            <span className="ic n">
              <Icon id="shield" />
            </span>
            <div className="tx">
              <b>{item[0]}</b>
              <small className="num">{item[1]}</small>
            </div>
            {item[2] ? <span className="tag n">{item[2]}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewJob() {
  const { dispatch } = useWork();
  const steps: Array<[boolean, string, string]> = [
    [true, "Hospital email account", "Yours · done"],
    [true, "ID badge and swipe card", "Yours · done"],
    [true, "Clinical records login", "Yours · done"],
    [false, "Prescribing system access", "Yours · ask on your first day"],
    [false, "Pathology results viewer", "Shared by another doctor"],
  ];
  return (
    <div className="body">
      <div className="card pad">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="dt">
            <small>MON</small>
            <b className="num">2</b>
          </span>
          <div className="tx">
            <b style={{ fontSize: 14.5 }}>You start Mon 2 Nov</b>
            <small>Older adult psychiatry · in 4 weeks</small>
          </div>
          <button
            type="button"
            className="btn s"
            style={{ height: 28 }}
            onClick={() =>
              dispatch({ type: "toast", message: "The start date stays Mon 2 Nov until workforce confirms a change." })
            }
          >
            Change
          </button>
        </div>
        <div className="prog" style={{ marginTop: 11 }}>
          <div className="meter">
            <i style={{ width: "43%", background: "var(--m)" }} />
          </div>
          <b className="num">3 of 7 done</b>
        </div>
      </div>
      <div className="lbl">Before · logins and access</div>
      <div className="card">
        {steps.map((step) => (
          <div className="row" key={step[1]}>
            <span className={`admin-tick${step[0] ? " d" : ""}`}>{step[0] ? <Icon id="check" /> : null}</span>
            <div className="tx">
              <b>{step[1]}</b>
              <small>{step[2]}</small>
            </div>
            {step[0] ? null : <Icon id="pen" className="chev2" />}
          </div>
        ))}
      </div>
      <div className="lbl">Contacts for this job</div>
      <div className="card">
        <div className="row">
          <span className="av">MW</span>
          <div className="tx">
            <b>Medical Workforce</b>
            <small className="num">ext 4410</small>
          </div>
        </div>
        <div className="row">
          <span className="av">OA</span>
          <div className="tx">
            <b>Older adult unit, ward clerk</b>
            <small className="num">ext 4620</small>
          </div>
        </div>
      </div>
      <div className="note" style={{ justifyContent: "center" }}>
        <Icon id="shield" />
        Hospital files and patient information are never included
      </div>
    </div>
  );
}
