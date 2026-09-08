import { z } from "zod";
import { EVIDENCE_POLICY_VERSION } from "./product-read-model";

/** Explicit old-client boundary, not a nullable version of the former payload. */
export const RetiredPublicRpcSchema = z.object({
  api_version: z.literal("2"),
  policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  error: z.literal("refresh_required"),
  status: z.literal("refresh_required"),
  message: z.string().min(1),
}).strict();
