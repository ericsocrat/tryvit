import * as z from "zod/mini";

/** Same accepted numbers as z.int(), without unrelated numeric formats.
 * Field schemas retain their own positive, nonnegative and range checks.
 */
export const EvidenceInteger = z.number().check(z.refine(Number.isSafeInteger));
