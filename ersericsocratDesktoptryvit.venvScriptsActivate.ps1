[35m.github/REPOSITORY_SETTINGS.md[m[36m:[m- **Description:** `Science-driven food quality database for [1;31mPoland[m & Germany. 9-factor scoring (v3.2), 1,281 products, 2,995 ingredients, EFSA concern analysis, allergen tracking, barcode scanning. PostgreSQL + Supabase + Next.js + TypeScript.`
[35m.github/REPOSITORY_SETTINGS.md[m[36m:[m- **Topics (20):** `food-database`, `food-quality`, `nutrition`, `health`, `nutri-score`, `nova-score`, `food-safety`, `allergens`, `ingredients`, `barcode-scanner`, `[1;31mpoland[m`, `germany`, `postgresql`, `supabase`, `nextjs`, `typescript`, `open-food-facts`, `efsa`, `food-science`, `health-tech`
[35mCHANGELOG.md[m[36m:[mAll notable changes to the **[1;31mPoland[m Food Quality Database** are documented here.
[35mCHANGELOG.md[m[36m:[m- Rename project from `[1;31mpoland[m-food-db` to `TryVit` across all source files:
[35mCURRENT_STATE.md[m[36m:[m- **Open PRs:** [#546](https://github.com/ericsocrat/tryvit/pull/546) — chore(cleanup): rename [1;31mpoland[m-food-db → TryVit across all source files
[35mCURRENT_STATE.md[m[36m:[m| 2026-03-02 | #546 | chore(cleanup): rename [1;31mpoland[m-food-db → TryVit across all source files (open PR, awaiting CI) |
[35mREADME.md[m[36m:[m  <strong>A transparent, multi-axis food quality database for [1;31mPoland[m and Germany.</strong><br />
[35mcopilot-instructions.md[m[36m:[m> **Scope:** [1;31mPoland[m (`PL`) primary + Germany (`DE`) micro-pilot (252 products across 5 categories)
[35mcopilot-instructions.md[m[36m:[mYou are a **food scientist, nutrition researcher, and senior data engineer** maintaining a science-driven food quality database for products sold in [1;31mPoland[m.
[35mcopilot-instructions.md[m[36m:[mcountries_tags_en=[1;31mpoland[m) sql_generator.py 03_add_nutrition ingredient_ref
[35mdb/pipelines/zabka/PIPELINE__zabka__01_insert_products.sql[m[36m:[m-- 28 verified products sold at Żabka convenience stores in [1;31mPoland[m.
[35mdocs/BRAND_GUIDELINES.md[m[36m:[mEmpower consumers in [1;31mPoland[m (and expanding to Europe) to make healthier food choices by providing transparent, science-driven quality scores for grocery products — grounded in real EU label data, never invented.
[35mdocs/BRAND_GUIDELINES.md[m[36m:[m| **European**     | [1;31mPoland[m-first, EU regulatory alignment, RODO/GDPR compliant, multi-language ready.          |
[35mdocs/COUNTRY_EXPANSION_GUIDE.md[m[36m:[m> **Current status:** [1;31mPoland[m (`PL`) is fully active (1,025 products, 20 categories). Germany (`DE`) is active as a micro-pilot (51 chips products).
[35mdocs/COUNTRY_EXPANSION_GUIDE.md[m[36m:[m- [ ] Identify the national food safety authority (equivalent of [1;31mPoland[m's GIS/SANEPID)
[35mdocs/COUNTRY_EXPANSION_GUIDE.md[m[36m:[m- A product sold in both [1;31mPoland[m and Germany is entered as **two separate rows** with `country = 'PL'` and `country = 'DE'`, because formulations differ.
[35mdocs/COUNTRY_EXPANSION_GUIDE.md[m[36m:[m| Aspect                | [1;31mPoland[m (PL)            | Germany (DE) — Example       |
[35mdocs/COUNTRY_EXPANSION_GUIDE.md[m[36m:[m| 1     | [1;31mPoland[m  | PL   | Founder's market; full access to labels            | **Active**                         |
[35mdocs/DATA_SOURCES.md[m[36m:[m> **Scope:** [1;31mPoland[m (`PL`) only
[35mdocs/DATA_SOURCES.md[m[36m:[m- **Never mix country variants.** Lay's Classic in [1;31mPoland[m has different salt/fat content than Lay's Classic in the UK. Always confirm the product is the **Polish SKU**.
[35mdocs/DATA_SOURCES.md[m[36m:[mUnder **Regulation (EU) No 1169/2011**, all pre-packaged food sold in [1;31mPoland[m must display (per 100g or 100ml):
[35mdocs/DATA_SOURCES.md[m[36m:[m| Mars Polska                  | https://www.mars.com/[1;31mpoland[m-pl        | Sweets (Snickers, M&M's, Twix)                               | Use PL country selector                |
[35mdocs/DATA_SOURCES.md[m[36m:[m- **Polish search:** `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&countries_tags=en:[1;31mpoland[m&json=1`
[35mdocs/DATA_SOURCES.md[m[36m:[m- **Filter by:** Country = [1;31mPoland[m (`countries_tags` must include `en:[1;31mpoland[m`), or search by EAN barcode
[35mdocs/DATA_SOURCES.md[m[36m:[m[1;31mPoland[m has a distinctive retail structure relevant to product coverage:
[35mdocs/DATA_SOURCES.md[m[36m:[m### 7.3 Nutri-Score Availability in [1;31mPoland[m
[35mdocs/DATA_SOURCES.md[m[36m:[mAs of 2026, Nutri-Score is **voluntary** in [1;31mPoland[m. Many products do not display it on the label. When Nutri-Score is unavailable:
[35mdocs/DATA_SOURCES.md[m[36m:[m| Products not sold in [1;31mPoland[m       | Out of scope; even if the brand exists globally             |
[35mdocs/NAME_CANDIDATES.md[m[36m:[m6. **Scales to any market.** Not tied to [1;31mPoland[m, EU, or any geography.
[35mdocs/PRIVACY_CHECKLIST.md[m[36m:[m> **Scope:** [1;31mPoland[m (PL) primary market + Germany (DE) micro-pilot
[35mdocs/PRIVACY_CHECKLIST.md[m[36m:[m- Address: ul. Stawki 2, 00-193 Warszawa, [1;31mPoland[m
[35mdocs/PRIVACY_CHECKLIST.md[m[36m:[m| **[1;31mPoland[m (PL)**  | RODO (Ustawa z 10.05.2018)     | UODO           | Polish required         | ⬜ Pending               |
[35mdocs/PRODUCTION_DATA.md[m[36m:[m| 8   | `chips-pl/`                 | PL      | Chips ([1;31mPoland[m)             |
[35mdocs/PRODUCTION_DATA.md[m[36m:[m- **[1;31mPoland[m (PL):** 20 categories, fully active, ~1,025 products
[35mdocs/PRODUCTION_DATA.md[m[36m:[m**Data source:** Open Food Facts API v2 (`/api/v2/search`), filtered by `countries_tags_en=[1;31mpoland[m`.
[35mdocs/RESEARCH_WORKFLOW.md[m[36m:[m- [ ] Currently sold in [1;31mPoland[m (not discontinued, not seasonal-only unless flagged)
[35mdocs/RESEARCH_WORKFLOW.md[m[36m:[m| `countries_tags`                | Verify `en:[1;31mpoland[m`    | MUST contain [1;31mPoland[m      |
[35mdocs/RESEARCH_WORKFLOW.md[m[36m:[m1. `countries_tags` includes `en:[1;31mpoland[m`
[35mdocs/RESEARCH_WORKFLOW.md[m[36m:[mGET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&search_simple=1&countries_tags=en:[1;31mpoland[m&json=1
[35mdocs/RESEARCH_WORKFLOW.md[m[36m:[m- [ ] Products confirmed currently sold in [1;31mPoland[m
[35mdocs/UX_UI_DESIGN.md[m[36m:[m**Currently active:** PL ([1;31mPoland[m). Additional countries can be activated by inserting into `country_ref` with `is_active = true`.
[35mdocs/assets/banners/og-image.svg[m[36m:[m  <text x="600" y="285" text-anchor="middle" fill="#2dd4bf" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="22" font-weight="500" letter-spacing="0.02em">Science-driven food quality intelligence for [1;31mPoland[m &amp; Germany</text>
[35mdocs/assets/banners/readme-banner.svg[m[36m:[m  <text x="600" y="268" text-anchor="middle" fill="#94a3b8" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="14" font-weight="400">Multi-axis scoring · 1,281 products · 25 categories · [1;31mPoland[m + Germany</text>
[35mdocs/decisions/003-country-scoped-isolation.md[m[36m:[mThe database started as [1;31mPoland[m-only but needs to support multiple countries (Germany micro-pilot launched with 51 Chips products). Two architectural approaches were considered:
[35mdocs/decisions/007-english-canonical-ingredients.md[m[36m:[mProduct labels in [1;31mPoland[m use Polish ingredient names. Open Food Facts provides ingredients in the product's original language (often Polish, sometimes mixed Polish/English/German). The database needs a canonical ingredient dictionary for:
[35mdocs/diagrams/country-expansion.mmd[m[36m:[m    subgraph PL["[1;31mPoland[m (PL) — Primary Market"]
[35mdocs/diagrams/country-expansion.svg[m[36m:[m<svg xmlns="http://www.w3.org/2000/svg" id="my-svg" width="100%" aria-roledescription="flowchart-v2" class="flowchart" style="font-family:&quot;trebuchet ms&quot;,verdana,arial,sans-serif;font-size:14px;fill:#0f172a