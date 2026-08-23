"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Input } from "@/design-system/primitives/Field";

import { GOLDEN_COMMON_COPY } from "./common-copy";
import { GOLDEN_REFERENCE_STATES, type GoldenRouteState } from "./contract";
import { DecisionSummary } from "./GoldenEvidence";
import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

type ScannerState = (typeof GOLDEN_REFERENCE_STATES.scanner)[number];
type ScannerEvent =
  | "request"
  | "grant"
  | "deny"
  | "assist"
  | "recognize"
  | "process"
  | "match"
  | "retry"
  | "manual"
  | "invalid"
  | "contribute"
  | "interrupt"
  | "resume"
  | "cancel";

const SCANNER_COPY = {
  en: {
    eyebrow: "Signature scanner · deterministic simulation",
    title: "Frame the code. Keep every uncertain step visible.",
    intro: "No camera or product service is active. Recognition, lookup, partial matches, interruption, and recovery are explicit local states.",
    noCamera: "Camera inactive",
    manual: "Enter barcode manually",
    request: "Review permission request",
    allow: "Allow simulation",
    deny: "Deny",
    cancel: "Cancel",
    continue: "Continue acquisition",
    recognize: "Recognize synthetic barcode",
    process: "Build evidence result",
    retry: "Retry this stage",
    resume: "Resume interrupted scan",
    contribute: "Contribute missing record",
    rescan: "Start another simulated scan",
    manualLabel: "EAN-13 barcode",
    manualHint: "Use the fixed review barcode 5901234123457.",
    manualSubmit: "Check local barcode",
    invalid: "Enter the 13-digit synthetic review barcode.",
    contributionLabel: "Product name on the package",
    contributionHint: "Local review only; nothing is uploaded.",
    contributionSubmit: "Prepare local contribution",
    permissionTitle: "Camera access would be requested now",
    permissionBody: "A real product would explain why access is needed at this moment. This review never invokes a browser permission.",
    progress: "Local lookup simulation · step 3 of 4",
    resultDecision: "Review before deciding",
    resultReason: "A synthetic product matched, but processing remains unassessed.",
    stateLabel: {
      "not-requested": "Permission has not been requested. Manual entry is available.",
      "permission-request": "Permission rationale is shown. No browser prompt is open.",
      "permission-denied": "Permission was declined in the simulation. Manual entry remains available.",
      "camera-unavailable": "Camera capability is unavailable. No access was attempted.",
      ready: "Scanner simulation ready. Align the synthetic barcode within the frame.",
      "acquisition-assist": "Move the package closer and keep the full barcode inside the frame.",
      recognized: "Barcode 5901234123457 recognized. Product identity is not matched yet.",
      processing: "Barcode decoded. Local product lookup is in progress.",
      matched: "North Grain Oat Drink matched with moderate data confidence.",
      "partial-match": "Partial match. Brand and barcode agree; processing evidence is missing.",
      "uncertain-match": "Two synthetic records could match. No score is shown until identity is confirmed.",
      "not-found": "The barcode is valid but no synthetic product record was found.",
      offline: "Optical recognition may continue, but product lookup is unavailable offline.",
      interrupted: "The local scan was interrupted before lookup completed.",
      resumed: "Interrupted recognition resumed without duplicating the lookup.",
      "manual-entry": "Manual barcode entry is active.",
      "invalid-barcode": "The manual barcode is invalid.",
      "contribution-entry": "Prepare a local contribution for a missing product record.",
    },
  },
  pl: {
    eyebrow: "Charakterystyczny skaner · deterministyczna symulacja",
    title: "Ustaw kod w kadrze. Zachowaj widoczność każdego niepewnego etapu.",
    intro: "Aparat i usługa produktów są nieaktywne. Rozpoznanie, wyszukiwanie, częściowe dopasowanie, przerwanie i odzyskanie to jawne stany lokalne.",
    noCamera: "Aparat nieaktywny",
    manual: "Wpisz kod ręcznie",
    request: "Sprawdź prośbę o dostęp",
    allow: "Zezwól na symulację",
    deny: "Odmów",
    cancel: "Anuluj",
    continue: "Kontynuuj pozyskiwanie",
    recognize: "Rozpoznaj kod syntetyczny",
    process: "Zbuduj wynik danych",
    retry: "Ponów ten etap",
    resume: "Wznów przerwany skan",
    contribute: "Dodaj brakujący rekord",
    rescan: "Rozpocznij kolejną symulację",
    manualLabel: "Kod kreskowy EAN-13",
    manualHint: "Użyj stałego kodu testowego 5901234123457.",
    manualSubmit: "Sprawdź kod lokalnie",
    invalid: "Wpisz 13-cyfrowy syntetyczny kod testowy.",
    contributionLabel: "Nazwa produktu na opakowaniu",
    contributionHint: "Wyłącznie lokalny przegląd; nic nie jest przesyłane.",
    contributionSubmit: "Przygotuj lokalny wkład",
    permissionTitle: "W tym momencie pojawiłaby się prośba o dostęp do aparatu",
    permissionBody: "Prawdziwy produkt wyjaśniłby teraz potrzebę dostępu. Ten przegląd nigdy nie wywołuje uprawnienia przeglądarki.",
    progress: "Lokalna symulacja wyszukiwania · krok 3 z 4",
    resultDecision: "Sprawdź przed decyzją",
    resultReason: "Dopasowano produkt syntetyczny, ale przetworzenia nie oceniono.",
    stateLabel: {
      "not-requested": "Nie poproszono o dostęp. Możesz wpisać kod ręcznie.",
      "permission-request": "Wyświetlono uzasadnienie dostępu. Okno przeglądarki nie jest otwarte.",
      "permission-denied": "W symulacji odmówiono dostępu. Ręczne wpisanie kodu jest dostępne.",
      "camera-unavailable": "Aparat jest niedostępny. Nie próbowano uzyskać dostępu.",
      ready: "Symulowany skaner jest gotowy. Umieść syntetyczny kod w kadrze.",
      "acquisition-assist": "Przybliż opakowanie i zachowaj cały kod w kadrze.",
      recognized: "Rozpoznano kod 5901234123457. Produkt nie został jeszcze dopasowany.",
      processing: "Kod odczytano. Trwa lokalne wyszukiwanie produktu.",
      matched: "Dopasowano North Grain Oat Drink z umiarkowaną wiarygodnością danych.",
      "partial-match": "Częściowe dopasowanie. Marka i kod pasują; brakuje danych o przetworzeniu.",
      "uncertain-match": "Mogą pasować dwa rekordy syntetyczne. Wynik nie jest wyświetlany do potwierdzenia tożsamości.",
      "not-found": "Kod jest prawidłowy, ale nie znaleziono syntetycznego rekordu produktu.",
      offline: "Rozpoznanie kodu może działać, ale wyszukiwanie produktu offline jest niedostępne.",
      interrupted: "Lokalny skan przerwano przed zakończeniem wyszukiwania.",
      resumed: "Wznowiono rozpoznawanie bez powielania wyszukiwania.",
      "manual-entry": "Ręczne wpisywanie kodu jest aktywne.",
      "invalid-barcode": "Ręczny kod jest nieprawidłowy.",
      "contribution-entry": "Przygotuj lokalny wkład dla brakującego rekordu produktu.",
    },
  },
  de: {
    eyebrow: "Signatur-Scanner · deterministische Simulation",
    title: "Code ausrichten. Jeden unsicheren Schritt sichtbar halten.",
    intro: "Kamera und Produktdienst sind nicht aktiv. Erkennung, Suche, Teiltreffer, Unterbrechung und Wiederaufnahme sind ausdrückliche lokale Zustände.",
    noCamera: "Kamera inaktiv",
    manual: "Strichcode manuell eingeben",
    request: "Berechtigungsanfrage prüfen",
    allow: "Simulation zulassen",
    deny: "Ablehnen",
    cancel: "Abbrechen",
    continue: "Erfassung fortsetzen",
    recognize: "Synthetischen Strichcode erkennen",
    process: "Evidenzergebnis aufbauen",
    retry: "Diese Stufe wiederholen",
    resume: "Unterbrochenen Scan fortsetzen",
    contribute: "Fehlenden Datensatz beitragen",
    rescan: "Weitere Simulation beginnen",
    manualLabel: "EAN-13-Strichcode",
    manualHint: "Festgelegten Prüfcode 5901234123457 verwenden.",
    manualSubmit: "Code lokal prüfen",
    invalid: "Den 13-stelligen synthetischen Prüfcode eingeben.",
    contributionLabel: "Produktname auf der Verpackung",
    contributionHint: "Nur lokale Prüfung; nichts wird hochgeladen.",
    contributionSubmit: "Lokalen Beitrag vorbereiten",
    permissionTitle: "Jetzt würde Kamerazugriff angefragt",
    permissionBody: "Ein reales Produkt würde an dieser Stelle den Bedarf erklären. Diese Prüfung ruft niemals eine Browserberechtigung auf.",
    progress: "Lokale Suchsimulation · Schritt 3 von 4",
    resultDecision: "Vor der Entscheidung prüfen",
    resultReason: "Ein synthetisches Produkt wurde gefunden, die Verarbeitung ist jedoch nicht bewertet.",
    stateLabel: {
      "not-requested": "Keine Berechtigung angefragt. Manuelle Eingabe ist verfügbar.",
      "permission-request": "Die Begründung wird gezeigt. Kein Browserdialog ist geöffnet.",
      "permission-denied": "Die Berechtigung wurde in der Simulation abgelehnt. Manuelle Eingabe bleibt verfügbar.",
      "camera-unavailable": "Kamerafunktion ist nicht verfügbar. Es wurde kein Zugriff versucht.",
      ready: "Scanner-Simulation bereit. Den synthetischen Strichcode im Rahmen ausrichten.",
      "acquisition-assist": "Verpackung näher bewegen und den vollständigen Code im Rahmen halten.",
      recognized: "Strichcode 5901234123457 erkannt. Produktidentität noch nicht zugeordnet.",
      processing: "Strichcode dekodiert. Die lokale Produktsuche läuft.",
      matched: "North Grain Oat Drink mit mittlerer Datenverlässlichkeit gefunden.",
      "partial-match": "Teiltreffer. Marke und Strichcode stimmen; Verarbeitungsevidenz fehlt.",
      "uncertain-match": "Zwei synthetische Datensätze könnten passen. Bis zur Bestätigung wird kein Wert gezeigt.",
      "not-found": "Der Strichcode ist gültig, aber kein synthetischer Produktdatensatz wurde gefunden.",
      offline: "Optische Erkennung kann fortfahren, die Produktsuche ist offline jedoch nicht verfügbar.",
      interrupted: "Der lokale Scan wurde vor Abschluss der Suche unterbrochen.",
      resumed: "Die Erkennung wurde ohne doppelte Suche fortgesetzt.",
      "manual-entry": "Manuelle Strichcodeeingabe ist aktiv.",
      "invalid-barcode": "Der manuelle Strichcode ist ungültig.",
      "contribution-entry": "Einen lokalen Beitrag für einen fehlenden Produktdatensatz vorbereiten.",
    },
  },
} as const;

function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
  switch (event) {
    case "request": return "permission-request";
    case "grant": return "ready";
    case "deny": return "permission-denied";
    case "assist": return "acquisition-assist";
    case "recognize": return "recognized";
    case "process": return "processing";
    case "match": return "matched";
    case "manual": return "manual-entry";
    case "invalid": return "invalid-barcode";
    case "contribute": return "contribution-entry";
    case "interrupt": return "interrupted";
    case "resume": return "resumed";
    case "retry": return state === "permission-denied" || state === "camera-unavailable" ? "not-requested" : "ready";
    case "cancel": return "not-requested";
  }
}

export function ScannerReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = SCANNER_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  const [state, dispatch] = useReducer(scannerReducer, route.state as ScannerState);
  const [barcode, setBarcode] = useState(route.state === "invalid-barcode" ? "123" : "5901234123457");
  const [contribution, setContribution] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const armedRef = useRef(false);
  const resumeTargetRef = useRef<ScannerState>("recognized");

  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, [state]);

  useEffect(() => {
    if (!armedRef.current) return;
    queueMicrotask(() => statusRef.current?.focus());
  }, [state]);

  useEffect(() => {
    if (state !== "processing" || !armedRef.current) return;
    const generation = ++generationRef.current;
    const timeout = window.setTimeout(() => {
      if (generationRef.current === generation) dispatch("match");
    }, route.motion === "reduced" ? 0 : 360);
    return () => window.clearTimeout(timeout);
  }, [route.motion, state]);

  function send(event: ScannerEvent) {
    armedRef.current = true;
    if (event === "interrupt") {
      resumeTargetRef.current = state === "processing" ? "recognized" : state;
      generationRef.current += 1;
    }
    if (event === "resume") {
      dispatch("resume");
      queueMicrotask(() => dispatch(resumeTargetRef.current === "recognized" ? "recognize" : "retry"));
      return;
    }
    dispatch(event);
  }

  function submitBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (barcode !== "5901234123457") {
      send("invalid");
      return;
    }
    send("recognize");
  }

  const stateText = copy.stateLabel[state];
  const uncertain = state === "uncertain-match" || state === "partial-match";

  return (
    <article className={styles.scannerReference} data-golden-client="scanner-machine" data-golden-live-state={state} ref={rootRef}>
      <header className={styles.scannerHeader}>
        <div><p className={styles.eyebrow}>{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p></div>
        <span className={styles.noCamera}><GoldenGlyph name="scanner" />{copy.noCamera}</span>
      </header>

      <section className={styles.scannerWorkspace}>
        <div className={styles.scannerViewport} data-scanner-state={state}>
          <span className={styles.scannerCorner} aria-hidden="true" />
          <div className={styles.barcode} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
          <p>{state === "ready" || state === "acquisition-assist" ? stateText : copy.noCamera}</p>
        </div>

        <div className={styles.scannerTask}>
          <div aria-atomic="true" aria-live="polite" className={styles.scannerStatus} ref={statusRef} role="status" tabIndex={-1}>
            <GoldenGlyph name={uncertain || state.includes("unavailable") || state.includes("denied") ? "unknown" : state === "matched" ? "decision" : "scanner"} size={32} />
            <div><span className={styles.eyebrow}>{state}</span><strong>{stateText}</strong></div>
          </div>

          {state === "permission-request" ? <div className={styles.permissionPanel}><h2>{copy.permissionTitle}</h2><p>{copy.permissionBody}</p></div> : null}
          {state === "processing" ? <div className={styles.scannerProgress} aria-busy="true"><label htmlFor="golden-scan-progress">{copy.progress}</label><progress id="golden-scan-progress" max={4} value={3}>3 / 4</progress></div> : null}
          {state === "manual-entry" || state === "invalid-barcode" ? (
            <form className={styles.manualForm} onSubmit={submitBarcode}>
              <Input error={state === "invalid-barcode" ? copy.invalid : undefined} hint={copy.manualHint} inputMode="numeric" label={copy.manualLabel} maxLength={13} name="golden-barcode" onChange={(event) => setBarcode(event.currentTarget.value)} value={barcode} />
              <Button type="submit">{copy.manualSubmit}</Button>
            </form>
          ) : null}
          {state === "contribution-entry" ? (
            <form className={styles.manualForm} onSubmit={(event) => { event.preventDefault(); send("cancel"); }}>
              <Input hint={copy.contributionHint} label={copy.contributionLabel} name="golden-contribution" onChange={(event) => setContribution(event.currentTarget.value)} value={contribution} />
              <Button type="submit">{copy.contributionSubmit}</Button>
            </form>
          ) : null}

          <div className={styles.scannerActions}>
            {state === "not-requested" ? <><Button onClick={() => send("request")}>{copy.request}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button></> : null}
            {state === "permission-request" ? <><Button onClick={() => send("grant")}>{copy.allow}</Button><Button onClick={() => send("deny")} variant="secondary">{copy.deny}</Button><Button onClick={() => send("cancel")} variant="quiet">{copy.cancel}</Button></> : null}
            {state === "ready" ? <><Button onClick={() => send("assist")}>{copy.continue}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button></> : null}
            {state === "acquisition-assist" || state === "resumed" ? <Button onClick={() => send("recognize")}>{copy.recognize}</Button> : null}
            {state === "recognized" ? <><Button onClick={() => send("process")}>{copy.process}</Button><Button onClick={() => send("interrupt")} variant="secondary">{copy.cancel}</Button></> : null}
            {state === "processing" && !armedRef.current ? <Button onClick={() => send("interrupt")} variant="secondary">{copy.cancel}</Button> : null}
            {state === "interrupted" ? <><Button onClick={() => send("resume")}>{copy.resume}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button></> : null}
            {["permission-denied", "camera-unavailable", "offline"].includes(state) ? <><Button onClick={() => send("manual")}>{copy.manual}</Button><Button onClick={() => send("retry")} variant="secondary">{copy.retry}</Button></> : null}
            {["partial-match", "uncertain-match", "not-found"].includes(state) ? <><Button onClick={() => send("retry")}>{copy.retry}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button><Button onClick={() => send("contribute")} variant="quiet">{copy.contribute}</Button></> : null}
            {state === "matched" ? <Button onClick={() => send("retry")}>{copy.rescan}</Button> : null}
            {(state === "manual-entry" || state === "invalid-barcode" || state === "contribution-entry") ? <Button onClick={() => send("cancel")} variant="quiet">{copy.cancel}</Button> : null}
          </div>
        </div>
      </section>

      {state === "matched" ? (
        <DecisionSummary copy={common} decision={copy.resultDecision} mainReason={copy.resultReason} nextAction={<a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/product?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=partial`}>{common.referenceNames.product}</a>} score={72} />
      ) : uncertain ? (
        <DecisionSummary confidence={common.unknown} confidenceReason={common.unknownInvariant} copy={common} decision={copy.resultDecision} mainReason={stateText} nextAction={<Button onClick={() => send("retry")}>{copy.retry}</Button>} score={null} />
      ) : null}
    </article>
  );
}
