import { ActionsFormsScene } from "./ActionsFormsScene";
import { EvidencePageStatesScene } from "./EvidencePageStatesScene";
import { FoundationsScene } from "./FoundationsScene";
import { OverlaysNavigationScene } from "./OverlaysNavigationScene";
import { catalogSceneIds, type CatalogCopy } from "./registry";
import "./catalog.css";

export function CatalogShell({ copy }: Readonly<{ copy: CatalogCopy }>) {
  return (
    <main
      id="main-content"
      data-design-system="v2"
      data-ds-overlay-host=""
      className="catalog-v2-canvas mx-auto min-h-screen max-w-5xl space-y-12 p-8"
    >
      <header className="space-y-2">
        <h1 className="catalog-v2-title text-3xl font-bold">{copy.title}</h1>
        <p className="catalog-v2-copy">{copy.description}</p>
        <nav aria-label={copy.sceneNavigationLabel}>
          <ul className="flex flex-wrap gap-3 text-sm">
            {catalogSceneIds.map((id) => (
              <li key={id}>
                <a
                  className="catalog-v2-link underline-offset-4 hover:underline"
                  href={`#${id}-title`}
                >
                  {copy.scenes[id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <FoundationsScene copy={copy} />
      <ActionsFormsScene copy={copy} />
      <OverlaysNavigationScene copy={copy} />
      <EvidencePageStatesScene copy={copy} />
    </main>
  );
}
