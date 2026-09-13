# Security

## Known Vulnerabilities

Current dependency status verified 2026-09-13:

- `next` and `eslint-config-next` are pinned to **16.3.5**. The former Next.js
  14.x advisory dispositions are historical and no longer describe the installed
  framework.
- The HIGH/CRITICAL production-dependency audit passed on the exact dependency
  changes merged through PRs [#1370][1] and [#1352][2].
- Dependabot alert #94 ([`GHSA-jmr9-qjv8-65gv`][3]) and alert #102
  ([`GHSA-7pqw-9j4j-h8q3`][4]) remain open for the same transitive,
  development-only `extract-zip@2.0.1` installation. Neither advisory has a
  patched release. The package is present through the LHCI/Puppeteer tooling
  chain; the guarded Lighthouse path uses the pinned Playwright browser and does
  not invoke the affected archive-extraction path. This is a bounded disposition,
  not a claim that either advisory is fixed.

Re-run `cd frontend && npm audit --omit=dev --audit-level=high` and inspect open
Dependabot alerts before carrying this dated status forward. See the dated
addenda in [the detailed audit](docs/SECURITY_AUDIT.md).

[1]: https://github.com/ericsocrat/tryvit/pull/1370
[2]: https://github.com/ericsocrat/tryvit/pull/1352
[3]: https://github.com/advisories/GHSA-jmr9-qjv8-65gv
[4]: https://github.com/advisories/GHSA-7pqw-9j4j-h8q3

## Public Repository Licensing & IP Guardrails

This is a public repository by design. Source visibility is expected.

- **Code license:** AGPL-3.0 in `LICENSE`.
- **Data license:** CC BY-NC-SA 4.0 in `DATA_LICENSE.md`.
- **Operational security model:** Secrets are never committed; production secrets are
  managed via environment variables and CI/provider secret stores.
- **Abuse resistance:** RLS, reviewed API contracts, rate limits, and query guardrails.

### What Public Visibility Means

- Schema, migrations, and implementation details are intentionally visible.
- Competitive protection comes from licensing terms and operational execution,
  not code secrecy.
- Any accidental secret disclosure must be treated as an incident: rotate keys,
  purge from history, and document remediation.

---

## Threat Model

TryVit is an invitation-only, authentication-gated evidence product. It stores
Supabase account identifiers and user-owned data such as preferences, saved
lists and comparisons, saved searches, scan history, and submissions. Product
records are not personal data, but the application as a whole does process
personal and potentially sensitive preference data. The consumer aggregate
health score has been retired; historical score data is not current decision
authority.

Current access-control invariants are:

- consumer read and mutation APIs require an authenticated user unless an
  explicitly reviewed public contract says otherwise;
- owner data is constrained by ownership checks and RLS, not merely by the
  `authenticated` database role;
- anonymous shared-list and shared-comparison reads require the corresponding
  opaque share token and expose only their reviewed projections;
- ingestion, administration, diagnostics, and other privileged operations are
  restricted to `service_role` or a narrower server-owned boundary;
- client-facing roles do not receive raw access merely because an object exists
  in an exposed schema; and
- secrets remain in environment/provider secret stores and no `service_role`
  credential is exposed through a `NEXT_PUBLIC_` variable.

The authoritative object-level grants, RLS policies, function security modes,
and search paths are the append-only migrations plus the final-schema tests in
`supabase/tests/` and `db/qa/`. This overview intentionally avoids hard-coded
table, function, or assertion counts. Run `RUN_QA.ps1` and the repository's
security workflows against the exact source under review before making a
current-posture claim.

Self-service signup remains disabled for private beta. The dormant native
CAPTCHA path must stay fail closed, and genuine production Turnstile
first-use/replay remains a separate proof boundary until a dated production
record establishes it.
