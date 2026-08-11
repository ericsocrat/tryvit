"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cloneElement, useCallback, useId, useState, type ReactElement } from "react";

import { portalScopeAttributes, resolvePortalHost } from "@/design-system/primitives/shared/portal";

import styles from "./tooltip.module.css";

export type TooltipPlacement = "block-start" | "block-end" | "inline-start" | "inline-end";

export interface TooltipProps {
  /** Non-empty localized text. Tooltip content is intentionally noninteractive. */
  readonly content: string;
  /** A single, focusable element that forwards its ref to its actual DOM node. */
  readonly children: ReactElement;
  readonly placement?: TooltipPlacement;
  readonly align?: "start" | "center" | "end";
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly className?: string;
}

function assertInertLocalizedText(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      "Tooltip content must be non-empty localized text; React content is not supported.",
    );
  }
}

function physicalSide(
  placement: TooltipPlacement,
  direction: "ltr" | "rtl",
): "top" | "right" | "bottom" | "left" {
  if (placement === "block-start") return "top";
  if (placement === "block-end") return "bottom";
  if (placement === "inline-start") return direction === "rtl" ? "right" : "left";
  return direction === "rtl" ? "left" : "right";
}

export function Tooltip({
  content,
  children,
  placement = "block-start",
  align = "center",
  open,
  defaultOpen,
  onOpenChange,
  className,
}: Readonly<TooltipProps>) {
  assertInertLocalizedText(content);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const resolvedOpen = open ?? uncontrolledOpen;
  const contentId = useId();
  const setTriggerAnchor = useCallback((node: HTMLElement | null) => {
    if (node && (node.matches(":disabled") || node.tabIndex < 0)) {
      throw new Error(
        "Tooltip children must resolve to a focusable, ref-forwarding trigger element.",
      );
    }
    setAnchor(node);
  }, []);
  const scope = anchor ? portalScopeAttributes(anchor) : null;
  const side = physicalSide(placement, scope?.dir ?? "ltr");
  const child = children as ReactElement<{
    readonly "aria-describedby"?: string;
  }>;
  const existingDescription = child.props["aria-describedby"];
  const describedBy = resolvedOpen
    ? [...new Set([...(existingDescription?.trim().split(/\s+/u) ?? []), contentId])].join(" ")
    : existingDescription;
  const trigger = cloneElement(child, { "aria-describedby": describedBy });

  return (
    <TooltipPrimitive.Provider
      delayDuration={350}
      skipDelayDuration={120}
      disableHoverableContent={false}
    >
      <TooltipPrimitive.Root
        open={resolvedOpen}
        onOpenChange={(nextOpen) => {
          if (open === undefined) setUncontrolledOpen(nextOpen);
          onOpenChange?.(nextOpen);
        }}
      >
        <TooltipPrimitive.Trigger ref={setTriggerAnchor} asChild data-ds-part="trigger">
          {trigger}
        </TooltipPrimitive.Trigger>
        {anchor && scope ? (
          <TooltipPrimitive.Portal container={resolvePortalHost(anchor)}>
            <div {...scope} data-ds-portal-root="" style={{ display: "contents" }}>
              <TooltipPrimitive.Content
                id={contentId}
                side={side}
                align={align}
                sideOffset={4}
                collisionPadding={8}
                className={[styles.content, className].filter(Boolean).join(" ")}
                data-ds-component="tooltip"
                data-ds-part="content"
              >
                {content}
                <TooltipPrimitive.Arrow className={styles.arrow} width={10} height={5} />
              </TooltipPrimitive.Content>
            </div>
          </TooltipPrimitive.Portal>
        ) : null}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
