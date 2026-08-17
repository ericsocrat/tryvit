export const PHASE5A2_FIXTURE = Object.freeze({
  id: "north-grain-oat-drink",
  productName: "North Grain Oat Drink — review fixture",
  ean: "5901234123457",
  observedOn: "2026-07-14",
  conceptDecisionScore: 72,
  confidence: Object.freeze({
    level: "moderate",
    explanation: "one package transcription, no independent verification",
  }),
  nutritionPer100ml: Object.freeze({
    energyKj: 193,
    energyKcal: 46,
    fatG: 1.5,
    saturatesG: 0.2,
    carbohydratesG: 7.4,
    sugarsG: 3.2,
    fibreG: 0.8,
    proteinG: 1,
    saltG: 0.1,
  }),
  allergens: Object.freeze({
    contains: Object.freeze(["oats"]),
    mayContain: Object.freeze(["soy"]),
  }),
  unknowns: Object.freeze(["processing classification unconfirmed"]),
  flags: Object.freeze({
    synthetic: true,
    reviewOnly: true,
    notMedicalAdvice: true,
  }),
});

export const PHASE5A2_FIXTURE_SHA256 =
  "6914a31758740013d31c07c9d1414b43a6de3b81acb35e0041b548adaddb5074";
