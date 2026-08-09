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
      className="catalog-v2-canvas mx-auto min-h-screen max-w-5xl space-y-12 p-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">{copy.title}</h1>
        <p className="text-foreground-secondary">{copy.description}</p>
        <nav aria-label="Catalog scenes">
          <ul className="flex flex-wrap gap-3 text-sm">
            {catalogSceneIds.map((id) => (
              <li key={id}>
                <a
                  className="text-brand underline-offset-4 hover:underline"
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
