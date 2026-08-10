import { ClipboardList, Pencil, Settings, Trash2 } from "lucide-react";

import { CatalogRow, CatalogSection, CatalogSpecimen } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

const alertTones = ["info", "success", "warning", "error"] as const;
const tooltipPlacements = ["top", "right", "bottom", "left"] as const;

export function OverlaysNavigationScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const interaction = copy.interaction;
  const alerts = [
    [interaction.alertInfoTitle, interaction.alertInfoBody],
    [interaction.alertSuccessTitle, interaction.alertSuccessBody],
    [interaction.alertWarningTitle, interaction.alertWarningBody],
    [interaction.alertErrorTitle, interaction.alertErrorBody],
  ] as const;
  const tooltipCues = [
    interaction.tooltipTop,
    interaction.tooltipRight,
    interaction.tooltipBottom,
    interaction.tooltipLeft,
  ] as const;

  return (
    <CatalogSection id="overlays-navigation" title={copy.scenes["overlays-navigation"]}>
      <CatalogSpecimen label={copy.specimenLabel} note={copy.specimenNote}>
        <CatalogRow label={interaction.iconButtons}>
          <span aria-label={interaction.edit} className="catalog-v2-icon-button" data-variant="primary" role="img">
            <Pencil aria-hidden="true" size={18} />
          </span>
          <span aria-label={interaction.remove} className="catalog-v2-icon-button" data-variant="destructive" role="img">
            <Trash2 aria-hidden="true" size={18} />
          </span>
          <span aria-label={interaction.settings} className="catalog-v2-icon-button" data-variant="quiet" role="img">
            <Settings aria-hidden="true" size={18} />
          </span>
          <span aria-label={interaction.copy} className="catalog-v2-icon-button" data-variant="secondary" role="img">
            <ClipboardList aria-hidden="true" size={18} />
          </span>
        </CatalogRow>

        <CatalogRow label={interaction.tooltipCues}>
          {tooltipCues.map((cue, index) => {
            return (
              <figure
                className="catalog-v2-tooltip-pair"
                data-placement={tooltipPlacements[index]}
                key={cue}
              >
                <span aria-hidden="true" className="catalog-v2-tooltip-anchor">?</span>
                <figcaption className="catalog-v2-tooltip">{cue}</figcaption>
              </figure>
            );
          })}
        </CatalogRow>

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
