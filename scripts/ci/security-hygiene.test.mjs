import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnostic, scanText } from './security-hygiene.mjs';

test('reports location and rule without the matched credential or surrounding text', () => {
  const secret = ['sk', 'live', 'a'.repeat(24)].join('_');
  const findings = scanText('config.ts', `safe\nprivate context: ${secret}`);
  assert.deepEqual(findings, [{ file: 'config.ts', line: 2, rule: 'stripe-secret' }]);
  const output = diagnostic(findings[0]);
  assert.ok(!output.includes(secret));
  assert.ok(!output.includes('private context'));
  assert.ok(output.includes('[REDACTED]'));
});

test('placeholder identifiers and regular auth error codes are not credentials', () => {
  assert.deepEqual(scanText('auth.ts', 'invalid_credentials weak_password sk_test_placeholder'), []);
});

test('newlines in paths cannot inject workflow annotations', () => {
  const output = diagnostic({ file: 'a\n::error::injected', line: 1, rule: 'test' });
  assert.equal(output.split('\n').length, 1);
});

test('database target check keeps diagnostics redacted and accepts secret references', () => {
  assert.equal(scanText('deploy.yml', `run: supabase link --project-ref ${'a'.repeat(20)}`)[0].rule, 'hardcoded-database-target');
  assert.deepEqual(scanText('deploy.yml', 'run: supabase link --project-ref "$SUPABASE_PROJECT_REF"'), []);
});
