"use client";

import { createContext } from "react";

export type InitialLanguage = "en" | "pl" | "de";

/** Request language supplied by the root client boundary before hydration. */
export const InitialLanguageContext = createContext<InitialLanguage | undefined>(
  undefined,
);
