"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { focusElement } from "@/design-system/primitives/shared/dom";
import { useControllableState } from "@/design-system/primitives/shared/controllable-state";

import styles from "./tabs.module.css";

export interface TabItem {
  readonly value: string;
  /** Localized inert text; interactive descendants are not valid tab labels. */
  readonly label: string;
  readonly panel: ReactNode;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly label: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly activationMode?: "automatic" | "manual";
  readonly orientation?: "horizontal" | "vertical";
  readonly className?: string;
}

function tabListDirection(tab: HTMLButtonElement): "ltr" | "rtl" {
  const tabList = tab.closest<HTMLElement>("[role='tablist']");
  const computedDirection = tabList?.ownerDocument.defaultView
    ?.getComputedStyle(tabList).direction;
  if (computedDirection === "rtl" || computedDirection === "ltr") {
    return computedDirection;
  }
  return tabList?.closest<HTMLElement>("[dir]")?.dir === "rtl" ? "rtl" : "ltr";
}

function navigationDelta(
  orientation: "horizontal" | "vertical",
  key: string,
  direction: "ltr" | "rtl",
): number | null {
  if (orientation === "horizontal" && key === "ArrowRight") {
    return direction === "rtl" ? -1 : 1;
  }
  if (orientation === "horizontal" && key === "ArrowLeft") {
    return direction === "rtl" ? 1 : -1;
  }
  if (orientation === "vertical" && key === "ArrowDown") return 1;
  if (orientation === "vertical" && key === "ArrowUp") return -1;
  return null;
}

export function Tabs({
  items,
  label,
  value,
  defaultValue,
  onValueChange,
  activationMode = "automatic",
  orientation = "horizontal",
  className,
}: Readonly<TabsProps>) {
  const enabledItems = useMemo(() => items.filter((item) => !item.disabled), [items]);
  const invalidItem = useMemo(() => {
    const seen = new Set<string>();
    return items.find((item) => {
      if (
        typeof item.value !== "string" ||
        !item.value.trim() ||
        typeof item.label !== "string" ||
        !item.label.trim() ||
        seen.has(item.value)
      )
        return true;
      seen.add(item.value);
      return false;
    });
  }, [items]);
  const fallbackValue = enabledItems[0]?.value ?? "";
  const [requestedValue, setRequestedValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? fallbackValue,
    onChange: onValueChange,
  });
  const selectedValue = enabledItems.some((item) => item.value === requestedValue)
    ? requestedValue
    : fallbackValue;
  const [focusedValue, setFocusedValue] = useState(selectedValue);
  const rovingValue = enabledItems.some((item) => item.value === focusedValue)
    ? focusedValue
    : selectedValue;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const baseId = useId();

  useEffect(() => {
    setFocusedValue(selectedValue);
  }, [selectedValue]);

  const focusTab = useCallback(
    (nextValue: string) => {
      setFocusedValue(nextValue);
      if (activationMode === "automatic") setRequestedValue(nextValue);
      queueMicrotask(() => {
        const tab = tabRefs.current.get(nextValue);
        focusElement(tab);
        tab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    },
    [activationMode, setRequestedValue],
  );

  const moveFocus = useCallback(
    (currentValue: string, delta: number) => {
      if (enabledItems.length === 0) return;
      const currentIndex = enabledItems.findIndex((item) => item.value === currentValue);
      const nextIndex =
        (((Math.max(currentIndex, 0) + delta) % enabledItems.length) + enabledItems.length) %
        enabledItems.length;
      focusTab(enabledItems[nextIndex].value);
    },
    [enabledItems, focusTab],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, itemValue: string) => {
    const direction = tabListDirection(event.currentTarget);
    const delta = navigationDelta(orientation, event.key, direction);

    if (delta !== null) {
      event.preventDefault();
      moveFocus(itemValue, delta);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      if (enabledItems[0]) focusTab(enabledItems[0].value);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      const lastItem = enabledItems.at(-1);
      if (lastItem) focusTab(lastItem.value);
      return;
    }
    if (activationMode === "manual" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setRequestedValue(itemValue);
    }
  };

  if (typeof label !== "string" || !label.trim()) {
    throw new Error("Tabs label must be a non-empty accessible name.");
  }
  if (invalidItem) {
    throw new Error("Tab item values must be non-empty and unique, with non-empty labels.");
  }
  if (enabledItems.length === 0) {
    throw new Error("Tabs requires at least one enabled item for its roving tab stop.");
  }

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-ds-component="tabs"
      data-orientation={orientation}
    >
      <div
        role="tablist"
        aria-label={label}
        aria-orientation={orientation}
        className={styles.list}
        data-ds-part="tablist"
      >
        {items.map((item, index) => {
          const selected = item.value === selectedValue;
          const tabId = `${baseId}-tab-${index}`;
          const panelId = `${baseId}-panel-${index}`;
          return (
            <button
              key={item.value}
              ref={(node) => {
                if (node) tabRefs.current.set(item.value, node);
                else tabRefs.current.delete(item.value);
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              disabled={item.disabled}
              tabIndex={!item.disabled && item.value === rovingValue ? 0 : -1}
              className={styles.tab}
              data-ds-part="tab"
              data-state={selected ? "active" : "inactive"}
              onClick={() => {
                setFocusedValue(item.value);
                setRequestedValue(item.value);
              }}
              onFocus={() => {
                setFocusedValue(item.value);
                if (activationMode === "automatic") setRequestedValue(item.value);
              }}
              onKeyDown={(event) => handleKeyDown(event, item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item, index) => {
        const selected = item.value === selectedValue;
        return (
          <div
            key={item.value}
            id={`${baseId}-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${index}`}
            hidden={!selected}
            tabIndex={selected ? 0 : -1}
            className={styles.panel}
            data-ds-part="tabpanel"
            data-state={selected ? "active" : "inactive"}
          >
            {item.panel}
          </div>
        );
      })}
    </div>
  );
}
