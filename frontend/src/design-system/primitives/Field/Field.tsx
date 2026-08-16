import {
  forwardRef,
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { IndeterminateCheckbox } from "./IndeterminateCheckbox.client";
import styles from "./field.module.css";

export interface FieldControlContract {
  readonly id: string;
  readonly required?: boolean;
  readonly "aria-invalid"?: true;
  readonly "aria-describedby"?: string;
  readonly "aria-errormessage"?: string;
}

interface FieldCopyProps {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly requiredLabel?: string;
  readonly announceError?: boolean;
}

function assertFieldLabelCopy(label: string, requiredLabel?: string): void {
  if (typeof label !== "string" || !label.trim()) {
    throw new TypeError("Field label must be non-empty localized text.");
  }
  if (requiredLabel !== undefined && (typeof requiredLabel !== "string" || !requiredLabel.trim())) {
    throw new TypeError("Field requiredLabel must be non-empty localized text when supplied.");
  }
}

export interface FieldProps
  extends FieldCopyProps, Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  readonly id?: string;
  readonly describedBy?: string;
  readonly children: (contract: FieldControlContract) => ReactNode;
}

function mergeIds(...ids: readonly (string | undefined)[]): string | undefined {
  const merged = ids.flatMap((id) => id?.trim().split(/\s+/u) ?? []).filter(Boolean);
  return merged.length > 0 ? [...new Set(merged)].join(" ") : undefined;
}

function useFieldContract(
  id: string | undefined,
  describedBy: string | undefined,
  hint: ReactNode,
  error: ReactNode,
  required: boolean | undefined,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return {
    controlId,
    hintId,
    errorId,
    contract: {
      id: controlId,
      required: required || undefined,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": mergeIds(describedBy, hintId, errorId),
      "aria-errormessage": errorId,
    } satisfies FieldControlContract,
  } as const;
}

function FieldMessages({
  hint,
  error,
  hintId,
  errorId,
  announceError,
}: Readonly<{
  hint?: ReactNode;
  error?: ReactNode;
  hintId?: string;
  errorId?: string;
  announceError?: boolean;
}>) {
  return (
    <div className={styles.messages}>
      {hint ? (
        <div className={styles.hint} id={hintId}>
          {hint}
        </div>
      ) : null}
      {error ? (
        <div className={styles.error} id={errorId} role={announceError ? "alert" : undefined}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({
  controlId,
  label,
  required,
  requiredLabel,
}: Readonly<{
  controlId: string;
  label: string;
  required?: boolean;
  requiredLabel?: string;
}>) {
  return (
    <label className={styles.label} htmlFor={controlId}>
      <span>{label}</span>
      {required && requiredLabel ? <span className={styles.required}>{requiredLabel}</span> : null}
    </label>
  );
}

/** Generic server-compatible field composition with a guaranteed label contract. */
export function Field({
  id,
  describedBy,
  label,
  hint,
  error,
  required,
  requiredLabel,
  announceError,
  children,
  className,
  ...props
}: Readonly<FieldProps>) {
  assertFieldLabelCopy(label, requiredLabel);
  const field = useFieldContract(id, describedBy, hint, error, required);
  return (
    <div
      {...props}
      className={[styles.field, className].filter(Boolean).join(" ")}
      data-ds-component="field"
    >
      <FieldLabel
        controlId={field.controlId}
        label={label}
        required={required}
        requiredLabel={requiredLabel}
      />
      {children(field.contract)}
      <FieldMessages
        hint={hint}
        error={error}
        hintId={field.hintId}
        errorId={field.errorId}
        announceError={announceError}
      />
    </div>
  );
}

interface SharedControlProps extends FieldCopyProps {
  readonly containerClassName?: string;
  readonly controlClassName?: string;
}

export interface InputProps
  extends
    SharedControlProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "className" | "required" | "size"> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    required,
    requiredLabel,
    announceError,
    containerClassName,
    controlClassName,
    id,
    "aria-describedby": describedBy,
    "aria-invalid": ariaInvalid,
    ...props
  },
  ref,
) {
  return (
    <Field
      id={id}
      describedBy={describedBy}
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
      announceError={announceError}
      className={containerClassName}
    >
      {(contract) => (
        <input
          {...props}
          {...contract}
          ref={ref}
          required={required}
          aria-invalid={error ? true : ariaInvalid}
          className={[styles.control, controlClassName].filter(Boolean).join(" ")}
          data-ds-component="input"
          data-ds-part="control"
        />
      )}
    </Field>
  );
});

export interface TextareaProps
  extends
    SharedControlProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "children" | "required"> {
  readonly count?: Readonly<{ current: number; maximum: number; label: string }>;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    required,
    requiredLabel,
    announceError,
    count,
    containerClassName,
    controlClassName,
    id,
    "aria-describedby": describedBy,
    "aria-invalid": ariaInvalid,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const countId = count ? `${resolvedId}-count` : undefined;
  if (count !== undefined && (typeof count.label !== "string" || !count.label.trim())) {
    throw new TypeError("Textarea count label must be non-empty localized text when supplied.");
  }
  return (
    <Field
      id={resolvedId}
      describedBy={mergeIds(describedBy, countId)}
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
      announceError={announceError}
      className={containerClassName}
    >
      {(contract) => (
        <>
          <textarea
            {...props}
            {...contract}
            ref={ref}
            required={required}
            aria-invalid={error ? true : ariaInvalid}
            className={[styles.control, styles.textarea, controlClassName]
              .filter(Boolean)
              .join(" ")}
            data-ds-component="textarea"
            data-ds-part="control"
          />
          {count ? (
            <div className={styles.count} id={countId}>
              <span>{count.label}</span>
              <span>
                {count.current}/{count.maximum}
              </span>
            </div>
          ) : null}
        </>
      )}
    </Field>
  );
});

export interface SelectProps
  extends
    SharedControlProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "required" | "size"> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    required,
    requiredLabel,
    announceError,
    containerClassName,
    controlClassName,
    id,
    "aria-describedby": describedBy,
    "aria-invalid": ariaInvalid,
    children,
    ...props
  },
  ref,
) {
  return (
    <Field
      id={id}
      describedBy={describedBy}
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
      announceError={announceError}
      className={containerClassName}
    >
      {(contract) => (
        <select
          {...props}
          {...contract}
          ref={ref}
          required={required}
          aria-invalid={error ? true : ariaInvalid}
          className={[styles.control, styles.select, controlClassName].filter(Boolean).join(" ")}
          data-ds-component="select"
          data-ds-part="control"
        >
          {children}
        </select>
      )}
    </Field>
  );
});

export interface CheckboxProps
  extends
    SharedControlProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      "children" | "className" | "required" | "size" | "type"
    > {
  readonly indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    hint,
    error,
    required,
    requiredLabel,
    announceError,
    indeterminate = false,
    containerClassName,
    controlClassName,
    id,
    "aria-describedby": describedBy,
    "aria-invalid": ariaInvalid,
    ...props
  },
  ref,
) {
  assertFieldLabelCopy(label, requiredLabel);
  const field = useFieldContract(id, describedBy, hint, error, required);
  const inputProps = {
    ...props,
    ...field.contract,
    required,
    "aria-invalid": error ? true : ariaInvalid,
    className: [styles.checkbox, controlClassName].filter(Boolean).join(" "),
    "data-ds-component": "checkbox",
    "data-ds-part": "control",
  } as const;
  return (
    <div
      className={[styles.choiceField, containerClassName].filter(Boolean).join(" ")}
      data-ds-component="field"
    >
      <label className={styles.choiceLabel} htmlFor={field.controlId}>
        <IndeterminateCheckbox {...inputProps} ref={ref} indeterminate={indeterminate} />
        <span>
          {label}
          {required && requiredLabel ? (
            <span className={styles.required}>{requiredLabel}</span>
          ) : null}
        </span>
      </label>
      <FieldMessages
        hint={hint}
        error={error}
        hintId={field.hintId}
        errorId={field.errorId}
        announceError={announceError}
      />
    </div>
  );
});

export interface SwitchProps
  extends
    SharedControlProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      "children" | "className" | "required" | "role" | "size" | "type"
    > {
  readonly stateLabel?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    hint,
    error,
    required,
    requiredLabel,
    announceError,
    stateLabel,
    containerClassName,
    controlClassName,
    id,
    "aria-describedby": describedBy,
    "aria-invalid": ariaInvalid,
    ...props
  },
  ref,
) {
  assertFieldLabelCopy(label, requiredLabel);
  if (stateLabel !== undefined && (typeof stateLabel !== "string" || !stateLabel.trim())) {
    throw new TypeError("Switch stateLabel must be non-empty localized text when supplied.");
  }
  const field = useFieldContract(id, describedBy, hint, error, required);
  return (
    <div
      className={[styles.choiceField, containerClassName].filter(Boolean).join(" ")}
      data-ds-component="field"
    >
      <label className={styles.switchLabel} htmlFor={field.controlId}>
        <span>
          {label}
          {required && requiredLabel ? (
            <span className={styles.required}>{requiredLabel}</span>
          ) : null}
        </span>
        <span className={styles.switchControl}>
          <input
            {...props}
            {...field.contract}
            ref={ref}
            type="checkbox"
            role="switch"
            required={required}
            aria-invalid={error ? true : ariaInvalid}
            className={[styles.switchInput, controlClassName].filter(Boolean).join(" ")}
            data-ds-component="switch"
            data-ds-part="control"
          />
          {stateLabel ? (
            <span className={styles.stateLabel} aria-hidden="true">
              {stateLabel}
            </span>
          ) : null}
        </span>
      </label>
      <FieldMessages
        hint={hint}
        error={error}
        hintId={field.hintId}
        errorId={field.errorId}
        announceError={announceError}
      />
    </div>
  );
});
