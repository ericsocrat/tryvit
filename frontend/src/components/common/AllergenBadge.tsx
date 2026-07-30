"use client";

/**
 * AllergenBadge — evidence-aware allergen status badge.
 *
 * `assessed-absent` is reserved for authoritative absence evidence. Callers
 * must use `unknown` when evidence is missing.
 */

import { useTranslation } from "@/lib/i18n";
import { AlertTriangle, Check, CircleHelp, Dna, Zap } from "lucide-react";
import React, { type ReactElement } from "react";
import { InfoTooltip } from "./InfoTooltip";

export type AllergenStatus =
  | "present"
  | "traces"
  | "derived"
  | "unknown"
  | "assessed-absent";
export type AllergenBadgeSize = "sm" | "md";

export interface AllergenBadgeProps {
  readonly status: AllergenStatus;
  readonly allergenName: string;
  readonly size?: AllergenBadgeSize;
  readonly showTooltip?: boolean;
  readonly className?: string;
}

interface StatusConfig {
  icon: ReactElement;
  bg: string;
  text: string;
  labelKey: string;
  tooltipKey: string;
}

const STATUS_CONFIGS: Record<AllergenStatus, StatusConfig> = {
  present: {
    icon: <AlertTriangle size={12} />,
    bg: "bg-allergen-present/10",
    text: "text-allergen-present",
    labelKey: "allergenBadge.present",
    tooltipKey: "present",
  },
  traces: {
    icon: <Zap size={12} />,
    bg: "bg-allergen-traces/10",
    text: "text-allergen-traces",
    labelKey: "allergenBadge.traces",
    tooltipKey: "traces",
  },
  derived: {
    icon: <Dna size={12} />,
    bg: "bg-warning-bg",
    text: "text-warning-text",
    labelKey: "allergenBadge.derived",
    tooltipKey: "derived",
  },
  unknown: {
    icon: <CircleHelp size={12} />,
    bg: "bg-surface-muted",
    text: "text-foreground-muted",
    labelKey: "allergenBadge.unknown",
    tooltipKey: "unknown",
  },
  "assessed-absent": {
    icon: <Check size={12} />,
    bg: "bg-allergen-free/10",
    text: "text-allergen-free",
    labelKey: "allergenBadge.assessedAbsent",
    tooltipKey: "assessedAbsent",
  },
};

const SIZE_CLASSES: Record<AllergenBadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export const AllergenBadge = React.memo(function AllergenBadge({
  status,
  allergenName,
  size = "sm",
  showTooltip = false,
  className = "",
}: Readonly<AllergenBadgeProps>) {
  const { t } = useTranslation();
  const config = STATUS_CONFIGS[status];

  const badge = (
    <span
      className={[
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent font-medium shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none",
        config.bg,
        config.text,
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t(config.labelKey, { name: allergenName })}
    >
      <span aria-hidden="true">{config.icon}</span>
      {allergenName}
    </span>
  );

  if (showTooltip) {
    return (
      <InfoTooltip
        messageKey={`tooltip.allergen.${config.tooltipKey}`}
        params={{ name: allergenName }}
      >
        {badge}
      </InfoTooltip>
    );
  }

  return badge;
});
