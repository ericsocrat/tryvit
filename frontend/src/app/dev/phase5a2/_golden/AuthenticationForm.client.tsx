"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Input } from "@/design-system/primitives/Field";

import type { AuthCopy } from "./authentication-copy";
import type {
  GOLDEN_REFERENCE_STATES,
  GoldenRouteState,
} from "./contract";
import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

type AuthMode = "sign-in" | "registration" | "recovery";
type AuthState = (typeof GOLDEN_REFERENCE_STATES.authentication)[number];

function initialMode(state: AuthState): AuthMode {
  if (state === "registration") return "registration";
  if (state === "recovery" || state === "recovery-sent") return "recovery";
  return "sign-in";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}

export function AuthenticationForm({
  route,
  copy,
}: Readonly<{ route: GoldenRouteState; copy: AuthCopy }>) {
  const initialState = route.state as AuthState;
  const [mode, setMode] = useState<AuthMode>(initialMode(initialState));
  const [state, setState] = useState<AuthState>(initialState);
  const [email, setEmail] = useState(initialState === "field-invalid" ? "" : "review@tryvit.local");
  const [password, setPassword] = useState(initialState === "field-invalid" ? "" : "evidence");
  const [displayName, setDisplayName] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const jobGenerationRef = useRef(0);
  const userTransitionRef = useRef(false);
  const focusEmailAfterRenderRef = useRef(false);

  const errors = useMemo(() => {
    if (state !== "field-invalid") return { email: "", password: "", name: "" };
    return {
      email: isEmail(email) ? "" : copy.missingEmail,
      password: mode === "recovery" || password.length >= 8 ? "" : copy.missingPassword,
      name: mode !== "registration" || displayName.trim() ? "" : copy.missingName,
    };
  }, [copy.missingEmail, copy.missingName, copy.missingPassword, displayName, email, mode, password.length, state]);

  const terminal = [
    "busy",
    "service-failure",
    "success",
    "redirecting",
    "recovery-sent",
  ].includes(state);

  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, [state]);

  useEffect(() => {
    if (!terminal || !userTransitionRef.current) return;
    queueMicrotask(() => statusRef.current?.focus());
  }, [state, terminal]);

  useEffect(() => {
    if (state !== "busy" || !userTransitionRef.current) return;
    const generation = ++jobGenerationRef.current;
    const timeout = window.setTimeout(() => {
      if (jobGenerationRef.current === generation) setState("success");
    }, route.motion === "reduced" ? 0 : 240);
    return () => window.clearTimeout(timeout);
  }, [route.motion, state]);

  useEffect(() => {
    if (state !== "redirecting" || !userTransitionRef.current) return;
    const generation = ++jobGenerationRef.current;
    const timeout = window.setTimeout(() => {
      if (jobGenerationRef.current !== generation) return;
      window.location.assign(
        `/dev/phase5a2/golden/home?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=returning`,
      );
    }, route.motion === "reduced" ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [route.locale, route.motion, route.theme, state]);

  useEffect(() => {
    if (terminal || !focusEmailAfterRenderRef.current) return;
    focusEmailAfterRenderRef.current = false;
    queueMicrotask(() => emailRef.current?.focus());
  }, [terminal]);

  function selectMode(nextMode: AuthMode) {
    jobGenerationRef.current += 1;
    setMode(nextMode);
    setState(nextMode);
  }

  function returnToSignIn() {
    userTransitionRef.current = true;
    focusEmailAfterRenderRef.current = true;
    selectMode("sign-in");
  }

  function clearValidation() {
    if (state === "field-invalid" || state === "invalid-credentials") setState(mode);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidEmail = !isEmail(email);
    const invalidPassword = mode !== "recovery" && password.length < 8;
    const invalidName = mode === "registration" && !displayName.trim();
    if (invalidEmail || invalidPassword || invalidName) {
      userTransitionRef.current = true;
      setState("field-invalid");
      queueMicrotask(() => {
        if (invalidEmail) emailRef.current?.focus();
        else if (invalidName) nameRef.current?.focus();
        else passwordRef.current?.focus();
      });
      return;
    }
    if (mode === "recovery") {
      userTransitionRef.current = true;
      setState("recovery-sent");
      return;
    }
    if (email.trim().toLowerCase() === "offline@tryvit.local") {
      userTransitionRef.current = true;
      setState("service-failure");
      return;
    }
    if (mode === "sign-in" && email.trim().toLowerCase() !== "review@tryvit.local") {
      userTransitionRef.current = true;
      setState("invalid-credentials");
      queueMicrotask(() => emailRef.current?.focus());
      return;
    }
    userTransitionRef.current = true;
    setState("busy");
  }

  if (terminal) {
    const isFailure = state === "service-failure";
    const isRecovery = state === "recovery-sent";
    const isBusy = state === "busy" || state === "redirecting";
    const title = isFailure
      ? copy.serviceTitle
      : isRecovery
        ? copy.recoverySent
        : state === "redirecting"
          ? copy.redirecting
          : state === "busy"
            ? copy.busy
            : copy.success;
    const detail = isFailure
      ? copy.service
      : isRecovery
        ? copy.recoveryDetail
        : state === "busy"
          ? copy.busyDetail
          : copy.successDetail;
    return (
      <section
        aria-busy={isBusy || undefined}
        className={styles.authStatus}
        data-golden-client="authentication-form"
        data-golden-live-state={state}
        ref={(element) => {
          rootRef.current = element;
          statusRef.current = element;
        }}
        tabIndex={-1}
      >
        <div
          aria-atomic="true"
          aria-live={isFailure ? "assertive" : "polite"}
          className={styles.authStatusAnnouncement}
          role={isFailure ? "alert" : "status"}
        >
          <GoldenGlyph name={isFailure ? "unknown" : isBusy ? "confidence" : "decision"} size={32} />
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
        {isFailure || isRecovery ? (
          <Button onClick={returnToSignIn}>{copy.retry}</Button>
        ) : state === "success" ? (
          <Button onClick={() => { userTransitionRef.current = true; setState("redirecting"); }}>
            {copy.home}
          </Button>
        ) : isBusy ? (
          <Button onClick={returnToSignIn}>{copy.retry}</Button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="golden-auth-title"
      className={styles.authPanel}
      data-golden-client="authentication-form"
      data-golden-live-state={state}
      ref={rootRef}
    >
      <div className={styles.authModeTabs} role="group" aria-label={copy.modeLabel}>
        <Button aria-pressed={mode === "sign-in"} onClick={() => selectMode("sign-in")} variant={mode === "sign-in" ? "primary" : "quiet"}>{copy.signIn}</Button>
        <Button aria-pressed={mode === "registration"} onClick={() => selectMode("registration")} variant={mode === "registration" ? "primary" : "quiet"}>{copy.register}</Button>
        <Button aria-pressed={mode === "recovery"} onClick={() => selectMode("recovery")} variant={mode === "recovery" ? "primary" : "quiet"}>{copy.recover}</Button>
      </div>
      <h2 id="golden-auth-title">{mode === "sign-in" ? copy.signIn : mode === "registration" ? copy.register : copy.recover}</h2>
      <form className={styles.authForm} noValidate onSubmit={submit}>
        {state === "field-invalid" && (errors.email || errors.password || errors.name) ? (
          <div className={styles.errorSummary} role="alert">
            <strong>{copy.summary}</strong>
            <ul>
              {errors.email ? <li><a href="#golden-auth-email">{errors.email}</a></li> : null}
              {errors.name ? <li><a href="#golden-auth-name">{errors.name}</a></li> : null}
              {errors.password ? <li><a href="#golden-auth-password">{errors.password}</a></li> : null}
            </ul>
          </div>
        ) : null}
        {state === "invalid-credentials" ? <p className={styles.inlineError} role="alert">{copy.invalid}</p> : null}
        <Input
          autoComplete={mode === "sign-in" ? "username" : "email"}
          error={errors.email || undefined}
          hint={copy.emailHint}
          id="golden-auth-email"
          inputMode="email"
          label={copy.email}
          name="email"
          onChange={(event) => { clearValidation(); setEmail(event.currentTarget.value); }}
          ref={emailRef}
          required
          requiredLabel={copy.required}
          type="email"
          value={email}
        />
        {mode === "registration" ? (
          <Input
            autoComplete="name"
            error={errors.name || undefined}
            id="golden-auth-name"
            label={copy.name}
            name="name"
            onChange={(event) => { clearValidation(); setDisplayName(event.currentTarget.value); }}
            ref={nameRef}
            required
            requiredLabel={copy.required}
            value={displayName}
          />
        ) : null}
        {mode !== "recovery" ? (
          <Input
            autoComplete={mode === "registration" ? "new-password" : "current-password"}
            error={errors.password || undefined}
            hint={copy.passwordHint}
            id="golden-auth-password"
            label={copy.password}
            minLength={8}
            name="password"
            onChange={(event) => { clearValidation(); setPassword(event.currentTarget.value); }}
            ref={passwordRef}
            required
            requiredLabel={copy.required}
            type="password"
            value={password}
          />
        ) : null}
        <Button fullWidth type="submit">
          {mode === "sign-in" ? copy.submitSignIn : mode === "registration" ? copy.submitRegister : copy.submitRecovery}
        </Button>
      </form>
      <p className={styles.authPrivacy}><GoldenGlyph name="confidence" size={20} />{copy.privacy}</p>
    </section>
  );
}
