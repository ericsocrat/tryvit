# Phase 4B candidate-category ranking

This ranking uses the merged Phase 4A fixture. Search relevance is an explicit proxy because no product-search event log is available.

| Rank | Scope | Score | Active | Missing ingredients | Missing allergens | Source complete | Ambiguity | Expected products | Expected allergen evidence | Selected |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 1 | Dairy (DE) | 97.12 | 287 | 259 (90.2%) | 261 (90.9%) | 97.7% | 1.40% | 253 | 237 | yes |
| 2 | Sweets (DE) | 96.29 | 299 | 251 (83.9%) | 251 (83.9%) | 97.2% | 0.10% | 244 | 235 | yes |
| 3 | Sweets (PL) | 92.61 | 300 | 257 (85.7%) | 257 (85.7%) | 87.5% | 0.70% | 225 | 212 | no |
| 4 | Drinks (DE) | 90.65 | 300 | 255 (85.0%) | 286 (95.3%) | 97.6% | 0.00% | 249 | 73 | yes |
| 5 | Dairy (PL) | 88.41 | 295 | 267 (90.5%) | 268 (90.8%) | 74.5% | 0.10% | 199 | 196 | no |
| 6 | Breakfast & Grain-Based (DE) | 86.26 | 199 | 199 (100.0%) | 199 (100.0%) | 98.0% | 0.10% | 195 | 191 | yes |
| 7 | Frozen & Prepared (DE) | 84.59 | 197 | 197 (100.0%) | 197 (100.0%) | 98.0% | 1.10% | 193 | 162 | no |
| 8 | Drinks (PL) | 82.30 | 300 | 262 (87.3%) | 298 (99.3%) | 76.3% | 0.00% | 200 | 32 | no |
| 9 | Instant & Frozen (DE) | 81.78 | 198 | 198 (100.0%) | 198 (100.0%) | 87.4% | 1.10% | 173 | 169 | no |
| 10 | Meat (DE) | 81.66 | 195 | 195 (100.0%) | 195 (100.0%) | 96.4% | 0.00% | 188 | 107 | no |
| 11 | Spreads & Dips (DE) | 80.49 | 198 | 198 (100.0%) | 198 (100.0%) | 88.4% | 1.10% | 175 | 131 | no |
| 12 | Bread (PL) | 80.01 | 293 | 251 (85.7%) | 251 (85.7%) | 61.4% | 0.50% | 154 | 150 | no |
| 13 | Canned Goods (DE) | 78.80 | 190 | 190 (100.0%) | 190 (100.0%) | 90.5% | 0.80% | 172 | 101 | no |
| 14 | Sauces (DE) | 78.70 | 200 | 200 (100.0%) | 200 (100.0%) | 91.0% | 0.80% | 182 | 62 | no |
| 15 | Sauces (PL) | 77.73 | 277 | 206 (74.4%) | 242 (87.4%) | 74.3% | 0.20% | 153 | 102 | no |
| 16 | Snacks (DE) | 77.70 | 152 | 152 (100.0%) | 152 (100.0%) | 99.3% | 0.70% | 151 | 145 | no |
| 17 | Bread (DE) | 76.64 | 195 | 149 (76.4%) | 150 (76.9%) | 98.0% | 0.20% | 146 | 145 | no |
| 18 | Nuts, Seeds & Legumes (DE) | 76.37 | 148 | 148 (100.0%) | 148 (100.0%) | 98.0% | 1.50% | 145 | 138 | no |
| 19 | Condiments (PL) | 75.92 | 220 | 174 (79.1%) | 199 (90.5%) | 83.3% | 0.30% | 145 | 120 | no |
| 20 | Alcohol (DE) | 74.41 | 150 | 149 (99.3%) | 149 (99.3%) | 91.9% | 0.00% | 137 | 122 | no |

## Selected categories

- **Dairy (DE)** — Largest reliable coverage gain in the candidate set, with explicit allergen evidence for most selected products.
- **Sweets (DE)** — High expected ingredient and allergen coverage gain with a 0.1% ambiguity rate.
- **Drinks (DE)** — High barcode relevance, 97.6% source completeness, and no ambiguous source tokens in the selected batch.
- **Breakfast & Grain-Based (DE)** — Dense explicit ingredient and allergen evidence, 98.0% source completeness, and high everyday search relevance.

The selection is limited to four distinct existing categories in DE. It does not add a country or perform a catalog-wide backfill.
