import Link from "next/link";
import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import {
  assertInertHostProps,
  type InertHostAttributes,
} from "@/design-system/primitives/shared/inert-host";
import { Icon } from "@/design-system/icons/Icon";

import styles from "./CardLink.module.css";

const CARD_LINK_ELEMENTS = ["article", "div", "li", "section"] as const;
const INTERACTIVE_ELEMENTS = new Set([
  "a",
  "audio",
  "button",
  "details",
  "embed",
  "iframe",
  "input",
  "label",
  "object",
  "select",
  "summary",
  "textarea",
  "video",
]);
const INTERACTIVE_ROLES = new Set([
  "alertdialog",
  "application",
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "grid",
  "gridcell",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treegrid",
  "treeitem",
]);

export type CardLinkElement = (typeof CARD_LINK_ELEMENTS)[number];

export interface CardLinkRootProps extends Omit<InertHostAttributes, "children"> {
  readonly as?: CardLinkElement;
  readonly children: ReactNode;
}

export interface CardLinkPrimaryProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  readonly href: string;
  readonly children: ReactNode;
}

export interface CardLinkActionsProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  readonly children: ReactNode;
}

interface InspectableElementProps {
  readonly accessKey?: string;
  readonly autoFocus?: boolean;
  readonly children?: ReactNode;
  readonly contentEditable?: boolean | "" | "false" | "inherit" | "plaintext-only" | "true";
  readonly controls?: boolean | "false" | "true";
  readonly dangerouslySetInnerHTML?: unknown;
  readonly draggable?: boolean | "false" | "true";
  readonly href?: unknown;
  readonly role?: unknown;
  readonly tabIndex?: number;
  readonly useMap?: string;
}

function hasInteractiveRole(role: unknown): boolean {
  if (role === undefined) return false;
  if (typeof role !== "string") return true;
  return role
    .trim()
    .toLowerCase()
    .split(/\s+/u)
    .some((candidate) => INTERACTIVE_ROLES.has(candidate));
}

function hasDomEventHandler(props: InspectableElementProps): boolean {
  return Object.entries(props).some(
    ([key, value]) => value !== undefined && /^on[A-Z]/u.test(key),
  );
}

function assertCardLinkComposition(children: ReactNode): void {
  let primaryCount = 0;
  let actionsCount = 0;

  const inspect = (nodes: ReactNode, direct: boolean): void => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement<InspectableElementProps>(child)) return;
      if (child.type === Fragment) {
        inspect(child.props.children, direct);
        return;
      }
      if (child.type === CardLinkPrimary) {
        if (!direct) {
          throw new TypeError("CardLink.Primary must be a direct CardLink.Root child.");
        }
        primaryCount += 1;
        return;
      }
      if (child.type === CardLinkActions) {
        if (!direct) {
          throw new TypeError("CardLink.Actions must be a direct CardLink.Root child.");
        }
        actionsCount += 1;
        return;
      }
      if (typeof child.type === "string") {
        inspect(child.props.children, false);
      }
    });
  };

  inspect(children, true);
  if (primaryCount !== 1) {
    throw new TypeError("CardLink.Root requires exactly one direct CardLink.Primary child.");
  }
  if (actionsCount > 1) {
    throw new TypeError("CardLink.Root accepts at most one direct CardLink.Actions child.");
  }
}

/**
 * Opaque custom output cannot be proven noninteractive, so protected boundaries
 * accept host elements plus the explicit compound slots (and inert Icon in Primary).
 */
function assertNoninteractiveHostTree(children: ReactNode, owner: string): void {
  Children.forEach(children, (child) => {
    if (!isValidElement<InspectableElementProps>(child)) return;

    if (child.type === Fragment) {
      assertNoninteractiveHostTree(child.props.children, owner);
      return;
    }

    if (typeof child.type !== "string") {
      const allowedCustomComponent =
        owner === "CardLink.Root"
          ? child.type === CardLinkPrimary || child.type === CardLinkActions || child.type === Icon
          : child.type === Icon;
      if (allowedCustomComponent) return;
      throw new TypeError(
        `${owner} cannot verify opaque custom descendants; use inert host elements and the canonical CardLink slots.`,
      );
    }

    const isMediaControl =
      (child.type === "audio" || child.type === "video") &&
      child.props.controls !== undefined &&
      child.props.controls !== false &&
      child.props.controls !== "false";
    const isLinkedArea =
      child.type === "area" && child.props.href !== undefined && child.props.href !== null;
    const isImageMap =
      child.type === "img" && child.props.useMap !== undefined && child.props.useMap !== null;
    const isInteractive =
      (INTERACTIVE_ELEMENTS.has(child.type) && child.type !== "audio" && child.type !== "video") ||
      isMediaControl ||
      isLinkedArea ||
      isImageMap ||
      child.props.tabIndex !== undefined ||
      (child.props.contentEditable !== undefined &&
        child.props.contentEditable !== false &&
        child.props.contentEditable !== "false" &&
        child.props.contentEditable !== "inherit") ||
      (child.props.accessKey !== undefined && child.props.accessKey !== "") ||
      child.props.autoFocus === true ||
      child.props.draggable === true ||
      child.props.draggable === "true" ||
      child.props.dangerouslySetInnerHTML !== undefined ||
      hasDomEventHandler(child.props) ||
      hasInteractiveRole(child.props.role);

    if (isInteractive) {
      throw new TypeError(
        `${owner} cannot contain interactive descendants; place secondary controls in CardLink.Actions.`,
      );
    }

    assertNoninteractiveHostTree(child.props.children, owner);
  });
}

export const CardLinkRoot = forwardRef<HTMLElement, CardLinkRootProps>(
  function CardLinkRoot(properties, ref) {
    assertInertHostProps(
      properties as unknown as Readonly<Record<string, unknown>>,
      "CardLink.Root",
    );
    const { as: element = "article", className = "", children, ...rest } = properties;
    if (!CARD_LINK_ELEMENTS.includes(element)) {
      throw new TypeError(
        `CardLink.Root must use a noninteractive container; received "${element}".`,
      );
    }

    assertCardLinkComposition(children);
    assertNoninteractiveHostTree(children, "CardLink.Root");

    const Component = element as ElementType;

    return (
      <Component
        {...rest}
        ref={ref}
        className={[styles.root, className].filter(Boolean).join(" ")}
        data-card-link="root"
      >
        {children}
      </Component>
    );
  },
);

export const CardLinkPrimary = forwardRef<HTMLAnchorElement, CardLinkPrimaryProps>(
  function CardLinkPrimary({ href, className = "", children, ...rest }, ref) {
    assertNoninteractiveHostTree(children, "CardLink.Primary");

    return (
      <Link
        {...rest}
        ref={ref}
        className={[styles.primary, className].filter(Boolean).join(" ")}
        data-card-link="primary"
        href={href}
      >
        {children}
      </Link>
    );
  },
);

export const CardLinkActions = forwardRef<HTMLDivElement, CardLinkActionsProps>(
  function CardLinkActions({ className = "", children, ...rest }, ref) {
    return (
      <div
        {...rest}
        ref={ref}
        className={[styles.actions, className].filter(Boolean).join(" ")}
        data-card-link="actions"
      >
        {children}
      </div>
    );
  },
);

/**
 * Compound CardLink keeps the primary navigation target and any secondary
 * controls as siblings, preventing the nested-interactive pattern.
 */
export const CardLink = Object.freeze({
  Root: CardLinkRoot,
  Primary: CardLinkPrimary,
  Actions: CardLinkActions,
});
