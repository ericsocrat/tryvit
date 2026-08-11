import { IconButton } from "@/design-system/primitives/IconButton/IconButton";

import { CatalogRow, CatalogSection, CatalogSpecimen } from "./CatalogFrame";
import { OverlayNavigationProbes } from "./OverlayNavigationProbes.client";
import type { CatalogCopy } from "./registry";

const alertTones = ["info", "success", "warning", "error"] as const;

export function OverlaysNavigationScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const interaction = copy.interaction;
  const alerts = [
    [interaction.alertInfoTitle, interaction.alertInfoBody],
    [interaction.alertSuccessTitle, interaction.alertSuccessBody],
    [interaction.alertWarningTitle, interaction.alertWarningBody],
    [interaction.alertErrorTitle, interaction.alertErrorBody],
  ] as const;
  const primitives = copy.primitives;

  return (
    <CatalogSection id="overlays-navigation" title={copy.scenes["overlays-navigation"]}>
      <CatalogSpecimen label={copy.specimenLabel} note={copy.specimenNote}>
        <CatalogRow label={interaction.iconButtons}>
          <IconButton icon="action.edit" label={interaction.edit} variant="primary" />
          <IconButton icon="action.delete" label={interaction.remove} variant="destructive" />
          <IconButton icon="action.settings" label={interaction.settings} variant="quiet" />
          <IconButton icon="action.copy" label={interaction.copy} variant="secondary" />
        </CatalogRow>

        <OverlayNavigationProbes
          combobox={{
            label: primitives.comboboxLabel,
            hint: primitives.comboboxHint,
            placeholder: primitives.comboboxPlaceholder,
            options: primitives.comboboxOptions,
            loadingMessage: primitives.comboboxLoading,
            emptyMessage: primitives.comboboxEmpty,
            resultsMessage: primitives.comboboxResults,
          }}
          dialog={{
            trigger: primitives.dialogTrigger,
            title: primitives.dialogTitle,
            description: primitives.dialogDescription,
            body: primitives.dialogBody,
            close: primitives.dialogClose,
            initialAction: primitives.dialogInitialAction,
            lastAction: primitives.dialogLastAction,
          }}
          menuItems={primitives.menuItems}
          menuTrigger={primitives.menuTrigger}
          sheet={{
            trigger: primitives.sheetTrigger,
            title: primitives.sheetTitle,
            description: primitives.sheetDescription,
            body: primitives.sheetBody,
            close: primitives.sheetClose,
            initialAction: primitives.sheetInitialAction,
            lastAction: primitives.sheetLastAction,
          }}
          tabPanels={primitives.tabPanels}
          tabs={primitives.tabs}
          tabsLabel={primitives.tabsLabel}
          tooltipContent={primitives.tooltipContent}
          tooltipTrigger={primitives.tooltipTrigger}
        />

        <div className="space-y-3">
          <p className="catalog-v2-row-label text-sm font-medium">{interaction.alerts}</p>
          {alerts.map(([title, body], index) => (
            <div className="catalog-v2-alert" data-tone={alertTones[index]} key={title}>
              <span aria-hidden="true" className="catalog-v2-alert-mark" />
              <div>
                <p className="font-semibold">{title}</p>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </CatalogSpecimen>
    </CatalogSection>
  );
}
