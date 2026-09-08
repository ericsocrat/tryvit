import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendDir = join(__dirname, "../..");

const languages = [
  { locale: "en", flour: "flour", count: "count alone does not", unknown: "unknown", exception: "exempt", missing: "missing", risk: "not converted" },
  { locale: "pl", flour: "mąka", count: "liczba składników nie", unknown: "nieznane", exception: "wyjątk", missing: "niepełne", risk: "Nie przelicza" },
  { locale: "de", flour: "Mehl", count: "Zahl der Zutaten allein", unknown: "unbekannt", exception: "Ausnahmen", missing: "fehlen", risk: "nicht in" },
];

describe.each(languages)("Food education evidence boundaries ($locale)", (language) => {
  const { learn } = JSON.parse(readFileSync(join(frontendDir, "messages", `${language.locale}.json`), "utf8"));

  it("distinguishes a recorded Nutri-Score from a known algorithm version", () => {
    expect(learn.nutriScore.whatIsText).toContain("100 g");
    expect(learn.nutriScore.whatIsText).toContain("100 ml");
    expect(learn.nutriScore.howItWorksText).toContain("2025");
    expect(learn.nutriScore.ourApproachText).toContain(language.unknown);
    expect(learn.nutriScore.negativeLabel).not.toContain("0–10");
    expect(learn.nutriScore.positiveLabel).not.toContain("0–5");
  });

  it("does not classify flour as a culinary extract or count ingredients as NOVA 4", () => {
    expect(learn.novaGroups.group1Text).toContain(language.flour);
    expect(learn.novaGroups.group2Text).not.toContain(language.flour);
    expect(learn.novaGroups.group4Text).toContain(language.count);
    expect(learn.novaGroups.processingRiskText).toContain(language.risk);
    expect(JSON.stringify(learn.novaGroups)).not.toMatch(/NOVA 1–2|NOVA 1-2/);
  });

  it("retains all allergen categories with both sulphite units and a package-check boundary", () => {
    for (let i = 1; i <= 14; i++) {
      expect(learn.allergens[`allergen${i}`]).toBeTruthy();
    }
    expect(learn.allergens.allergen12).toContain(">10 mg/kg");
    expect(learn.allergens.allergen12).toContain(">10 mg/l");
    expect(learn.allergens.allergen12).toContain("SO₂");
    expect(learn.allergens.inTryVitText).toContain(language.missing);
  });

  it("qualifies nutrition-declaration obligations and distinguishes maltodextrin from sugars", () => {
    expect(learn.readingLabels.nutritionTableText).toContain("1169/2011");
    expect(learn.readingLabels.nutritionTableText).toContain(language.exception);
    expect(learn.readingLabels.nutritionTableText).toContain("100 ml");
    expect(learn.readingLabels.tip4).toMatch(/Maltodextrin|Maltodekstryna/);
    expect(learn.readingLabels.tip4).toMatch(/not equivalent|nie jest równoważna|entspricht nicht/);
    expect(learn.readingLabels.per100gText).not.toContain("TryVit");
  });
});

describe("Food education source scope", () => {
  it.each(["allergens", "reading-labels"])("%s cites the checked consolidated regulation", (topic) => {
    const page = readFileSync(join(frontendDir, "src/app/learn", topic, "page.tsx"), "utf8");
    expect(page).toContain("02011R1169-20250401");
    expect(page).toContain("consolidated 1 April 2025");
  });

  it("Nutri-Score cites scheme documentation instead of unrelated fat intake guidance", () => {
    const page = readFileSync(join(frontendDir, "src/app/learn/nutri-score/page.tsx"), "utf8");
    expect(page).toContain("https://www.santepubliquefrance.fr/nutri-score");
    expect(page).not.toContain("pub/1461");
  });
});
