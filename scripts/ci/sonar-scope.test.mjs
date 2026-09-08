import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const text = readFileSync(path.join(root, 'sonar-project.properties'), 'utf8').replace(/\\\r?\n\s*/gu, '');
const properties = Object.fromEntries(text.split(/\r?\n/u).filter((line) => line && !line.startsWith('#')).map((line) => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const list = (key) => properties[key].split(',');

test('Python test fixtures are explicitly classified as tests, not product source', () => {
  assert.ok(list('sonar.tests').includes('pipeline'));
  assert.ok(list('sonar.tests').includes('test_data_quality_report.py'));
  assert.ok(list('sonar.test.inclusions').includes('pipeline/**/test_*.py'));
  assert.ok(list('sonar.test.inclusions').includes('test_data_quality_report.py'));
  assert.ok(list('sonar.exclusions').includes('pipeline/**/test_*.py'));
});

test('application pipeline remains scanned and quality/security enforcement is unchanged', () => {
  assert.ok(list('sonar.sources').includes('pipeline'));
  assert.ok(!list('sonar.exclusions').includes('pipeline/**'));
  assert.ok(!list('sonar.exclusions').includes('pipeline/**/*.py'));
  assert.equal(properties['sonar.qualitygate.wait'], 'true');
  assert.ok(!text.includes('python:S5332'));
});
