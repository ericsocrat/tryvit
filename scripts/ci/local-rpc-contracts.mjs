import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const expectedIntegrationTests = 31;

export function assertCompleteRpcReport(report) {
  const assertions = report.testResults?.flatMap(result => result.assertionResults ?? []) ?? [];
  if (report.success !== true || report.numTotalTests !== expectedIntegrationTests ||
      report.numPassedTests !== expectedIntegrationTests || report.numFailedTests !== 0 ||
      report.numPendingTests !== 0 || assertions.length !== expectedIntegrationTests ||
      assertions.some(result => result.status !== 'passed')) {
    throw new Error('RPC_CONTRACT_INCOMPLETE: expected exactly 31 executed passing integration assertions');
  }
}

export async function runLocalRpcContracts() {
  const { resolveVisualSafetyLocalRuntime, preflightLocalEmulator, sanitizedChildEnvironment } =
    await import('../../frontend/e2e/scripts/visual-safety-cli.mts');
  const { createLocalAuthenticatedSafetyContract } = await import('../../frontend/e2e/helpers/visual-safety.ts');
  // CI must build and test the checked-out candidate, never another checkout.
  if (process.env.CI === 'true' && process.env.VISUAL_SAFETY_LOCAL_RUNTIME_ROOT) {
    throw new Error('RPC_CONTRACT_CANDIDATE_OVERRIDE_DENIED');
  }
  const runtime = await resolveVisualSafetyLocalRuntime(process.env, root);
  const contract = createLocalAuthenticatedSafetyContract({ appOrigin: 'http://127.0.0.1:3000', supabaseOrigin: runtime.origin });
  const credentials = await preflightLocalEmulator(contract, runtime);
  if (!credentials) throw new Error('RPC_CONTRACT_LOCAL_CREDENTIALS_UNAVAILABLE');
  if (process.env.GITHUB_ACTIONS === 'true') {
    // These are generated local credentials, never hosted project secrets.
    for (const value of [credentials.anonKey, credentials.serviceRoleKey]) process.stdout.write(`::add-mask::${value}\n`);
  }
  const env = sanitizedChildEnvironment(process.env, 'local-authenticated', runtime.origin, credentials);
  env.SUPABASE_SERVICE_ROLE_KEY = credentials.serviceRoleKey;
  env.INTEGRATION = '1';
  const directory = mkdtempSync(path.join(tmpdir(), 'tryvit-local-rpc-'));
  try {
    const reportPath = path.join(directory, 'results.json');
    const result = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vitest/vitest.mjs'), 'run',
      'src/lib/rpc-contracts/__tests__/contracts.integration.test.ts', '--reporter=json', `--outputFile=${reportPath}`], {
      cwd: path.join(root, 'frontend'), env, encoding: 'utf8', windowsHide: true, shell: false, timeout: 120_000,
    });
    // Never replay arbitrary test diagnostics that could include credential data.
    if (result.status !== 0 || result.error) throw new Error('RPC_CONTRACT_EXECUTION_FAILED: local integration runner failed');
    assertCompleteRpcReport(JSON.parse(readFileSync(reportPath, 'utf8')));
    process.stdout.write('RPC contracts: 31 passed, 0 failed, 0 skipped; candidate local Supabase verified.\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runLocalRpcContracts().catch(() => {
    process.stderr.write('RPC_CONTRACT_FAILED: local readiness, execution, or exact-count validation failed; credential-bearing diagnostics withheld.\n');
    process.exitCode = 1;
  });
}
