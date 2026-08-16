import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  Copy,
  Info,
  LoaderCircle,
  Menu,
  PackageOpen,
  PauseCircle,
  Pencil,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * The canonical V2 interface-icon registry.
 *
 * Names express UI meaning rather than a particular drawing. Phase 5A.2 may
 * replace a mapped glyph without changing a primitive's public API.
 */
export const iconRegistry = Object.freeze({
  "action.close": X,
  "action.confirm": Check,
  "action.continue": ArrowRight,
  "action.copy": Copy,
  "action.delete": Trash2,
  "action.disclose": ChevronRight,
  "action.edit": Pencil,
  "action.expand": ChevronDown,
  "action.menu": Menu,
  "action.search": Search,
  "action.settings": Settings,
  "feedback.degraded": TriangleAlert,
  "feedback.empty": PackageOpen,
  "feedback.error": CircleAlert,
  "feedback.info": Info,
  "feedback.loading": LoaderCircle,
  "feedback.offline": WifiOff,
  "feedback.paused": PauseCircle,
  "help.context": CircleHelp,
  "evidence.records": ClipboardList,
} satisfies Readonly<Record<string, LucideIcon>>);

export type IconName = keyof typeof iconRegistry;

export function iconForName(name: IconName): LucideIcon {
  return iconRegistry[name];
}
