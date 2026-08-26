import { expect, test } from "./fixtures/safe-test";
import { expectLandingPackageTextRegions } from "./helpers/landing-package-geometry";

test("retains exact project-locale landing evidence", async ({ page }, testInfo) => {
  const polish = testInfo.project.name === "phase5a3-landing-polish";
  const language = polish ? "pl" : "de";
  const theme = polish ? "light" : "dark";
  const filename = polish
    ? "landing--390x844--text-spacing--pl.png"
    : "landing--1440x900--dark--de.png";
  const description = polish
    ? "TryVit oddziela dane z etykiety od obliczeń, kontekstu i decyzji. Metoda pozostaje dostępna, gdy dane produktów na żywo są wstrzymane."
    : "TryVit trennt Verpackungsangaben von Berechnungen, Kontext und Entscheidungen. Die Methode bleibt verfügbar, während Live-Produktdaten pausiert sind.";
  const socialDescription = polish
    ? "Metoda TryVit oparta na danych i źródłach pozostaje dostępna, gdy dane produktów na żywo są wstrzymane; wszystkie przykłady są syntetyczne."
    : "Die evidenzorientierte TryVit-Methode bleibt verfügbar, während Live-Produktdaten pausiert sind; alle Beispiele sind synthetisch.";

  await page.addInitScript((mode: string) => localStorage.setItem("theme", mode), theme);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(
    page.getByRole("link", {
      name: polish ? "Przejdź do treści" : "Zum Inhalt springen",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("navigation", {
      name: polish ? "Główna nawigacja" : "Hauptnavigation",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", {
      name: polish ? "Konto, usługa i wygląd" : "Konto, Dienst und Darstellung",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", {
      name: polish ? "Nawigacja w stopce" : "Fußzeilennavigation",
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    polish
      ? "TryVit — dane o żywności, które można sprawdzić"
      : "TryVit — nachprüfbare Lebensmittelinformation",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    socialDescription,
  );
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    "content",
    socialDescription,
  );
  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? "{}")));
  expect(structuredData).toHaveLength(1);
  expect(structuredData[0]).toMatchObject({
    "@type": "WebSite",
    inLanguage: language,
    description,
  });

  if (polish) {
    await expect(
      page.getByRole("heading", {
        name: "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
      }),
    ).toBeVisible();
    await page.addStyleTag({
      content: `
        * { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }
      `,
    });
  } else {
    await expect(
      page.getByRole("heading", {
        name: "Verpackung lesen. Begründung verstehen. Selbst entscheiden.",
      }),
    ).toBeVisible();
    await expect(page.getByText(/Datenverlässlichkeit/iu).first()).toBeVisible();
  }

  await expectLandingPackageTextRegions(page);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  await page.screenshot({ path: testInfo.outputPath(filename), animations: "disabled" });
});

test("keeps localized package text regions separate at 390px", async ({ page }, testInfo) => {
  const polish = testInfo.project.name === "phase5a3-landing-polish";
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", polish ? "pl" : "de");
  if (polish) {
    await page.addStyleTag({
      content: `
        * { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }
      `,
    });
  }
  await expectLandingPackageTextRegions(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
