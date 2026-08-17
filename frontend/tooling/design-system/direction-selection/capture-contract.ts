import path from "node:path";

export const DIRECTION_SELECTION_CANDIDATES = [
  "source-fold",
  "evidence-register",
  "open-core",
] as const;

export type DirectionSelectionCandidate =
  (typeof DIRECTION_SELECTION_CANDIDATES)[number];

export interface DirectionSelectionStill {
  readonly id: string;
  readonly surface: "identity" | "landing" | "home" | "product" | "scanner" | "motion";
  readonly width: 390 | 1440;
  readonly height: 844 | 900;
  readonly locale: "en" | "pl" | "de";
  readonly theme: "light" | "dark";
  readonly motion: "full" | "reduced";
  readonly state: string;
}

const STILL_STUDIES = [
  {
    id: "identity--1440x900--light",
    surface: "identity",
    width: 1440,
    height: 900,
    locale: "en",
    theme: "light",
    motion: "reduced",
    state: "canonical",
  },
  {
    id: "landing--390x844--light--pl",
    surface: "landing",
    width: 390,
    height: 844,
    locale: "pl",
    theme: "light",
    motion: "reduced",
    state: "settled",
  },
  {
    id: "home--1440x900--light--de",
    surface: "home",
    width: 1440,
    height: 900,
    locale: "de",
    theme: "light",
    motion: "reduced",
    state: "returning",
  },
  {
    id: "product--390x844--light--overview",
    surface: "product",
    width: 390,
    height: 844,
    locale: "en",
    theme: "light",
    motion: "reduced",
    state: "overview",
  },
  {
    id: "product--1440x900--dark--evidence",
    surface: "product",
    width: 1440,
    height: 900,
    locale: "en",
    theme: "dark",
    motion: "reduced",
    state: "evidence",
  },
  {
    id: "scanner--390x844--dark--matched",
    surface: "scanner",
    width: 390,
    height: 844,
    locale: "en",
    theme: "dark",
    motion: "reduced",
    state: "matched",
  },
  {
    id: "motion--1440x900--light--reduced",
    surface: "motion",
    width: 1440,
    height: 900,
    locale: "en",
    theme: "light",
    motion: "reduced",
    state: "complete",
  },
] as const satisfies readonly DirectionSelectionStill[];

export const DIRECTION_SELECTION_STILLS = DIRECTION_SELECTION_CANDIDATES.flatMap(
  (candidate) => STILL_STUDIES.map((study) => ({ candidate, ...study })),
);

export interface DirectionSelectionVideo {
  readonly kind: "motion-sequence" | "scanner-sequence";
  readonly surface: "motion" | "scanner";
  readonly width: 390 | 1440;
  readonly height: 844 | 900;
  readonly locale: "en";
  readonly theme: "light" | "dark";
  readonly motion: "full";
  readonly state: "start" | "ready";
}

export const DIRECTION_SELECTION_VIDEOS = DIRECTION_SELECTION_CANDIDATES.flatMap(
  (candidate) => [
    {
      candidate,
      kind: "motion-sequence",
      surface: "motion",
      width: 1440,
      height: 900,
      locale: "en",
      theme: "light",
      motion: "full",
      state: "start",
    },
    {
      candidate,
      kind: "scanner-sequence",
      surface: "scanner",
      width: 390,
      height: 844,
      locale: "en",
      theme: "dark",
      motion: "full",
      state: "ready",
    },
  ] as const,
);

export const DIRECTION_SELECTION_CONTACT_SHEETS = STILL_STUDIES.map((study) => ({
  id: study.id,
  width: study.width,
  height: study.height,
}));

export const DIRECTION_SELECTION_STILL_COUNT = DIRECTION_SELECTION_STILLS.length;
export const DIRECTION_SELECTION_VIDEO_COUNT = DIRECTION_SELECTION_VIDEOS.length;
export const DIRECTION_SELECTION_CONTACT_SHEET_COUNT =
  DIRECTION_SELECTION_CONTACT_SHEETS.length;
export const DIRECTION_SELECTION_BINARY_COUNT =
  DIRECTION_SELECTION_STILL_COUNT +
  DIRECTION_SELECTION_VIDEO_COUNT +
  DIRECTION_SELECTION_CONTACT_SHEET_COUNT;
export const DIRECTION_SELECTION_PACKAGE_FILE_COUNT =
  DIRECTION_SELECTION_BINARY_COUNT + 1;

export const DIRECTION_SELECTION_MAX_PNG_BYTES = 700 * 1024;
export const DIRECTION_SELECTION_MAX_VIDEO_BYTES = 3 * 1024 * 1024;
export const DIRECTION_SELECTION_MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
export const DIRECTION_SELECTION_VIDEO_STATE_DWELL_MS = 480;
export const DIRECTION_SELECTION_MIN_VIDEO_DURATION_MS = 2_000;
export const DIRECTION_SELECTION_MAX_VIDEO_DURATION_MS = 30_000;

export function getDirectionSelectionCandidateRoot(frontendRoot: string): string {
  return path.join(
    frontendRoot,
    "test-results",
    "phase5a2-direction-selection-candidates",
  );
}

export function getDirectionSelectionEvidenceRoot(repositoryRoot: string): string {
  return path.join(
    repositoryRoot,
    "docs",
    "phase5a2",
    "checkpoint-1",
    "evidence",
  );
}

export function directionSelectionRoute(
  candidate: DirectionSelectionCandidate,
  study: Pick<
    DirectionSelectionStill | DirectionSelectionVideo,
    "surface" | "locale" | "theme" | "motion" | "state"
  >,
): string {
  const query = new URLSearchParams({
    locale: study.locale,
    theme: study.theme,
    motion: study.motion,
    state: study.state,
    capture: "1",
  });
  return `/dev/phase5a2/${candidate}/${study.surface}?${query.toString()}`;
}

export function stillRelativePath(
  capture: (typeof DIRECTION_SELECTION_STILLS)[number],
): string {
  return path.posix.join("stills", `${capture.candidate}--${capture.id}.png`);
}

export function videoRelativePath(
  capture: (typeof DIRECTION_SELECTION_VIDEOS)[number],
): string {
  return path.posix.join(
    "motion",
    `${capture.candidate}--${capture.kind}--${capture.width}x${capture.height}--${capture.theme}.webm`,
  );
}

export function contactSheetRelativePath(
  capture: (typeof DIRECTION_SELECTION_CONTACT_SHEETS)[number],
): string {
  return path.posix.join("contact-sheets", `${capture.id}--all-candidates.png`);
}

export const DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS = [
  ...DIRECTION_SELECTION_STILLS.map(stillRelativePath),
  ...DIRECTION_SELECTION_VIDEOS.map(videoRelativePath),
] as const;

export const DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS = [
  ...DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS,
  ...DIRECTION_SELECTION_CONTACT_SHEETS.map(contactSheetRelativePath),
  "manifest.json",
] as const;
