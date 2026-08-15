"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Icon, type IconName } from "@/design-system/icons/Icon";
import { anchoredPopupStyle } from "@/design-system/primitives/shared/anchored-position";
import { adjacentTabStop, focusElement } from "@/design-system/primitives/shared/dom";
import {
  claimOverlayPointerDismissal,
  isOverlayPointerDismissalClaimed,
  isTopOverlay,
  registerOverlay,
} from "@/design-system/primitives/shared/overlay-stack";
import { ScopedPortal } from "@/design-system/primitives/shared/portal";
import { useControllableState } from "@/design-system/primitives/shared/controllable-state";

import styles from "./menu.module.css";

interface BaseMenuEntry {
  readonly id: string;
  /** Localized inert copy. Menu rows cannot contain nested interactive descendants. */
  readonly label: string;
  readonly textValue: string;
  readonly disabled?: boolean;
}

export interface MenuAction extends BaseMenuEntry {
  readonly type?: "action";
  readonly onSelect: () => void;
}

export interface MenuCheckbox extends BaseMenuEntry {
  readonly type: "checkbox";
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly closeOnSelect?: boolean;
}

export interface MenuSeparator {
  readonly id: string;
  readonly type: "separator";
}

export type MenuEntry = MenuAction | MenuCheckbox | MenuSeparator;

export interface MenuProps {
  /** Visible, localized trigger text. Interactive descendants are intentionally unsupported. */
  readonly triggerLabel: string;
  /** Optional registry-backed artwork rendered inert beside the visible label. */
  readonly triggerIcon?: IconName;
  readonly entries: readonly MenuEntry[];
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly className?: string;
}

function isInteractiveEntry(entry: MenuEntry): entry is Exclude<MenuEntry, MenuSeparator> {
  return entry.type !== "separator";
}

function normalizedTypeahead(value: string): string {
  return value.trim().toLowerCase();
}

export function Menu({
  triggerLabel,
  triggerIcon,
  entries,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
}: Readonly<MenuProps>) {
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const forceViewportRevision = useReducer((revision: number) => revision + 1, 0)[1];
  const [activeIndex, setActiveIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusOnOpenRef = useRef<"first" | "last">("first");
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayId = useRef(Symbol("v2-menu")).current;
  const menuId = useId();
  const triggerId = useId();
  const interactiveEntries = useMemo(() => entries.filter(isInteractiveEntry), [entries]);
  const invalidEntry = useMemo(() => {
    const seen = new Set<string>();
    return entries.find((entry) => {
      if (!entry.id.trim() || seen.has(entry.id)) return true;
      seen.add(entry.id);
      return (
        entry.type !== "separator" &&
        (typeof entry.label !== "string" || !entry.label.trim() || !entry.textValue.trim())
      );
    });
  }, [entries]);

  const resetTypeahead = useCallback(() => {
    typeaheadRef.current = "";
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
  }, []);

  const focusEntry = useCallback(
    (index: number) => {
      const count = interactiveEntries.length;
      if (count === 0) return;
      const wrapped = ((index % count) + count) % count;
      setActiveIndex(wrapped);
      focusElement(itemRefs.current.get(interactiveEntries[wrapped].id));
    },
    [interactiveEntries],
  );

  const closeMenu = useCallback(
    (restore: boolean) => {
      resetTypeahead();
      setOpen(false);
      if (restore) queueMicrotask(() => focusElement(anchor));
    },
    [anchor, resetTypeahead, setOpen],
  );

  useEffect(() => {
    if (!open) return;
    const unregister = registerOverlay(overlayId);
    return unregister;
  }, [open, overlayId]);

  useEffect(() => {
    if (!open) {
      focusOnOpenRef.current = "first";
      return;
    }
    const focusOnOpen = focusOnOpenRef.current;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      focusOnOpenRef.current = "first";
      const items = [...itemRefs.current.values()];
      focusElement(focusOnOpen === "last" ? items.at(-1) : items[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !anchor) return;
    const activeElement = anchor.ownerDocument.activeElement;
    const focusedIndex = interactiveEntries.findIndex(
      (entry) => itemRefs.current.get(entry.id) === activeElement,
    );
    if (focusedIndex >= 0 && focusedIndex !== activeIndex) {
      setActiveIndex(focusedIndex);
    }
  }, [activeIndex, anchor, interactiveEntries, open]);

  useEffect(() => {
    if (!open || !anchor) return;
    const ownerDocument = anchor.ownerDocument;
    const visualViewport = ownerDocument.defaultView?.visualViewport;
    const repositionForVisualViewport = () => {
      forceViewportRevision();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        isOverlayPointerDismissalClaimed(event) ||
        event.button !== 0 ||
        !isTopOverlay(overlayId)
      ) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchor.contains(target) || contentRef.current?.contains(target)) return;
      claimOverlayPointerDismissal(event);
      closeMenu(false);
    };
    const onScroll = (event: Event) => {
      if (contentRef.current?.contains(event.target as Node)) return;
      closeMenu(false);
    };
    const closeMenuOnResize = () => closeMenu(false);
    ownerDocument.addEventListener("pointerdown", onPointerDown, true);
    ownerDocument.addEventListener("scroll", onScroll, true);
    ownerDocument.defaultView?.addEventListener("resize", closeMenuOnResize);
    visualViewport?.addEventListener("resize", repositionForVisualViewport);
    visualViewport?.addEventListener("scroll", repositionForVisualViewport);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
      ownerDocument.removeEventListener("scroll", onScroll, true);
      ownerDocument.defaultView?.removeEventListener("resize", closeMenuOnResize);
      visualViewport?.removeEventListener("resize", repositionForVisualViewport);
      visualViewport?.removeEventListener("scroll", repositionForVisualViewport);
    };
  }, [anchor, closeMenu, forceViewportRevision, open, overlayId]);

  useEffect(() => {
    if (!open) resetTypeahead();
  }, [open, resetTypeahead]);

  useEffect(() => resetTypeahead, [resetTypeahead]);

  const activateEntry = useCallback(
    (entry: Exclude<MenuEntry, MenuSeparator>) => {
      if (entry.disabled) return;
      let shouldClose = true;
      if (entry.type === "checkbox") {
        entry.onCheckedChange(!entry.checked);
        shouldClose = entry.closeOnSelect ?? false;
      } else {
        entry.onSelect();
      }
      if (shouldClose) closeMenu(true);
    },
    [closeMenu],
  );

  const handleMenuTab = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      // The menu is portalled, so DOM order cannot carry focus to the page-level
      // tab stop after the trigger. Reproduce that destination when addressable.
      const next = anchor ? adjacentTabStop(anchor, event.shiftKey, contentRef.current) : null;
      event.preventDefault();
      if (next) {
        closeMenu(false);
        queueMicrotask(() => focusElement(next, { preventScroll: false }));
        return;
      }
      // Browser chrome is not script-addressable. Re-anchor on the trigger; the
      // next native Tab can then leave the document in the requested direction.
      focusElement(anchor);
      closeMenu(false);
    },
    [anchor, closeMenu],
  );

  const handleMenuTypeahead = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key.length !== 1 ||
        event.key === " " ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) return;
      const character = normalizedTypeahead(event.key);
      const repeatedCharacter =
        typeaheadRef.current.length > 0 &&
        [...typeaheadRef.current].every((value) => value === character);
      typeaheadRef.current = repeatedCharacter
        ? character
        : `${typeaheadRef.current}${character}`;
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = "";
        typeaheadTimerRef.current = null;
      }, 500);
      const ordered = [
        ...interactiveEntries.slice(activeIndex + 1),
        ...interactiveEntries.slice(0, activeIndex + 1),
      ];
      const match = ordered.find((entry) =>
        normalizedTypeahead(entry.textValue).startsWith(typeaheadRef.current),
      );
      if (!match) return;
      event.preventDefault();
      focusEntry(interactiveEntries.findIndex((entry) => entry.id === match.id));
    },
    [activeIndex, focusEntry, interactiveEntries],
  );

  const handleMenuKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isTopOverlay(overlayId)) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusEntry(activeIndex + 1);
          return;
        case "ArrowUp":
          event.preventDefault();
          focusEntry(activeIndex - 1);
          return;
        case "Home":
          event.preventDefault();
          focusEntry(0);
          return;
        case "End":
          event.preventDefault();
          focusEntry(interactiveEntries.length - 1);
          return;
        case "Escape":
          event.preventDefault();
          event.stopPropagation();
          closeMenu(true);
          return;
        case "Tab":
          handleMenuTab(event);
          return;
        default:
          handleMenuTypeahead(event);
      }
    },
    [
      activeIndex,
      closeMenu,
      focusEntry,
      handleMenuTab,
      handleMenuTypeahead,
      interactiveEntries.length,
      overlayId,
    ],
  );

  const openMenu = (focus: "first" | "last") => {
    focusOnOpenRef.current = focus;
    setOpen(true);
  };

  if (!triggerLabel.trim()) {
    throw new Error("Menu triggerLabel must be a non-empty visible accessible name.");
  }
  if (invalidEntry) {
    throw new Error(
      "Menu entry IDs must be non-empty and unique, and actionable labels/textValue strings must be non-empty.",
    );
  }
  if (interactiveEntries.length === 0) {
    throw new Error("Menu requires at least one actionable entry.");
  }

  return (
    <div className={className} data-ds-component="menu">
      <button
        ref={setAnchor}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={styles.trigger}
        data-ds-part="trigger"
        onClick={() => {
          if (open) closeMenu(false);
          else openMenu("first");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu("first");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("last");
          }
        }}
      >
        {triggerIcon ? (
          <span aria-hidden="true" className={styles.triggerIcon}>
            <Icon name={triggerIcon} size="sm" />
          </span>
        ) : null}
        <span>{triggerLabel}</span>
      </button>
      {open ? (
        <ScopedPortal anchor={anchor}>
          <div
            ref={contentRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            className={styles.content}
            data-ds-component="menu"
            data-ds-part="content"
            data-state="open"
            style={anchoredPopupStyle(anchor, { minimumWidth: 192 })}
            onBlur={() => {
              queueMicrotask(() => {
                const activeElement = anchor?.ownerDocument.activeElement;
                if (!activeElement || !contentRef.current?.contains(activeElement)) {
                  closeMenu(false);
                }
              });
            }}
            onKeyDown={handleMenuKeyDown}
          >
            {entries.map((entry) => {
              if (entry.type === "separator") {
                return <hr key={entry.id} className={styles.separator} />;
              }
              const index = interactiveEntries.findIndex((item) => item.id === entry.id);
              const role = entry.type === "checkbox" ? "menuitemcheckbox" : "menuitem";
              return (
                <button
                  key={entry.id}
                  ref={(node) => {
                    if (node) itemRefs.current.set(entry.id, node);
                    else itemRefs.current.delete(entry.id);
                  }}
                  type="button"
                  role={role}
                  tabIndex={-1}
                  aria-checked={entry.type === "checkbox" ? entry.checked : undefined}
                  aria-disabled={entry.disabled || undefined}
                  className={styles.item}
                  data-active={index === activeIndex || undefined}
                  data-ds-part="item"
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => activateEntry(entry)}
                >
                  {entry.type === "checkbox" ? (
                    <span
                      aria-hidden="true"
                      className={styles.checkboxIndicator}
                      data-ds-part="checkbox-indicator"
                      data-state={entry.checked ? "checked" : "unchecked"}
                    >
                      {entry.checked ? <Icon name="action.confirm" size="sm" /> : null}
                    </span>
                  ) : null}
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>
        </ScopedPortal>
      ) : null}
    </div>
  );
}
