"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Menu, type MenuEntry } from "@/design-system/primitives/Menu";
import { Dialog, Sheet } from "@/design-system/primitives/Overlay";
import { Tabs } from "@/design-system/primitives/Tabs";
import { Tooltip } from "@/design-system/primitives/Tooltip";

interface OverlayNavigationProbesProps {
  readonly dialog: {
    readonly trigger: string;
    readonly title: string;
    readonly description: string;
    readonly body: string;
    readonly close: string;
    readonly initialAction: string;
    readonly lastAction: string;
  };
  readonly sheet: {
    readonly trigger: string;
    readonly title: string;
    readonly description: string;
    readonly body: string;
    readonly close: string;
    readonly initialAction: string;
    readonly lastAction: string;
  };
  readonly menuTrigger: string;
  readonly menuItems: readonly [string, string, string, string];
  readonly tabsLabel: string;
  readonly tabs: readonly [string, string, string];
  readonly tabPanels: readonly [string, string, string];
  readonly tooltipTrigger: string;
  readonly tooltipContent: string;
}

export function OverlayNavigationProbes({
  dialog,
  sheet,
  menuTrigger,
  menuItems,
  tabsLabel,
  tabs,
  tabPanels,
  tooltipTrigger,
  tooltipContent,
}: Readonly<OverlayNavigationProbesProps>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuCheckboxChecked, setMenuCheckboxChecked] = useState(true);
  const dialogInitialFocusRef = useRef<HTMLButtonElement>(null);
  const sheetInitialFocusRef = useRef<HTMLButtonElement>(null);

  const menuEntries = useMemo<readonly MenuEntry[]>(
    () => [
      {
        id: "catalog-menu-item-1",
        label: menuItems[0],
        textValue: menuItems[0],
        onSelect: () => undefined,
      },
      {
        id: "catalog-menu-item-2",
        label: menuItems[1],
        textValue: menuItems[1],
        onSelect: () => undefined,
      },
      {
        id: "catalog-menu-item-3",
        type: "checkbox",
        label: menuItems[2],
        textValue: menuItems[2],
        checked: menuCheckboxChecked,
        onCheckedChange: setMenuCheckboxChecked,
      },
      {
        id: "catalog-menu-item-4",
        label: menuItems[3],
        textValue: menuItems[3],
        disabled: true,
        onSelect: () => undefined,
      },
    ],
    [menuCheckboxChecked, menuItems],
  );
  const tabItems = tabs.map((label, index) => ({
    value: `catalog-tab-${index + 1}`,
    label,
    panel: tabPanels[index],
  }));

  return (
    <div className="catalog-v2-composite-grid">
      <div className="catalog-v2-composite-actions">
        <Button
          data-catalog-probe="dialog-trigger"
          onClick={() => setDialogOpen(true)}
          startIcon="action.confirm"
        >
          {dialog.trigger}
        </Button>
        <Button
          data-catalog-probe="sheet-trigger"
          onClick={() => setSheetOpen(true)}
          startIcon="evidence.records"
          variant="secondary"
        >
          {sheet.trigger}
        </Button>
        <div data-catalog-probe="menu">
          <Menu entries={menuEntries} triggerIcon="action.menu" triggerLabel={menuTrigger} />
        </div>
        <div data-catalog-probe="tooltip">
          <Tooltip content={tooltipContent} placement="block-start">
            <Button startIcon="help.context" variant="quiet">
              {tooltipTrigger}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div data-catalog-probe="tabs">
        <Tabs activationMode="manual" items={tabItems} label={tabsLabel} />
      </div>

      <Dialog
        closeLabel={dialog.close}
        contentClassName="catalog-v2-overlay-content"
        description={dialog.description}
        footer={
          <Button data-catalog-focus="last" onClick={() => setDialogOpen(false)} variant="quiet">
            {dialog.lastAction}
          </Button>
        }
        initialFocusRef={dialogInitialFocusRef}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={dialog.title}
      >
        <p>{dialog.body}</p>
        <div data-catalog-probe="dialog-nested-menu">
          <Menu entries={menuEntries} triggerLabel={menuTrigger} />
        </div>
        <Button
          data-catalog-focus="initial"
          ref={dialogInitialFocusRef}
          onClick={() => setDialogOpen(false)}
        >
          {dialog.initialAction}
        </Button>
      </Dialog>

      <Sheet
        closeLabel={sheet.close}
        contentClassName="catalog-v2-overlay-content"
        description={sheet.description}
        footer={
          <Button data-catalog-focus="last" onClick={() => setSheetOpen(false)} variant="quiet">
            {sheet.lastAction}
          </Button>
        }
        initialFocusRef={sheetInitialFocusRef}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        title={sheet.title}
      >
        <p>{sheet.body}</p>
        <div data-catalog-probe="sheet-nested-menu">
          <Menu entries={menuEntries} triggerLabel={menuTrigger} />
        </div>
        <Button
          data-catalog-focus="initial"
          ref={sheetInitialFocusRef}
          onClick={() => setSheetOpen(false)}
        >
          {sheet.initialAction}
        </Button>
      </Sheet>
    </div>
  );
}
