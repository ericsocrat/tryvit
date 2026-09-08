import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function currentPrState(pr, { headSha, baseSha, headRef }) {
  if (![headSha, baseSha].every((sha) => /^[a-f0-9]{40}$/u.test(sha ?? '')) || typeof headRef !== 'string' || !headRef || pr.head?.sha !== headSha || pr.base?.sha !== baseSha || pr.head?.ref !== headRef) throw new Error('current-pr-head-or-base-changed');
  if (!Array.isArray(pr.labels) || pr.labels.some((label) => typeof label.name !== 'string')) throw new Error('invalid-current-pr-labels');
  return { headSha, baseSha, headRef, labels: pr.labels.map((label) => label.name).filter((name) => ['phase5a0d-intentional-redesign-approved', 'phase5a0d-renderer-attestation-approved'].includes(name)).sort() };
}
export function assertUnchangedAuthorization(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('current-pr-authorization-changed');
}
async function main() {
  const { GITHUB_REPOSITORY: repository, GH_TOKEN: token, PR_NUMBER: number, HEAD_SHA: headSha, BASE_SHA: baseSha, HEAD_REF: headRef, RUNNER_TEMP: temporary } = process.env;
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository ?? '') || !/^\d+$/u.test(number ?? '') || !token) throw new Error('invalid-pr-access');
  const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${number}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`current-pr-http-${response.status}`);
  const state = currentPrState(await response.json(), { headSha, baseSha, headRef });
  const file = resolve(temporary, 'trusted-current-pr-state.json');
  if (process.argv[2] === 'capture') {
    writeFileSync(file, JSON.stringify(state), { flag: 'wx' });
    appendFileSync(process.env.GITHUB_ENV, `LABELS_JSON=${JSON.stringify(state.labels)}\n`);
  } else if (process.argv[2] === 'verify') assertUnchangedAuthorization(JSON.parse(readFileSync(file, 'utf8')), state);
  else throw new Error('unknown-pr-state-command');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
