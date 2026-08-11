"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Field } from "@/design-system/primitives/Field";
import { anchoredPopupStyle } from "@/design-system/primitives/shared/anchored-position";
import { focusElement, modalBoundaryTabStop } from "@/design-system/primitives/shared/dom";
import { isTopOverlay, registerOverlay } from "@/design-system/primitives/shared/overlay-stack";
import { ScopedPortal } from "@/design-system/primitives/shared/portal";
import { useControllableState } from "@/design-system/primitives/shared/controllable-state";

import styles from "./combobox.module.css";

export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
  /** Optional non-empty localized text. Option content is intentionally inert. */
  readonly description?: string;
  readonly disabled?: boolean;
}

interface ComboboxBaseProps {
  readonly label: string;
  readonly options: readonly ComboboxOption[];
  /** A committed option value, or null when no option is committed. */
  readonly value?: string | null;
  /** The initial committed option value, or null when selection starts clear. */
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: string | null, option: ComboboxOption | null) => void;
  readonly inputValue?: string;
  readonly defaultInputValue?: string;
  readonly onInputValueChange?: (value: string) => void;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly filterOption?: (option: ComboboxOption, query: string) => boolean;
  readonly id?: string;
  readonly name?: string;
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly requiredLabel?: string;
  readonly disabled?: boolean;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly announceError?: boolean;
  readonly loading?: boolean;
  /** Visible data-source failure shown in the popup; separate from field validation. */
  readonly loadError?: string;
  readonly loadingMessage: string;
  readonly emptyMessage: string;
  readonly resultsMessage: (count: number) => string;
  readonly className?: string;
  readonly inputClassName?: string;
}

type ComboboxRequiredProps =
  | {
      readonly required: boolean;
      /** Localized browser-validation copy used when no option is committed. */
      readonly requiredSelectionMessage: string;
    }
  | {
      readonly required?: false;
      readonly requiredSelectionMessage?: string;
    };

export type ComboboxProps = ComboboxBaseProps & ComboboxRequiredProps;

function defaultFilter(option: ComboboxOption, query: string): boolean {
  return option.label.toLowerCase().includes(query.trim().toLowerCase());
}

export function Combobox({
  label,
  options,
  value,
  defaultValue = null,
  onValueChange,
  inputValue: controlledInputValue,
  defaultInputValue,
  onInputValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  filterOption = defaultFilter,
  id,
  name,
  placeholder,
  autoComplete = "off",
  required,
  requiredSelectionMessage,
  requiredLabel,
  disabled,
  hint,
  error,
  announceError,
  loading = false,
  loadError,
  loadingMessage,
  emptyMessage,
  resultsMessage,
  className,
  inputClassName,
}: Readonly<ComboboxProps>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;
  const listboxLabelId = `${inputId}-listbox-label`;
  const optionIndexes = useMemo(
    () => new Map(options.map((option, index) => [option.value, index])),
    [options],
  );
  const invalidOptionContract = useMemo(() => {
    const seen = new Set<string>();
    return options.find((option) => {
      if (
        typeof option.value !== "string" ||
        !option.value.trim() ||
        typeof option.label !== "string" ||
        !option.label.trim() ||
        seen.has(option.value)
      )
        return true;
      seen.add(option.value);
      return (
        option.description !== undefined &&
        (typeof option.description !== "string" || !option.description.trim())
      );
    });
  }, [options]);
  const initialSelectedValue = value === undefined ? defaultValue : value;
  const initialSelectedLabel =
    options.find((option) => option.value === initialSelectedValue)?.label ?? "";
  const [selectedValue, setSelectedValue] = useControllableState({
    value,
    defaultValue,
    onChange: (nextValue) => {
      const option =
        nextValue === null ? undefined : options.find((candidate) => candidate.value === nextValue);
      onValueChange?.(nextValue, option ?? null);
    },
  });
  const [inputValue, setInputValue] = useControllableState({
    value: controlledInputValue,
    defaultValue: defaultInputValue ?? initialSelectedLabel,
    onChange: onInputValueChange,
  });
  const selectedOptionLabel = options.find((option) => option.value === selectedValue)?.label ?? "";
  const hasValidSelection = options.some((option) => option.value === selectedValue);
  const lastInvalidSelectionRef = useRef<string | null>(null);
  const lastSelectionRef = useRef({
    label: selectedOptionLabel,
    value: selectedValue,
  });
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const filteredOptions = useMemo(
    () => options.filter((option) => filterOption(option, inputValue)),
    [filterOption, inputValue, options],
  );
  const hasLoadError = loadError !== undefined && loadError !== null;
  const visibleOptions = useMemo(
    () => (loading || hasLoadError ? [] : filteredOptions),
    [filteredOptions, hasLoadError, loading],
  );
  const enabledOptions = useMemo(
    () => visibleOptions.filter((option) => !option.disabled),
    [visibleOptions],
  );
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const effectiveActiveValue = enabledOptions.some((option) => option.value === activeValue)
    ? activeValue
    : (enabledOptions[0]?.value ?? null);
  const [anchor, setAnchor] = useState<HTMLInputElement | null>(null);
  const [, setViewportRevision] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLDivElement>());
  const overlayId = useRef(Symbol("v2-combobox")).current;

  const optionId = useCallback(
    (optionValue: string) => `${inputId}-option-${optionIndexes.get(optionValue) ?? 0}`,
    [inputId, optionIndexes],
  );

  const closePopup = useCallback(() => setOpen(false), [setOpen]);

  const selectOption = useCallback(
    (option: ComboboxOption) => {
      if (option.disabled) return;
      setSelectedValue(option.value);
      setInputValue(option.label);
      setActiveValue(option.value);
      closePopup();
      queueMicrotask(() => anchor?.focus({ preventScroll: true }));
    },
    [anchor, closePopup, setInputValue, setSelectedValue],
  );

  const moveActive = useCallback(
    (delta: number) => {
      if (enabledOptions.length === 0) return;
      const currentIndex = enabledOptions.findIndex(
        (option) => option.value === effectiveActiveValue,
      );
      const nextIndex =
        (((Math.max(currentIndex, 0) + delta) % enabledOptions.length) + enabledOptions.length) %
        enabledOptions.length;
      const nextValue = enabledOptions[nextIndex].value;
      setActiveValue(nextValue);
      queueMicrotask(() => {
        optionRefs.current.get(nextValue)?.scrollIntoView?.({ block: "nearest" });
      });
    },
    [effectiveActiveValue, enabledOptions],
  );

  const openPopup = useCallback(
    (preferred: "first" | "last" = "first") => {
      if (disabled) return;
      const next = preferred === "last" ? enabledOptions.at(-1) : enabledOptions[0];
      setActiveValue(next?.value ?? null);
      setOpen(true);
    },
    [disabled, enabledOptions, setOpen],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (open) moveActive(1);
      else openPopup("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (open) moveActive(-1);
      else openPopup("last");
    } else if (event.key === "Enter" && open && effectiveActiveValue) {
      const activeOption = enabledOptions.find((option) => option.value === effectiveActiveValue);
      if (activeOption) {
        event.preventDefault();
        selectOption(activeOption);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closePopup();
    } else if (
      event.key === "Tab" &&
      open &&
      !event.defaultPrevented &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const boundaryDestination = anchor
        ? modalBoundaryTabStop(anchor, event.shiftKey, popupRef.current)
        : null;
      closePopup();
      if (boundaryDestination) {
        event.preventDefault();
        queueMicrotask(() => focusElement(boundaryDestination, { preventScroll: false }));
      }
    }
  };

  useEffect(() => {
    const previous = lastSelectionRef.current;
    if (previous.value === selectedValue && previous.label === selectedOptionLabel) return;
    lastSelectionRef.current = { value: selectedValue, label: selectedOptionLabel };
    if (controlledInputValue === undefined) setInputValue(selectedOptionLabel);
  }, [controlledInputValue, selectedOptionLabel, selectedValue, setInputValue]);

  useEffect(() => {
    if (selectedValue === null || hasValidSelection) {
      lastInvalidSelectionRef.current = null;
      return;
    }
    if (lastInvalidSelectionRef.current === selectedValue) return;

    lastInvalidSelectionRef.current = selectedValue;
    lastSelectionRef.current = { label: "", value: null };
    setActiveValue(null);
    if (controlledInputValue === undefined) setInputValue("");
    setSelectedValue(null);
  }, [controlledInputValue, hasValidSelection, selectedValue, setInputValue, setSelectedValue]);

  useEffect(() => {
    if (!anchor) return;
    const validationMessage =
      required && !disabled && !hasValidSelection ? requiredSelectionMessage : "";
    anchor.setCustomValidity(validationMessage ?? "");
    return () => anchor.setCustomValidity("");
  }, [anchor, disabled, hasValidSelection, required, requiredSelectionMessage]);

  useEffect(() => {
    if (!open || !anchor) return;
    const unregister = registerOverlay(overlayId);
    const ownerDocument = anchor.ownerDocument;
    const visualViewport = ownerDocument.defaultView?.visualViewport;
    const repositionForVisualViewport = () => {
      setViewportRevision((revision) => revision + 1);
    };
    const handleOutsidePointer = (event: PointerEvent) => {
      if (event.button !== 0 || !isTopOverlay(overlayId)) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchor.contains(target) || popupRef.current?.contains(target)) return;
      closePopup();
    };
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && popupRef.current?.contains(target)) return;
      closePopup();
    };
    ownerDocument.addEventListener("pointerdown", handleOutsidePointer, true);
    ownerDocument.addEventListener("scroll", handleScroll, true);
    ownerDocument.defaultView?.addEventListener("resize", closePopup);
    visualViewport?.addEventListener("resize", repositionForVisualViewport);
    visualViewport?.addEventListener("scroll", repositionForVisualViewport);
    return () => {
      unregister();
      ownerDocument.removeEventListener("pointerdown", handleOutsidePointer, true);
      ownerDocument.removeEventListener("scroll", handleScroll, true);
      ownerDocument.defaultView?.removeEventListener("resize", closePopup);
      visualViewport?.removeEventListener("resize", repositionForVisualViewport);
      visualViewport?.removeEventListener("scroll", repositionForVisualViewport);
    };
  }, [anchor, closePopup, open, overlayId]);

  const resolvedResultsMessage = resultsMessage(filteredOptions.length);
  const popupStatus =
    loadError ??
    (loading
      ? loadingMessage
      : filteredOptions.length === 0
        ? emptyMessage
        : resolvedResultsMessage);

  if (invalidOptionContract) {
    throw new Error(
      "Combobox option values must be non-empty and unique, and labels/descriptions must be non-empty localized text; React content is not supported.",
    );
  }
  if (typeof label !== "string" || !label.trim()) {
    throw new Error("Combobox label must be non-empty localized text.");
  }
  if (
    typeof loadingMessage !== "string" ||
    !loadingMessage.trim() ||
    typeof emptyMessage !== "string" ||
    !emptyMessage.trim() ||
    (loadError !== undefined && (typeof loadError !== "string" || !loadError.trim())) ||
    typeof resolvedResultsMessage !== "string" ||
    !resolvedResultsMessage.trim()
  ) {
    throw new Error(
      "Combobox status messages must be non-empty localized text; React content is not supported.",
    );
  }
  if (value === "" || defaultValue === "") {
    throw new Error(
      "Combobox value and defaultValue must use null, not an empty-string sentinel, when no option is selected.",
    );
  }
  if (required && !requiredSelectionMessage?.trim()) {
    throw new Error(
      "Combobox requiredSelectionMessage must be non-empty when selection is required.",
    );
  }

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-ds-component="combobox"
    >
      <Field
        id={inputId}
        label={label}
        hint={hint}
        error={error}
        required={required}
        requiredLabel={requiredLabel}
        announceError={announceError}
      >
        {(contract) => (
          <input
            {...contract}
            ref={setAnchor}
            role="combobox"
            type="text"
            value={inputValue}
            placeholder={placeholder}
            autoComplete={autoComplete}
            required={required}
            disabled={disabled}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={
              open && effectiveActiveValue ? optionId(effectiveActiveValue) : undefined
            }
            aria-busy={loading || undefined}
            className={[styles.input, inputClassName].filter(Boolean).join(" ")}
            data-ds-part="input"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setInputValue(event.currentTarget.value);
              if (selectedValue !== null) {
                lastSelectionRef.current = { label: "", value: null };
                setSelectedValue(null);
              }
              setActiveValue(null);
              if (!open) openPopup("first");
            }}
            onClick={() => {
              if (!open) openPopup("first");
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              queueMicrotask(() => {
                const activeElement = anchor?.ownerDocument.activeElement;
                if (
                  activeElement &&
                  activeElement !== anchor &&
                  !popupRef.current?.contains(activeElement)
                ) {
                  closePopup();
                }
              });
            }}
          />
        )}
      </Field>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={hasValidSelection ? (selectedValue ?? "") : ""}
          disabled={disabled}
        />
      ) : null}
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.visuallyHidden}
      >
        {open ? popupStatus : null}
      </div>
      {open ? (
        <ScopedPortal anchor={anchor}>
          <div
            ref={popupRef}
            className={styles.popup}
            data-ds-component="combobox"
            data-ds-part="content"
            data-state="open"
            style={anchoredPopupStyle(anchor, { matchWidth: true })}
          >
            <span className={styles.visuallyHidden} id={listboxLabelId}>
              {label}
            </span>
            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={listboxLabelId}
              aria-busy={loading || undefined}
              className={styles.listbox}
              data-ds-part="listbox"
            >
              {visibleOptions.map((option) => (
                <div
                  key={option.value}
                  ref={(node) => {
                    if (node) optionRefs.current.set(option.value, node);
                    else optionRefs.current.delete(option.value);
                  }}
                  id={optionId(option.value)}
                  role="option"
                  aria-selected={option.value === selectedValue}
                  aria-disabled={option.disabled || undefined}
                  className={styles.option}
                  data-active={option.value === effectiveActiveValue || undefined}
                  data-ds-part="option"
                  onPointerMove={() => {
                    if (!option.disabled) setActiveValue(option.value);
                  }}
                  onPointerDown={(event) => {
                    if (event.button === 0) event.preventDefault();
                  }}
                  onClick={() => selectOption(option)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.description ? (
                    <span className={styles.optionDescription}>{option.description}</span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className={styles.popupStatus} aria-hidden="true">
              {popupStatus}
            </div>
          </div>
        </ScopedPortal>
      ) : null}
    </div>
  );
}
