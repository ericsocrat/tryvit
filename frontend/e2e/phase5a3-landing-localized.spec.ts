import { expect, test } from "./fixtures/safe-test";

test("retains exact project-locale landing evidence", async ({ page }, testInfo) => {
  const polish = testInfo.project.name === "phase5a3-landing-polish";
  const language = polish ? "pl" : "de";
  const theme = polish ? "light" : "dark";
  const filename = polish
    ? "landing--390x844--text-spacing--pl.png"
    : "landing--1440x900--dark--de.png";

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
      name: polish ? "Nawigacja w stopce" : "Fußzeilennavigation",
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    polish
      ? "TryVit — dane o żywności, które można sprawdzić"
      : "TryVit — nachprüfbare Lebensmittelinformation",
  );

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

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  await page.screenshot({ path: testInfo.outputPath(filename), animations: "disabled" });
});
