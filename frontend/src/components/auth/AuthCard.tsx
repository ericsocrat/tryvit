"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from "lucide-react";
import {
  forwardRef,
  useState,
  type ChangeEventHandler,
  type ReactNode,
} from "react";
import styles from "./AuthExperience.module.css";

interface AuthCardProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <main id="main-content" className={styles.authSurface} aria-labelledby="auth-title">
      <header>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id="auth-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
      </header>
      {children}
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </main>
  );
}

type AuthStatusKind = "error" | "success" | "info";

interface AuthStatusProps {
  readonly kind: AuthStatusKind;
  readonly children: ReactNode;
  readonly id?: string;
}

const STATUS_ICON: Readonly<Record<AuthStatusKind, typeof AlertCircle>> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export const AuthStatus = forwardRef<HTMLDivElement, AuthStatusProps>(
  function AuthStatus({ kind, children, id }, ref) {
    const Icon = STATUS_ICON[kind];
    const kindClass =
      kind === "error"
        ? styles.statusError
        : kind === "success"
          ? styles.statusSuccess
          : styles.statusInfo;

    return (
      <div
        ref={ref}
        id={id}
        className={`${styles.status} ${kindClass}`}
        role={kind === "error" ? "alert" : "status"}
        aria-live={kind === "error" ? "assertive" : "polite"}
        tabIndex={-1}
      >
        <Icon size={17} aria-hidden="true" />
        <span>{children}</span>
      </div>
    );
  },
);

interface PasswordFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly autoComplete: "current-password" | "new-password";
  readonly placeholder: string;
  readonly showLabel: string;
  readonly hideLabel: string;
  readonly help?: string;
  readonly error?: string | null;
  readonly minLength?: number;
  readonly required?: boolean;
  readonly disabled?: boolean;
}

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  showLabel,
  hideLabel,
  help,
  error,
  minLength,
  required = true,
  disabled = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const descriptionId = error ? `${id}-error` : help ? `${id}-help` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          minLength={minLength}
          aria-describedby={descriptionId}
          aria-invalid={Boolean(error)}
          value={value}
          onChange={onChange}
          className={`${styles.input} ${styles.passwordInput}`}
          placeholder={placeholder}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          className={styles.passwordToggle}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className={styles.helper}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export { styles as authStyles };
