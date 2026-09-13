import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const receiptPath='docs/releases/evidence-first-cohort-production-20260913.json';
const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
const cohortBytes=readFileSync('data-quality/cohorts/evidence-first-v1.json');
const cohort=JSON.parse(cohortBytes);
const sha256=value=>createHash('sha256').update(value).digest('hex');

test('production cohort receipt partitions the exact frozen cohort without silent holds',()=>{
  assert.equal(receipt.result,'PASS');
  assert.equal(receipt.retainedCohort.memberCount,60);
  assert.equal(receipt.retainedCohort.sourceFilesVerified,60);
  assert.equal(receipt.retainedCohort.sourceRefetchRequests,0);
  assert.equal(receipt.retainedCohort.cohortSha256,sha256(cohortBytes));
  const frozen=cohort.members.map(member=>member.product_id).sort((a,b)=>a-b);
  const imported=[...receipt.import.importedProductIds].sort((a,b)=>a-b);
  const held=[...receipt.held.productIds].sort((a,b)=>a-b);
  assert.equal(imported.length,55);assert.equal(new Set(imported).size,55);
  assert.deepEqual(held,[628,2882,2903,2950,6029]);
  assert.equal(imported.some(id=>held.includes(id)),false);
  assert.deepEqual([...imported,...held].sort((a,b)=>a-b),frozen);
  assert.equal(receipt.held.sourceRows,0);
  assert.equal(receipt.held.projectionsMatchReviewedPreimages,true);
});

test('receipt binds complete bounded execution and final recovery evidence',()=>{
  assert.equal(receipt.import.pilotProductId,178);
  assert.equal(receipt.import.remainingBatches,11);
  assert.equal(receipt.import.maximumBatchSize,5);
  assert.equal(receipt.import.appliedProducts,55);
  assert.equal(receipt.import.remainingBatchPlanSha256.length,11);
  const plans=[receipt.import.pilotPlanSha256,...receipt.import.remainingBatchPlanSha256];
  assert.equal(new Set(plans).size,12);
  for(const digest of [...plans,receipt.finalState.canonicalAllowlistDigestSha256,
    receipt.finalState.recoveryReceiptSha256,receipt.finalState.recoveryPlanSha256,
    receipt.operatorRelease.codeSha256,receipt.operatorRelease.migrationManifestSha256,
    receipt.retainedCohort.reviewedRemainingManifestSha256])assert.match(digest,/^[a-f0-9]{64}$/u);
  assert.equal(receipt.import.allBatchResults,'PASS');
  assert.equal(receipt.import.allPeerPostimages,'PASS');
  assert.equal(receipt.import.remainingNotAttempted,0);
  assert.equal(receipt.finalState.actualIsolatedRestore,true);
  for(const key of ['ingestionBatchRows','sourceRecords','sourceObservations','selectedAccepted','recordedConsumerModels','retiredNullScores','productsWithObservationProvenance'])assert.equal(receipt.finalState[key],55);
  assert.equal(receipt.finalState.sourceAssertions,502);
  assert.equal(receipt.finalState.sourceProposalReviewStatus,'pending-root-review');
  assert.match(receipt.finalState.executionReviewBoundary,/reviewed before execution/u);
  assert.equal(receipt.finalState.missingExpectedProducts+receipt.finalState.unexpectedProducts+receipt.finalState.duplicateMarketIdentities+receipt.finalState.invalidBatchRows+receipt.finalState.invalidObservationRows,0);
});

test('receipt preserves source time and truthful unresolved boundaries',()=>{
  const applied=[Date.parse(receipt.import.firstAppliedAt),Date.parse(receipt.import.lastAppliedAt)];
  const retrieved=receipt.finalState.sourceRetrievedRange.map(Date.parse);
  const updated=receipt.finalState.sourceUpdatedRange.map(Date.parse);
  assert.ok(applied.every(Number.isFinite)&&retrieved.every(Number.isFinite)&&updated.every(Number.isFinite));
  assert.ok(updated[0]<=updated[1]&&updated[1]<=retrieved[1]&&retrieved[0]<=retrieved[1]&&retrieved[1]<applied[0]&&applied[0]<=applied[1]);
  assert.equal(receipt.boundaries.historicalScoresRecalibrated,false);
  assert.equal(receipt.boundaries.newSourceRequests,0);
  assert.equal(receipt.boundaries.lighthouseMeasurements,0);
  assert.equal(receipt.boundaries.productionTestUsersCreated,0);
  assert.equal(receipt.boundaries.authOrUserTablesInOperatorScope,false);
  assert.equal(receipt.boundaries.sourceFactsArePackageVerification,false);
  assert.equal(receipt.boundaries.turnstileFirstUseReplayResolved,false);
  assert.doesNotMatch(JSON.stringify(receipt),/[A-Z]:\\|backups[\\/]|password|service_role/iu);
});
