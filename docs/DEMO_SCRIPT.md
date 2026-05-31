# Demo Script — TryVit (3–5 minutes)

> **Last updated:** 2026-05-31
> **Status:** Active
> **Owner issue:** —

A runnable walkthrough for demoing TryVit locally. Target length: 3–5 minutes.
Each step lists what to show and the point it proves. A recovery branch is
included in case the live scanner fails.

For environment details see [`VIEWING_AND_TESTING.md`](VIEWING_AND_TESTING.md) and
[`../CURRENT_STATE.md`](../CURRENT_STATE.md).

---

## 0. Pre-flight (before the audience joins)

```powershell
Set-Location c:/Users/ericsocrat/Desktop/tryvit

# Start the database and confirm it is healthy
supabase status

# Start the frontend dev server (separate terminal)
cd frontend; npm run dev   # http://localhost:3000
```

Confirm before starting:

- Supabase is running and seeded (local DB has product rows; if empty, run `.\RUN_LOCAL.ps1`).
- `http://localhost:3000` loads the landing page.
- Have one known barcode ready as a fallback (see step 3 recovery).

---

## 1. Landing & positioning (~30s)

- Open `http://localhost:3000`.
- **Say:** "TryVit scores food products on multiple independent health axes — not a single letter grade."
- **Show:** the hero and the multi-axis pitch.
- **Proves:** clear positioning vs. single-grade apps.

---

## 2. Category browse & scoring (~60s)

- Navigate to **Categories** → pick a category (e.g. Chips or Dairy).
- **Show:** products ranked, each with a health score and band color.
- Open one product detail page.
- **Show:** the score breakdown — the 9 weighted factors, each with its contribution, plus Nutri-Score, NOVA, and the confidence score.
- **Proves:** explainability and multi-axis scoring.

---

## 3. Barcode scan (~60s)

- Go to **Scan**.
- **Show:** the camera-based EAN-13 scanner; scan a product barcode.
- **Show:** the matched product and its full scoring breakdown.
- **Proves:** real-world lookup from barcode to auditable score.

### Recovery branch — if the scanner fails

Cameras and permissions are the most fragile part of any live demo. If the feed is
black or no permission is granted:

1. Switch the scanner to **manual entry** and type a known EAN, **or**
2. Use the **Search** flow to open the same product by name, **or**
3. Open the product detail page directly by ID.

Then continue at step 4 as if the scan succeeded. Do not debug the camera live.

---

## 4. Compare & confidence (~45s)

- Add 2–4 products to **Compare**.
- **Show:** side-by-side factor comparison; point out differing additive counts and confidence scores.
- **Say:** "The confidence score tells you how complete the underlying data is, so you know how much to trust each number."
- **Proves:** transparency and data-quality visibility.

---

## 5. Wrap-up (~30s)

- **Say:** "Every number you saw is traceable to its source and validated by 776 automated QA checks before it ever reaches the app."
- Point to [`PRODUCT_POSITIONING.md`](PRODUCT_POSITIONING.md) for scope and non-goals.

---

## Reset after the demo

```powershell
# Stop the dev server with Ctrl+C in its terminal.
# The local database can be left running for the next session.
```
