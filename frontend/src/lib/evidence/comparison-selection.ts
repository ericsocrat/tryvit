/** Strict, order-preserving selection parsing shared by the route and its tests. */
export function parseComparisonIds(value: string): { ids: number[]; invalid: boolean } {
  if (!value) return { ids: [], invalid: false };
  const parts = value.split(",");
  if (parts.some((part) => !/^[1-9][0-9]*$/.test(part))) return { ids: [], invalid: true };
  const ids = [...new Set(parts.map(Number))];
  return ids.length > 4 || ids.some((id) => !Number.isSafeInteger(id)) ? { ids: [], invalid: true } : { ids, invalid: false };
}
