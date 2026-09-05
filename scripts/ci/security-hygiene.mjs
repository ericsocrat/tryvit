import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Never return matching text: even a failed scan must not publish a credential.
export function scanText(file, content) {
  const rules = [
    ['stripe-secret', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/u],
    ['legacy-jwt', /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u],
    ['supabase-secret', /\bsb_secret_[A-Za-z0-9_-]{20,}/u],
  ];
  if (/\.ya?ml$/u.test(file)) rules.push(['hardcoded-database-target', /^(?!\s*#).*supabase\s+link\s+--project-ref\s+["']?[a-z0-9]{20}\b/u]);
  return content.split(/\r?\n/u).flatMap((line, index) => rules
    .filter(([, pattern]) => pattern.test(line))
    .map(([rule]) => ({ file, line: index + 1, rule })));
}

export function scanRepository(root) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
  const deleted = new Set(execFileSync('git', ['ls-files', '--deleted', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'));
  // Local refactors may remove tracked files before staging. Their absent
  // contents cannot enter this working tree; CI rechecks the actual commit.
  return files.filter((file) => !deleted.has(file) && /\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|py|sql|env)$/u.test(file))
    .flatMap((file) => scanText(file, readFileSync(resolve(root, file), 'utf8')));
}

export function diagnostic(finding) {
  // JSON encoding prevents a malicious filename from injecting a workflow command.
  return JSON.stringify({ file: finding.file, line: finding.line, rule: finding.rule, value: '[REDACTED]' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const findings = scanRepository(process.cwd());
    for (const finding of findings) process.stdout.write(`${diagnostic(finding)}\n`);
    process.stdout.write(`Security hygiene: ${findings.length} finding(s).\n`);
    process.exitCode = findings.length ? 1 : 0;
  } catch {
    process.stderr.write('Security hygiene could not inspect all tracked inputs.\n');
    process.exitCode = 1;
  }
}
