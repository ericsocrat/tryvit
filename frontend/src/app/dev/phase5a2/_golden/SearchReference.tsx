import type { GoldenRouteState } from "./contract";
import { GOLDEN_COMMON_COPY } from "./common-copy";
import { SEARCH_COPY } from "./search-copy";
import { SearchWorkspace } from "./SearchWorkspace.client";
import styles from "./golden.module.css";

const HEADER_COPY = {
  en: { eyebrow: "Discover with evidence attached", title: "Search without turning missing data into a ranking.", intro: "Counts describe this three-record synthetic fixture, filters preserve unknown and partial states, and every result explains its comparability limit." },
  pl: { eyebrow: "Odkrywaj razem z danymi", title: "Wyszukuj bez zamieniania brakujących danych w ranking.", intro: "Licznik opisuje trzyrekordowy materiał syntetyczny, filtry zachowują stany nieznane i niepełne, a każdy wynik wyjaśnia ograniczenia porównania." },
  de: { eyebrow: "Entdecken mit verbundener Evidenz", title: "Suchen, ohne fehlende Angaben in eine Rangliste zu verwandeln.", intro: "Die Anzahl beschreibt diesen synthetischen Datensatz mit drei Einträgen, Filter bewahren unbekannte und teilweise Zustände, und jedes Ergebnis erklärt seine Vergleichsgrenze." },
} as const;

export function SearchReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = HEADER_COPY[route.locale];
  const workspaceCopy = SEARCH_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  return (
    <article className={styles.searchReference}>
      <header className={styles.searchHeader}><p className={styles.eyebrow}>{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p></header>
      <SearchWorkspace common={common} copy={workspaceCopy} route={route} />
    </article>
  );
}
