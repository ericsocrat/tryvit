import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const seeder = readFileSync(path.resolve(__dirname, "quality", "seed-fixtures.mjs"), "utf8");

describe("Nightly evidence fixture contract", () => {
  it("creates source evidence only through the service-owned ingestion RPC", () => {
    expect(seeder).toContain('supabase.rpc("ingestion_apply_observation"');
    expect(seeder).toContain('extractor_version: "off-observations-v1"');
    expect(seeder).toContain('idempotency_key: "qa-evidence-ui-current-v1"');
    expect(seeder).not.toMatch(
      /\.from\("(?:ingestion_batches|product_source_observations|product_source_assertions|product_field_provenance)"\)[\s\S]{0,160}\.(?:insert|update|upsert|delete)\(/u,
    );
    expect(seeder).not.toContain("ingestion_observation_immutable");
  });

  it("fails closed unless the pair resolves through the authenticated read model", () => {
    const verification = seeder.indexOf(
      "await verifyEvidenceReadModel(observedEvidence, productFullId)",
    );
    const output = seeder.indexOf(
      "`EVIDENCE_UI_PRODUCT_IDS=${observedEvidence.productId},${productFullId}`",
    );

    expect(seeder).toContain('reader.rpc("api_product_read_model"');
    expect(seeder).toContain("Could not reactivate the source-observed local fixture");
    expect(seeder).toContain('observedModel?.evidence?.state !== "recorded"');
    expect(seeder).toContain('legacyModel?.evidence?.state !== "legacy_unverified"');
    expect(seeder).toContain("await assertSourceFreeLegacyProduct(productFullId)");
    expect(verification).toBeGreaterThanOrEqual(0);
    expect(output).toBeGreaterThan(verification);
  });

  it("keeps immutable evidence inside the hosted ephemeral lifecycle", () => {
    const credentialGuard = seeder.indexOf(
      "if (!SUPABASE_URL || !SERVICE_KEY || (SEED_EPHEMERAL_EVIDENCE && !ANON_KEY))",
    );
    const firstClient = seeder.indexOf("const supabase = createClient(");

    expect(credentialGuard).toBeGreaterThanOrEqual(0);
    expect(firstClient).toBeGreaterThan(credentialGuard);
    expect(seeder).toContain('process.env.GITHUB_ACTIONS === "true"');
    expect(seeder).toContain("NIGHTLY_CURRENT_BEHAVIOR && !SEED_EPHEMERAL_EVIDENCE");
    expect(seeder).toContain("const observedEvidence = SEED_EPHEMERAL_EVIDENCE");
    expect(seeder).toContain('process.env.VISUAL_SAFETY_MODE !== "local-authenticated"');
    expect(seeder).toContain("requestedOrigin !== configuredOrigin");
    expect(seeder).toContain('reader.auth.signOut({ scope: "global" })');
    expect(seeder).toContain("supabase.auth.admin.deleteUser(userId)");
    expect(seeder).toContain("Source observations are immutable and deliberately untouched");
  });
});
