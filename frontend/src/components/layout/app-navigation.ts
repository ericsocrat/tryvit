import {
  Activity,
  BookOpen,
  Camera,
  ClipboardList,
  Eye,
  FileText,
  FolderOpen,
  Gauge,
  Home,
  Scale,
  ScanText,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { PrimaryRouteKey } from "@/hooks/use-active-route";

export interface AppNavItem {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly prominent?: boolean;
  readonly routeKey: PrimaryRouteKey;
}

export interface AppNavSection {
  readonly labelKey: string;
  readonly items: readonly AppNavItem[];
}

export const HOME_ITEM: AppNavItem = {
  href: "/app",
  labelKey: "nav.home",
  icon: Home,
  routeKey: "home",
};

export const SEARCH_ITEM: AppNavItem = {
  href: "/app/search",
  labelKey: "nav.search",
  icon: Search,
  routeKey: "search",
  prominent: true,
};

export const SCAN_ITEM: AppNavItem = {
  href: "/app/scan",
  labelKey: "nav.scan",
  icon: Camera,
  routeKey: "scan",
  prominent: true,
};

export const LISTS_ITEM: AppNavItem = {
  href: "/app/lists",
  labelKey: "nav.lists",
  icon: ClipboardList,
  routeKey: "lists",
};

export const WATCHLIST_ITEM: AppNavItem = {
  href: "/app/watchlist",
  labelKey: "nav.watchlist",
  icon: Eye,
  routeKey: "watchlist",
};

export const COMPARE_ITEM: AppNavItem = {
  href: "/app/compare",
  labelKey: "nav.compare",
  icon: Scale,
  routeKey: "compare",
};

export const CATEGORIES_ITEM: AppNavItem = {
  href: "/app/categories",
  labelKey: "nav.categories",
  icon: FolderOpen,
  routeKey: "categories",
};

export const ACHIEVEMENTS_ITEM: AppNavItem = {
  href: "/app/achievements",
  labelKey: "nav.achievements",
  icon: Trophy,
  routeKey: "achievements",
};

export const RECIPES_ITEM: AppNavItem = {
  href: "/app/recipes",
  labelKey: "nav.recipes",
  icon: UtensilsCrossed,
  routeKey: "recipes",
};

export const IMAGE_SEARCH_ITEM: AppNavItem = {
  href: "/app/image-search",
  labelKey: "nav.imageSearch",
  icon: ScanText,
  routeKey: "image-search",
};

export const LEARN_ITEM: AppNavItem = {
  href: "/learn",
  labelKey: "nav.learn",
  icon: BookOpen,
  routeKey: null,
};

export const SETTINGS_ITEM: AppNavItem = {
  href: "/app/settings",
  labelKey: "nav.settings",
  icon: Settings,
  routeKey: "settings",
};

export const MOBILE_PRIMARY_ITEMS = [HOME_ITEM, SEARCH_ITEM, SCAN_ITEM, LISTS_ITEM] as const;

export const SIDEBAR_SECTIONS: readonly AppNavSection[] = [
  {
    labelKey: "nav.sectionBrowse",
    items: [SEARCH_ITEM, SCAN_ITEM, CATEGORIES_ITEM, RECIPES_ITEM, IMAGE_SEARCH_ITEM],
  },
  {
    labelKey: "nav.sectionYourStuff",
    items: [HOME_ITEM, LISTS_ITEM, WATCHLIST_ITEM, COMPARE_ITEM, ACHIEVEMENTS_ITEM],
  },
  {
    labelKey: "nav.sectionApp",
    items: [LEARN_ITEM, SETTINGS_ITEM],
  },
] as const;

export const HEADER_PRIMARY_ITEMS = [
  HOME_ITEM,
  SEARCH_ITEM,
  SCAN_ITEM,
  CATEGORIES_ITEM,
  LISTS_ITEM,
] as const;

export const HEADER_MORE_ITEMS = [
  WATCHLIST_ITEM,
  COMPARE_ITEM,
  ACHIEVEMENTS_ITEM,
  RECIPES_ITEM,
  IMAGE_SEARCH_ITEM,
  LEARN_ITEM,
  SETTINGS_ITEM,
] as const;

export const DRAWER_SECTIONS: readonly AppNavSection[] = [
  {
    labelKey: "nav.sectionBrowse",
    items: [CATEGORIES_ITEM, RECIPES_ITEM, IMAGE_SEARCH_ITEM],
  },
  {
    labelKey: "nav.sectionYourStuff",
    items: [COMPARE_ITEM, WATCHLIST_ITEM, ACHIEVEMENTS_ITEM],
  },
  {
    labelKey: "nav.sectionApp",
    items: [LEARN_ITEM, SETTINGS_ITEM],
  },
] as const;

export const ADMIN_ITEMS = [
  {
    href: "/app/admin/submissions",
    labelKey: "nav.adminSubmissions",
    icon: FileText,
  },
  {
    href: "/app/admin/metrics",
    labelKey: "nav.adminMetrics",
    icon: Gauge,
  },
  {
    href: "/app/admin/monitoring",
    labelKey: "nav.adminMonitoring",
    icon: Activity,
  },
] as const;

export const ADMIN_ENTRY_ITEM: AppNavItem = {
  href: "/app/admin/submissions",
  labelKey: "nav.admin",
  icon: ShieldCheck,
  routeKey: "admin",
};

export const MORE_ROUTE_KEYS = new Set<PrimaryRouteKey>([
  "compare",
  "categories",
  "watchlist",
  "settings",
  "achievements",
  "recipes",
  "image-search",
  "admin",
]);
