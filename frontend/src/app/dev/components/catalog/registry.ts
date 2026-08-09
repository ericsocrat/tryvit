import type { SupportedLanguage } from "@/stores/language-store";

export const catalogSceneIds = [
  "foundations",
  "actions-forms",
  "overlays-navigation",
  "evidence-page-states",
] as const;

export type CatalogSceneId = (typeof catalogSceneIds)[number];

export interface CatalogCopy {
  readonly title: string;
  readonly description: string;
  readonly scenes: Readonly<Record<CatalogSceneId, string>>;
  readonly livingLabel: string;
  readonly fixtureNote: string;
}

const catalogCopy: Readonly<Record<SupportedLanguage, CatalogCopy>> = {
  en: {
    title: "Component Library",
    description: "Deterministic design-system catalog. Fixture data is local and backend-free.",
    scenes: {
      foundations: "Foundations",
      "actions-forms": "Actions & forms",
      "overlays-navigation": "Overlays & navigation",
      "evidence-page-states": "Evidence & page states",
    },
    livingLabel: "Living Label V2",
    fixtureNote: "Representative fixture only — primitives ship in Phase 5A.1b.",
  },
  pl: {
    title: "Biblioteka komponentów",
    description: "Deterministyczny katalog systemu projektowego. Dane przykładowe są lokalne.",
    scenes: {
      foundations: "Podstawy",
      "actions-forms": "Akcje i formularze",
      "overlays-navigation": "Nakładki i nawigacja",
      "evidence-page-states": "Dowody i stany strony",
    },
    livingLabel: "Żywa etykieta V2",
    fixtureNote: "Tylko reprezentatywny przykład — prymitywy pojawią się w fazie 5A.1b.",
  },
  de: {
    title: "Komponentenbibliothek",
    description: "Deterministischer Designsystem-Katalog. Beispieldaten sind lokal und backendfrei.",
    scenes: {
      foundations: "Grundlagen",
      "actions-forms": "Aktionen und Formulare",
      "overlays-navigation": "Overlays und Navigation",
      "evidence-page-states": "Evidenz und Seitenstatus",
    },
    livingLabel: "Living Label V2",
    fixtureNote: "Nur ein repräsentatives Beispiel — Primitive folgen in Phase 5A.1b.",
  },
};

export function getCatalogCopy(language: SupportedLanguage): CatalogCopy {
  return catalogCopy[language];
}
