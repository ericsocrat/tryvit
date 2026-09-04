/**
 * Health profile domain RPC contracts — Zod schemas for response validation.
 *
 * Covers: api_list_health_profiles, api_get_active_health_profile,
 *         api_product_health_warnings
 *
 * @see Issue #179 — Schema-to-UI Contract Validation
 */

import { z } from "zod";
import { HealthConditionSchema, WarningSeveritySchema } from "./helpers";

// ─── Shared fragments ───────────────────────────────────────────────────────

const HealthProfileSchema = z
  .object({
    profile_id: z.string(),
    profile_name: z.string(),
    is_active: z.boolean(),
    health_conditions: z.array(HealthConditionSchema),
    max_sugar_g: z.number().nullable(),
    max_salt_g: z.number().nullable(),
    max_saturated_fat_g: z.number().nullable(),
    max_calories_kcal: z.number().nullable(),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

// ─── api_list_health_profiles ───────────────────────────────────────────────

export const HealthProfileListContract = z
  .object({
    api_version: z.string(),
    profiles: z.array(HealthProfileSchema),
  })
  .passthrough();

// ─── api_get_active_health_profile ──────────────────────────────────────────

export const HealthProfileActiveContract = z
  .object({
    api_version: z.string(),
    profile: HealthProfileSchema.nullable(),
  })
  .passthrough();

// ─── api_product_health_warnings ────────────────────────────────────────────

const HealthWarningSchema = z
  .object({
    condition: z.string(),
    severity: WarningSeveritySchema,
    message: z.string(),
  })
  .passthrough();

const HealthWarningEvidenceCompletenessSchema = z
  .object({
    status: z.enum([
      "complete",
      "incomplete",
      "unavailable",
      "not_applicable",
    ]),
    required_count: z.number().int().nonnegative(),
    evaluated_count: z.number().int().nonnegative(),
    required: z.array(z.string()),
    evaluated: z.array(z.string()),
    missing: z.array(z.string()),
  })
  .passthrough();

export const HealthWarningsContract = z
  .object({
    api_version: z.string(),
    product_id: z.number(),
    warning_count: z.number(),
    warnings: z.array(HealthWarningSchema),
    evidence_completeness: HealthWarningEvidenceCompletenessSchema,
    evaluation_disposition: z.enum([
      "evaluated",
      "partial",
      "withheld",
      "not_applicable",
      "not_evaluated",
    ]),
  })
  .passthrough();
