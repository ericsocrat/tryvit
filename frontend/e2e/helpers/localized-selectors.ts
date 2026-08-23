import type { Page } from "@playwright/test";

export const SEARCH_PRODUCTS_NAME =
  /search products|szukaj produktów|produkte suchen/i;

export function getSearchProductsCombobox(page: Page) {
  return page
    .getByRole("search")
    .getByRole("combobox", { name: SEARCH_PRODUCTS_NAME });
}
