"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DialogHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import {
  adjacentDomTabStop,
  firstFocusable,
  focusElement,
  isTabbableElement,
  programmaticTabStopCandidates,
  tabbableElements,
  type TabbableElement,
} from "@/design-system/primitives/shared/dom";
import {
  isTopOverlay,
  registerOverlay,
} from "@/design-system/primitives/shared/overlay-stack";
import { ScopedPortal } from "@/design-system/primitives/shared/portal";
import { lockDocumentScroll } from "@/design-system/primitives/shared/scroll-lock";

import styles from "./overlay.module.css";

export type OverlayCloseReason =
  | "close-button"
  | "escape"
  | "outside-pointer"
  | "programmatic";

export interface ModalOverlayProps
  extends Omit<
    DialogHTMLAttributes<HTMLDialogElement>,
    | "aria-label"
    | "aria-labelledby"
    | "children"
    | "onCancel"
    | "onClose"
    | "onPointerCancel"
    | "onPointerDown"
    | "onPointerUp"
    | "open"
    | "role"
    | "title"
  > {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly closeLabel: string;
  readonly onOpenChange: (open: boolean, reason: OverlayCloseReason) => void;
  readonly dismissible?: boolean;
  readonly initialFocus?: "heading" | "first-interactive";
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly restoreFocusRef?: RefObject<HTMLElement | null>;
  readonly semanticRole?: "alertdialog" | "dialog";
  readonly contentClassName?: string;
}

interface ModalOverlayInnerProps extends Omit<ModalOverlayProps, "open"> {
  readonly kind: "dialog" | "sheet";
  readonly invoker: TabbableElement;
}

function isBackdropPoint(
  dialog: HTMLDialogElement,
  event: ReactPointerEvent<HTMLDialogElement>,
): boolean {
  if (event.target !== dialog) return false;
  const rectangle = dialog.getBoundingClientRect();
  return event.clientX < rectangle.left || event.clientX > rectangle.right ||
    event.clientY < rectangle.top || event.clientY > rectangle.bottom;
}

function modalTabbableElements(
  dialog: HTMLDialogElement,
  backwards: boolean,
): readonly TabbableElement[] {
  return tabbableElements(dialog, backwards).filter((element) =>
    element.closest<HTMLDialogElement>("dialog[open]") === dialog,
  );
}

function modalProgrammaticTabStopCandidates(
  dialog: HTMLDialogElement,
): readonly TabbableElement[] {
  return programmaticTabStopCandidates(dialog).filter((element) =>
    element.closest<HTMLDialogElement>("dialog[open]") === dialog,
  );
}

/** @internal Runtime guard for focus scopes the Phase 5A.1b contract does not admit. */
export function assertSupportedModalFocusScope(dialog: HTMLDialogElement): void {
  const descendants = [...dialog.querySelectorAll<HTMLElement | SVGElement>("*")];
  if (
    dialog.tabIndex > 0 ||
    descendants.some((element) => element.hasAttribute("tabindex") && element.tabIndex > 0)
  ) {
    throw new Error("Dialog and Sheet do not accept positive tabIndex descendants.");
  }
  if (
    descendants.some(
      (element) =>
        (element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
          (element.localName.includes("-") || element.hasAttribute("is"))) ||
        element.shadowRoot,
    )
  ) {
    throw new Error(
      "Dialog and Sheet do not accept consumer custom-element or shadow-root focus scopes.",
    );
  }
}

function ModalOverlayInner({
  kind,
  title,
  description,
  children,
  footer,
  closeLabel,
  onOpenChange,
  dismissible = true,
  initialFocus = "heading",
  initialFocusRef,
  restoreFocusRef,
  semanticRole = "dialog",
  contentClassName,
  className,
  onFocusCapture,
  onKeyDown,
  invoker,
  ...props
}: Readonly<ModalOverlayInnerProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const backdropPointerRef = useRef<number | null>(null);
  const unmountingRef = useRef(false);
  const overlayId = useRef(Symbol("v2-modal-overlay")).current;
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => registerOverlay(overlayId), [overlayId]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // React Strict Mode replays setup after an intentional cleanup. Re-arm the
    // live instance so a later native/programmatic close is not mistaken for
    // that cleanup close.
    unmountingRef.current = false;
    const explicitRestoreTarget = restoreFocusRef?.current;
    assertSupportedModalFocusScope(dialog);
    if (!dialog.open) dialog.showModal();
    const unlock = lockDocumentScroll(dialog.ownerDocument);
    queueMicrotask(() => {
      if (!dialog.open) return;
      const requested = initialFocusRef?.current;
      const containedRequest = requested && dialog.contains(requested)
        ? requested
        : null;
      const fallback = initialFocus === "first-interactive"
        ? firstFocusable(dialog)
        : titleRef.current;
      focusElement(containedRequest ?? fallback ?? firstFocusable(dialog));
    });

    return () => {
      unlock();
      unmountingRef.current = true;
      if (dialog.open) dialog.close();
      const restoreTarget = explicitRestoreTarget ?? invoker;
      queueMicrotask(() => focusElement(restoreTarget));
    };
  }, [initialFocus, initialFocusRef, invoker, restoreFocusRef]);

  const requestClose = useCallback(
    (reason: OverlayCloseReason) => {
      onOpenChange(false, reason);
    },
    [onOpenChange],
  );

  if (!closeLabel.trim()) {
    throw new Error("Overlay closeLabel must be a non-empty visible accessible name.");
  }

  return (
    <dialog
      {...props}
      ref={dialogRef}
      role={semanticRole}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={[
        styles.overlay,
        kind === "sheet" ? styles.sheet : styles.dialog,
        className,
      ].filter(Boolean).join(" ")}
      data-design-system="v2"
      data-ds-component={kind}
      data-state="open"
      onFocusCapture={(event) => {
        onFocusCapture?.(event);
        assertSupportedModalFocusScope(event.currentTarget);
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDialogElement>) => {
        onKeyDown?.(event);
        if (
          event.defaultPrevented ||
          event.key !== "Tab" ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          !isTopOverlay(overlayId)
        ) {
          return;
        }

        const dialog = event.currentTarget;
        assertSupportedModalFocusScope(dialog);
        const candidates = modalTabbableElements(dialog, event.shiftKey);
        const first = candidates[0];
        const last = candidates.at(-1);
        if (!first || !last) return;

        const activeElement = dialog.ownerDocument.activeElement;
        const activeIndex = activeElement instanceof Element
          ? candidates.indexOf(activeElement as TabbableElement)
          : -1;
        const adjacentFromProgrammaticFocus = activeIndex < 0 &&
            activeElement instanceof Element &&
            dialog.contains(activeElement)
          ? adjacentDomTabStop(
            activeElement,
            modalProgrammaticTabStopCandidates(dialog),
            event.shiftKey,
          )
          : null;
        const destination = activeIndex < 0
          ? adjacentFromProgrammaticFocus ?? (event.shiftKey ? last : first)
          : event.shiftKey && activeIndex === 0
            ? last
            : !event.shiftKey && activeIndex === candidates.length - 1
              ? first
              : null;
        if (!destination) return;

        event.preventDefault();
        event.stopPropagation();
        focusElement(destination, { preventScroll: false });
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (dismissible && isTopOverlay(overlayId)) requestClose("escape");
      }}
      onPointerDown={(event) => {
        backdropPointerRef.current = isTopOverlay(overlayId) &&
            event.button === 0 &&
            isBackdropPoint(event.currentTarget, event)
          ? event.pointerId
          : null;
      }}
      onPointerUp={(event) => {
        const startedOutside = backdropPointerRef.current === event.pointerId;
        backdropPointerRef.current = null;
        if (
          dismissible &&
          isTopOverlay(overlayId) &&
          event.button === 0 &&
          startedOutside &&
          isBackdropPoint(event.currentTarget, event)
        ) {
          requestClose("outside-pointer");
        }
      }}
      onPointerCancel={() => {
        backdropPointerRef.current = null;
      }}
      onClose={() => {
        if (!unmountingRef.current) requestClose("programmatic");
      }}
    >
      <header className={styles.header}>
        <h2
          className={styles.title}
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
        >
          {title}
        </h2>
        <button
          className={styles.close}
          type="button"
          data-ds-part="close"
          onClick={() => requestClose("close-button")}
        >
          {closeLabel}
        </button>
      </header>
      {description ? (
        <div className={styles.description} id={descriptionId}>
          {description}
        </div>
      ) : null}
      <div
        className={[styles.content, contentClassName].filter(Boolean).join(" ")}
        data-ds-part="content"
      >
        {children}
      </div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      <div
        className={styles.portalHost}
        data-ds-overlay-host=""
        data-ds-part="portal-host"
      />
      <span
        className={styles.focusGuard}
        data-ds-focus-guard="end"
        onFocus={() => {
          const dialog = dialogRef.current;
          if (!dialog || !isTopOverlay(overlayId)) return;
          focusElement(modalTabbableElements(dialog, false)[0], {
            preventScroll: false,
          });
        }}
        tabIndex={0}
      />
    </dialog>
  );
}

function ModalOverlay({
  kind,
  ...props
}: Readonly<Omit<ModalOverlayProps, "open"> & { kind: "dialog" | "sheet" }>) {
  const [scopeAnchor, setScopeAnchor] = useState<TabbableElement | null>(null);

  useLayoutEffect(() => {
    const activeElement = document.activeElement;
    const nextAnchor = isTabbableElement(activeElement) ? activeElement : document.body;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setScopeAnchor(nextAnchor);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!scopeAnchor) return null;
  return (
    <ScopedPortal anchor={scopeAnchor}>
      <ModalOverlayInner {...props} kind={kind} invoker={scopeAnchor} />
    </ScopedPortal>
  );
}

export function Dialog({ open, ...props }: Readonly<ModalOverlayProps>) {
  if (!open) return null;
  if (!props.closeLabel.trim()) {
    throw new Error("Dialog closeLabel must be a non-empty visible accessible name.");
  }
  return <ModalOverlay {...props} kind="dialog" />;
}

export function Sheet({ open, ...props }: Readonly<ModalOverlayProps>) {
  if (!open) return null;
  if (!props.closeLabel.trim()) {
    throw new Error("Sheet closeLabel must be a non-empty visible accessible name.");
  }
  return <ModalOverlay {...props} kind="sheet" />;
}
