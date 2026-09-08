import assert from 'node:assert/strict';
import test from 'node:test';
import { currentPrState, assertUnchangedAuthorization } from './current-pr-state.mjs';
const expected = { headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40), headRef: 'topic' };
const pr = { head: { sha: expected.headSha, ref: 'topic' }, base: { sha: expected.baseSha }, labels: [{ name: 'phase5a0d-intentional-redesign-approved' }] };
test('current head, base, and live labels are required', () => {
  assert.deepEqual(currentPrState(pr, expected).labels, ['phase5a0d-intentional-redesign-approved']);
  for (const changed of [{ ...pr, head: { ...pr.head, sha: 'c'.repeat(40) } }, { ...pr, base: { sha: 'c'.repeat(40) } }, { ...pr, labels: undefined }]) assert.throws(() => currentPrState(changed, expected));
});
test('authorization revoked after capture fails before completion', () => {
  assert.throws(() => assertUnchangedAuthorization(currentPrState(pr, expected), currentPrState({ ...pr, labels: [] }, expected)), /authorization-changed/u);
  assertUnchangedAuthorization(currentPrState(pr, expected), currentPrState(pr, expected));
});
test('unrelated labels do not change authorization but their shape is still validated', () => {
  assertUnchangedAuthorization(currentPrState(pr, expected), currentPrState({ ...pr, labels: [...pr.labels, { name: 'size/L' }] }, expected));
  assert.throws(() => currentPrState({ ...pr, labels: [...pr.labels, { name: 42 }] }, expected), /labels/u);
});
