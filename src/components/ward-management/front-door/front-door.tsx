"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft, FlaskConical, Info, Lock, Mail, Tv, User } from "lucide-react";

import type { WardCredentialForm } from "@/components/ward-management/use-ward-supabase-shared";

import { frontDoorNotice } from "./front-door-notice";
import {
  Arrow,
  BedBoardTexture,
  DoorBanner,
  DoorMark,
  DoorScreen,
  EmailField,
  PasswordField,
  SESSION_HOURS,
  IDLE_MINUTES,
  SessionNote,
  Spinner,
} from "./front-door-parts";
import styles from "./front-door.module.css";

/**
 * Readiness review item 12: a new or recovered password is a passphrase of at least this length,
 * following the Australian Government ISM's passphrase guidance for single-factor sign-in (check
 * the current ISM before changing it). The sign-in service's own minimum is set to match in its
 * settings (docs/ward-flow/RETENTION-AND-BACKUP.md, steps for Josh).
 */
const NEW_PASSWORD_MIN_LENGTH = 15;
const RESEND_SECONDS = 60;

/**
 * The public demo (Railway service `ward-flow`, local mode, see docs/hosting.md), offered under the
 * signed-in site's sign-in card. `NEXT_PUBLIC_WARD_DEMO_URL` moves it; "off" hides the row.
 */
const PUBLIC_DEMO_URL = "https://ward-flow-production.up.railway.app/ward-flow";
export function publicDemoUrl(configured = process.env.NEXT_PUBLIC_WARD_DEMO_URL): string | null {
  const value = configured?.trim();
  if (value === "off") return null;
  return value && /^https:\/\/[^/\s]+\/\S*$/.test(value) ? value : PUBLIC_DEMO_URL;
}

function subscribeOnline(changed: () => void) {
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
  };
}

/** Whether the browser says it is online. The server render assumes it is. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  );
}

/** On a desk with a mouse, the email field is ready to type into; phones wait for a tap. */
function useDeskFocus(target: RefObject<HTMLInputElement | null>, when: boolean) {
  useEffect(() => {
    if (!when || typeof window.matchMedia !== "function" || !window.matchMedia("(pointer: fine)").matches) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    target.current?.focus({ preventScroll: true });
  }, [target, when]);
}

type View = "sign-in" | "forgot" | "signup";

export type FrontDoorProps = {
  /** The sign-in controls. Missing when this site's sign-in is not configured. */
  form: WardCredentialForm | undefined;
  /** Why this tab was signed out, in the app's own words. */
  notice?: string | null;
  /** The bed meeting TV's signed-out screen. */
  tv?: boolean;
  /** The public demo, offered under the card. `null` leaves it off; unset uses `publicDemoUrl()`. */
  demoUrl?: string | null;
};

export function FrontDoor({ form, notice, tv = false, demoUrl = publicDemoUrl() }: FrontDoorProps) {
  const [view, setView] = useState<View>("sign-in");
  const [email, setEmail] = useState("");
  if (form?.recovery) return <NewPasswordDoor form={form} />;
  if (tv && view === "sign-in") return <TvDoor form={form} notice={notice} email={email} setEmail={setEmail} />;
  if (form && view === "forgot")
    return <ForgotDoor form={form} email={email} setEmail={setEmail} back={() => setView("sign-in")} />;
  if (form && view === "signup") return <SignUpDoor form={form} back={() => setView("sign-in")} />;
  return (
    <SignInDoor
      form={form}
      notice={notice}
      email={email}
      setEmail={setEmail}
      demoUrl={demoUrl}
      forgot={() => {
        form?.cancel();
        setView("forgot");
      }}
      signup={() => setView("signup")}
    />
  );
}

/** The card's one message: the latest answer from the sign-in service, else why this tab signed out. */
function SignInMessage({
  form,
  notice,
  online,
}: {
  form: WardCredentialForm | undefined;
  notice?: string | null;
  online: boolean;
}) {
  if (!online)
    return (
      <DoorBanner
        tone="warning"
        icon="wifi"
        title="No connection."
        body="Check your Wi-Fi or mobile data. Your details stay here, so you can sign in as soon as you are back online."
      />
    );
  if (!form)
    return (
      <DoorBanner
        tone="warning"
        icon="warning"
        title="Sign-in is not available on this site."
        body={notice ?? "Tell the Ward Flow coordinator."}
      />
    );
  if (form.message) {
    if (form.messageKind === "credentials")
      return (
        <DoorBanner
          tone="danger"
          icon="alert"
          title="Email or password is not right."
          body="Check both and try again."
        />
      );
    if (form.messageKind === "unavailable") {
      // A sign-in service that did not answer is a passing fault; anything else (this site's
      // set-up, a broken link) is said in the app's own words, with who to tell.
      if (/sign-in (service )?is unavailable/i.test(form.message))
        return (
          <DoorBanner
            tone="info"
            icon="server"
            title="The sign-in service is busy."
            body="Nothing is wrong with your details. Try again in a moment."
          />
        );
      const said = frontDoorNotice(form.message);
      return (
        <DoorBanner
          tone="warning"
          icon="warning"
          title={said?.title ?? form.message}
          body={said?.body ?? "If this keeps happening, tell the Ward Flow coordinator."}
        />
      );
    }
    const said = frontDoorNotice(form.message);
    if (said)
      return (
        <DoorBanner
          tone={form.messageKind === "warning" ? "warning" : said.tone}
          icon={said.icon}
          title={said.title}
          body={said.body}
        />
      );
  }
  const said = frontDoorNotice(notice);
  return said ? <DoorBanner tone={said.tone} icon={said.icon} title={said.title} body={said.body} /> : null;
}

function SignInDoor({
  form,
  notice,
  email,
  setEmail,
  demoUrl,
  forgot,
  signup,
}: {
  form: WardCredentialForm | undefined;
  notice?: string | null;
  email: string;
  setEmail: (value: string) => void;
  demoUrl?: string | null;
  forgot: () => void;
  signup: () => void;
}) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const online = useOnline();
  const emailRef = useRef<HTMLInputElement>(null);
  useDeskFocus(emailRef, true);
  const busy = form?.busy === true;
  const refused = form?.message != null && form.messageKind === "credentials";
  const serviceBusy = form?.message != null && form.messageKind === "unavailable";
  const hasMessage = !online || !form || form.message != null || frontDoorNotice(notice) !== null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || busy || !online) return;
    const entered = password;
    setPassword("");
    void form.signIn(email.trim(), entered);
  };
  return (
    <DoorScreen label="Ward Flow sign-in" note={hasMessage} focusTarget={emailRef}>
      <div className={styles.card}>
        <form className={styles.form} onSubmit={submit} aria-busy={busy || undefined}>
          <header className={styles.cardHead}>
            <h1>Sign in</h1>
            <p>Use your Ward Flow account.</p>
          </header>
          <SignInMessage form={form} notice={notice} online={online} />
          <EmailField
            id={`${uid}-email`}
            value={email}
            onChange={setEmail}
            disabled={busy || !form}
            invalid={refused}
            inputRef={emailRef}
          />
          <PasswordField
            id={`${uid}-password`}
            value={password}
            onChange={setPassword}
            disabled={busy || !form}
            invalid={refused}
            action={
              form && (
                <button type="button" className={styles.link} onClick={forgot} disabled={busy}>
                  Forgot password?
                </button>
              )
            }
          />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || !form || !online}>
            {!online ? (
              <>
                <Spinner dim />
                Waiting for a connection
              </>
            ) : busy ? (
              <>
                <Spinner />
                Signing in…
              </>
            ) : (
              <>
                {serviceBusy ? "Try again" : "Sign in"}
                <Arrow />
              </>
            )}
          </button>
          <SessionNote>
            Stays signed in for up to {SESSION_HOURS} hours in this tab. Locks after {IDLE_MINUTES} minutes without use.
          </SessionNote>
          <div className={styles.cardFoot}>
            <p>No account yet? Ask the Ward Flow coordinator.</p>
            {form?.signupAvailable && (
              <button type="button" className={`${styles.link} ${styles.linkCentre}`} onClick={signup} disabled={busy}>
                Create a Ward Flow account
              </button>
            )}
            {demoUrl && (
              <a className={styles.demo} href={demoUrl}>
                <FlaskConical aria-hidden="true" />
                Explore the demo
                <Arrow />
              </a>
            )}
          </div>
        </form>
      </div>
    </DoorScreen>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={styles.back} onClick={onClick} disabled={disabled}>
      <ArrowLeft aria-hidden="true" />
      Back to sign in
    </button>
  );
}

function ForgotDoor({
  form,
  email,
  setEmail,
  back,
}: {
  form: WardCredentialForm;
  email: string;
  setEmail: (value: string) => void;
  back: () => void;
}) {
  const uid = useId();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  useDeskFocus(emailRef, sentTo === null);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  const sent = sentTo !== null && form.messageKind === "sent" && !form.busy;
  const send = (address: string) => {
    setSentTo(address);
    setLeft(RESEND_SECONDS);
    void form.recover(address);
  };
  const leave = () => {
    form.cancel();
    back();
  };
  if (sent)
    return (
      <DoorScreen label="Ward Flow sign-in" note={false}>
        <div className={styles.card}>
          <div className={styles.stack} role="status">
            <span className={styles.bigicon}>
              <Mail aria-hidden="true" />
            </span>
            <header className={styles.cardHead}>
              <h1>Check your email</h1>
              <p>
                If an account uses <strong>{sentTo}</strong>, a reset link is on its way.
              </p>
            </header>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={left > 0}
              onClick={() => send(sentTo!)}
            >
              {left > 0 ? (
                <>
                  Send again in{" "}
                  <span className={styles.monoT}>
                    {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                  </span>
                </>
              ) : (
                "Send again"
              )}
            </button>
            <button type="button" className={`${styles.link} ${styles.linkCentre}`} onClick={leave}>
              Back to sign in
            </button>
          </div>
        </div>
      </DoorScreen>
    );
  const problem = form.message && form.messageKind !== "sent" ? form.message : null;
  return (
    <DoorScreen label="Ward Flow sign-in" note={problem !== null} focusTarget={emailRef}>
      <div className={styles.card}>
        <form
          className={styles.form}
          aria-busy={form.busy || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.busy) send(email.trim());
          }}
        >
          <BackButton onClick={leave} disabled={form.busy} />
          <header className={styles.cardHead}>
            <h1>Reset your password</h1>
            <p>Enter your account email. We will send a link to set a new password.</p>
          </header>
          {problem && (
            <DoorBanner
              tone={form.messageKind === "unavailable" ? "info" : "danger"}
              icon={form.messageKind === "unavailable" ? "server" : "alert"}
              title={
                form.messageKind === "unavailable" ? "The sign-in service is busy." : "The link could not be sent."
              }
              body={form.messageKind === "unavailable" ? "Try again in a moment." : problem}
            />
          )}
          <EmailField id={`${uid}-email`} value={email} onChange={setEmail} disabled={form.busy} inputRef={emailRef} />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={form.busy}>
            {form.busy ? (
              <>
                <Spinner />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </button>
          <p className={styles.hint}>
            <Info aria-hidden="true" />
            <span>
              Test accounts end in example.test and cannot receive email. Ask the Ward Flow coordinator to reset those.
            </span>
          </p>
        </form>
      </div>
    </DoorScreen>
  );
}

/** Characters typed against the passphrase minimum, as a bar and a count. */
function PassphraseMeter({ length, id }: { length: number; id: string }) {
  const ok = length >= NEW_PASSWORD_MIN_LENGTH;
  return (
    <div className={styles.meter}>
      <div className={styles.meterTrack} aria-hidden="true">
        <div
          className={`${styles.meterFill} ${ok ? styles.meterFillOk : ""}`}
          style={{ width: `${Math.min(100, (length / NEW_PASSWORD_MIN_LENGTH) * 100)}%` }}
        />
      </div>
      <div className={styles.meterRow} id={id}>
        <span>
          At least {NEW_PASSWORD_MIN_LENGTH} characters. A short phrase of unrelated words is easiest to remember.
        </span>
        <span className={`${styles.monoT} ${ok ? styles.meterOk : ""}`}>
          {length} of {NEW_PASSWORD_MIN_LENGTH}
        </span>
      </div>
    </div>
  );
}

/** New password and its confirmation, shared by a recovery link and a new account. */
function NewPasswordFields({
  uid,
  password,
  setPassword,
  confirm,
  setConfirm,
  disabled,
}: {
  uid: string;
  password: string;
  setPassword: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <PasswordField
        id={`${uid}-new`}
        label="New password"
        autoComplete="new-password"
        icon="key"
        value={password}
        onChange={setPassword}
        minLength={NEW_PASSWORD_MIN_LENGTH}
        describedBy={`${uid}-meter`}
        disabled={disabled}
        after={<PassphraseMeter length={password.length} id={`${uid}-meter`} />}
      />
      <PasswordField
        id={`${uid}-confirm`}
        label="Confirm new password"
        autoComplete="new-password"
        icon="key"
        value={confirm}
        onChange={setConfirm}
        disabled={disabled}
      />
    </>
  );
}

function NewPasswordDoor({ form }: { form: WardCredentialForm }) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const problem = form.message && form.messageKind !== "sent" ? form.message : null;
  return (
    <DoorScreen label="Ward Flow sign-in" note>
      <div className={styles.card}>
        <form
          className={styles.form}
          aria-busy={form.busy || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (form.busy) return;
            if (password !== confirm) {
              setMismatch(true);
              return;
            }
            setMismatch(false);
            const entered = password;
            setPassword("");
            setConfirm("");
            void form.updatePassword(entered);
          }}
        >
          <header className={styles.cardHead}>
            <h1>Set a new password</h1>
            <p>Use a password of your own. Never share one between accounts.</p>
          </header>
          {/* Fresh audit X-1: a recovery link someone else sent signs this tab in to their account. */}
          <div className={styles.acct}>
            <User aria-hidden="true" />
            <span data-testid="ward-recovery-account">
              {form.accountEmail ? (
                <>
                  This link is for <strong>{form.accountEmail}</strong>. If that is not your account, choose Cancel.
                </>
              ) : (
                "This link's account could not be shown. If you did not ask for this link, choose Cancel."
              )}
            </span>
          </div>
          {mismatch ? (
            <DoorBanner
              tone="danger"
              icon="alert"
              title="The passwords do not match."
              body="Type the same password twice."
            />
          ) : problem ? (
            <DoorBanner tone="danger" icon="alert" title="The password was not saved." body={problem} />
          ) : null}
          <NewPasswordFields
            uid={uid}
            password={password}
            setPassword={setPassword}
            confirm={confirm}
            setConfirm={setConfirm}
            disabled={form.busy}
          />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={form.busy}>
            {form.busy ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              "Save and sign in"
            )}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={form.cancel}
            disabled={form.busy}
          >
            Cancel
          </button>
        </form>
      </div>
    </DoorScreen>
  );
}

function SignUpDoor({ form, back }: { form: WardCredentialForm; back: () => void }) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useDeskFocus(emailRef, true);
  const said = form.message ? frontDoorNotice(form.message) : null;
  return (
    <DoorScreen label="Ward Flow sign-in" note={said !== null || mismatch} focusTarget={emailRef}>
      <div className={styles.card}>
        <form
          className={styles.form}
          aria-busy={form.busy || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (form.busy) return;
            if (password !== confirm) {
              setMismatch(true);
              return;
            }
            setMismatch(false);
            const entered = password;
            setPassword("");
            setConfirm("");
            void form.signUp(email.trim(), entered);
          }}
        >
          <BackButton
            onClick={() => {
              form.cancel();
              back();
            }}
            disabled={form.busy}
          />
          <header className={styles.cardHead}>
            <h1>Create a Ward Flow account</h1>
            <p>An access admin still gives the account its role.</p>
          </header>
          {mismatch ? (
            <DoorBanner
              tone="danger"
              icon="alert"
              title="The passwords do not match."
              body="Type the same password twice."
            />
          ) : said ? (
            <DoorBanner
              tone={form.messageKind === "credentials" ? "danger" : said.tone}
              icon={said.icon}
              title={said.title}
              body={said.body}
            />
          ) : null}
          <EmailField id={`${uid}-email`} value={email} onChange={setEmail} disabled={form.busy} inputRef={emailRef} />
          <NewPasswordFields
            uid={uid}
            password={password}
            setPassword={setPassword}
            confirm={confirm}
            setConfirm={setConfirm}
            disabled={form.busy}
          />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={form.busy}>
            {form.busy ? (
              <>
                <Spinner />
                Creating…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>
      </div>
    </DoorScreen>
  );
}

function perthClock(now: number) {
  const time = new Date(now).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Australia/Perth",
  });
  const date = new Date(now).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Perth",
  });
  return { time, date };
}

/** The TV's live Perth clock, so a signed-out TV still shows something useful across the room. */
function TvClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return <span className={styles.clock} />;
  const { time, date } = perthClock(now);
  return (
    <span className={styles.clock}>
      <b>{time}</b>
      <span>{date}</span>
    </span>
  );
}

/** TV-13 (H-0787): a wall TV whose session ends says so at TV size, not as a small sign-in page. */
function TvDoor({
  form,
  notice,
  email,
  setEmail,
}: {
  form: WardCredentialForm | undefined;
  notice?: string | null;
  email: string;
  setEmail: (value: string) => void;
}) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const online = useOnline();
  const busy = form?.busy === true;
  const refused = form?.message != null && form.messageKind === "credentials";
  return (
    <div className={styles.screen}>
      <main
        id="main-content"
        className={`${styles.door} ${styles.tv}`}
        aria-label="TV signed out"
        data-testid="ward-tv-signed-out"
      >
        <BedBoardTexture rows={14} />
        <div className={styles.tvTop}>
          <DoorMark />
          <span className={styles.wordmark}>Ward Flow</span>
          <TvClock />
        </div>
        <div className={styles.tvMain}>
          <div className={styles.tvMsg}>
            <span className={styles.bigicon}>
              <Tv aria-hidden="true" />
            </span>
            <h1>This TV is signed out</h1>
            <p>The bed meeting view is not showing. Sign in again to bring it back.</p>
          </div>
          <div className={styles.tvCard}>
            <form
              className={styles.form}
              aria-busy={busy || undefined}
              onSubmit={(event) => {
                event.preventDefault();
                if (!form || busy || !online) return;
                const entered = password;
                setPassword("");
                void form.signIn(email.trim(), entered);
              }}
            >
              <header className={styles.cardHead}>
                <h2>Sign in this TV</h2>
                <p>Use the bed meeting account.</p>
              </header>
              <SignInMessage form={form} notice={notice} online={online} />
              <EmailField
                id={`${uid}-email`}
                value={email}
                onChange={setEmail}
                disabled={busy || !form}
                invalid={refused}
              />
              <PasswordField
                id={`${uid}-password`}
                value={password}
                onChange={setPassword}
                disabled={busy || !form}
                invalid={refused}
              />
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={busy || !form || !online}
              >
                {busy ? (
                  <>
                    <Spinner />
                    Signing in…
                  </>
                ) : (
                  <>
                    <Lock aria-hidden="true" />
                    Sign in
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
        <p className={styles.tvFoot}>
          <Info aria-hidden="true" />
          Synthetic data only. Names show in full on this screen.
        </p>
      </main>
    </div>
  );
}

/**
 * #805: while a saved sign-in is checked and the board first read, nothing has failed, so the navy
 * holds with a plain status rather than offering Reconnect or a sign-in button, which read as a
 * sign-out. `actions` appear only once the wait runs long, or when there is a problem to act on.
 */
export function FrontDoorStatus({
  title,
  status,
  testId,
  busy = true,
  children,
}: {
  title: string;
  status: string;
  testId?: string;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <main id="main-content" className={styles.door} aria-label={title} aria-busy={busy || undefined}>
        <BedBoardTexture />
        <div className={styles.opening}>
          <DoorMark />
          {busy && <span className={`${styles.spin} ${styles.openingSpin}`} aria-hidden="true" />}
          <h1>{title}</h1>
          <p role="status" data-testid={testId}>
            {status}
          </p>
          {children && <div className={styles.openingActions}>{children}</div>}
        </div>
      </main>
    </div>
  );
}
