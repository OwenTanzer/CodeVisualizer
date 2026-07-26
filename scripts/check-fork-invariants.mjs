#!/usr/bin/env node
// Fork invariant guard — MOO-71 Commit 9.
//
// Two properties this fork must not lose, both of which are exactly the kind
// of thing an upstream merge silently undoes. Checked here rather than in a
// test file because they span the extension source and the core package, and
// because this repo already uses `scripts/*.mjs --check` as its CI guard
// pattern (see scripts/snapshot-flowcharts.mjs).
//
// 1. THE CORE PACKAGE BOUNDARY. `@codevisualizer/core` must import neither
//    `vscode` nor any LLM module. MOO-71 Commit 2 established this by hand and
//    nothing has enforced it since. It is what lets CodeFlow consume the core
//    from a plain Node server, and it is why deterministic graph generation
//    needs no API key -- a property worth locking in before it silently stops
//    being true.
//
// 2. THE ANTHROPIC PROVIDER FIX. Commit 353a00b added the missing Anthropic
//    provider: the settings schema and README advertised it, but LLMService's
//    dispatch had no case for it, so selecting it silently produced undefined
//    instead of calling any API. MOO-71 must preserve that fix without
//    expanding annotation behavior, so this asserts the wiring is PRESENT --
//    it deliberately does not exercise, mock, or extend it.
//
// Usage: node scripts/check-fork-invariants.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VSCODE_IMPORT, LLM_REFERENCE } from './fork-invariant-patterns.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push(`ok   - ${name}`);
  } catch (err) {
    failures.push(name);
    checks.push(`FAIL - ${name}: ${err.message}`);
  }
}

function walk(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function read(relPath) {
  const full = join(repoRoot, relPath);
  if (!existsSync(full)) throw new Error(`expected file is missing: ${relPath}`);
  return readFileSync(full, 'utf8');
}

// --- 1. core package boundary ----------------------------------------------
// (VSCODE_IMPORT / LLM_REFERENCE now live in fork-invariant-patterns.mjs so
// they're importable by the test file without an entry-point guard.)

for (const [label, dir, exts] of [
  ['source', join(repoRoot, 'packages/core/src'), ['.ts']],
  ['built output', join(repoRoot, 'packages/core/dist'), ['.js']],
]) {
  check(`@codevisualizer/core ${label} imports no vscode`, () => {
    const files = walk(dir, (f) => exts.some((e) => f.endsWith(e)));
    if (files.length === 0) {
      // Built output only exists after `npm run build:core`; skipping silently
      // would let this guard pass vacuously in CI.
      throw new Error(
        `no ${exts.join('/')} files found under ${relative(repoRoot, dir)} -- build the core first`,
      );
    }
    const offenders = files.filter((f) => VSCODE_IMPORT.test(readFileSync(f, 'utf8')));
    if (offenders.length > 0) {
      throw new Error(`imports vscode: ${offenders.map((f) => relative(repoRoot, f)).join(', ')}`);
    }
  });

  check(`@codevisualizer/core ${label} references no LLM module`, () => {
    const files = walk(dir, (f) => exts.some((e) => f.endsWith(e)));
    const offenders = files.filter((f) => LLM_REFERENCE.test(readFileSync(f, 'utf8')));
    if (offenders.length > 0) {
      throw new Error(
        `references an LLM module: ${offenders.map((f) => relative(repoRoot, f)).join(', ')}`,
      );
    }
  });
}

// --- 2. Anthropic provider fix ---------------------------------------------

check('LLMService declares anthropic as a Provider', () => {
  const src = read('src/core/llm/LLMService.ts');
  if (!/export type Provider\s*=[^;]*"anthropic"/.test(src)) {
    throw new Error('the Provider union no longer includes "anthropic"');
  }
});

check('LLMService dispatches anthropic to callAnthropic', () => {
  const src = read('src/core/llm/LLMService.ts');
  if (!/case\s+"anthropic":[\s\S]{0,200}?callAnthropic\s*\(/.test(src)) {
    throw new Error(
      'the provider dispatch switch no longer routes "anthropic" to callAnthropic() -- this is the exact bug 353a00b fixed, where selecting Anthropic silently produced undefined',
    );
  }
});

check('callAnthropic still calls the Anthropic Messages API', () => {
  const src = read('src/core/llm/LLMService.ts');
  if (!/async function callAnthropic\s*\(/.test(src)) throw new Error('callAnthropic() is gone');
  if (!/https:\/\/api\.anthropic\.com\/v1\/messages/.test(src))
    throw new Error('the Messages API endpoint is gone');
  if (!/["']anthropic-version["']/.test(src))
    throw new Error('the required anthropic-version header is gone');
});

check('LLMManager still offers Anthropic in the onboarding picker', () => {
  const src = read('src/core/llm/LLMManager.ts');
  if (!/value:\s*["']anthropic["']/.test(src)) {
    throw new Error('the onboarding provider picker no longer offers Anthropic');
  }
});

// --- report -----------------------------------------------------------------

for (const line of checks) console.log(line);

if (failures.length > 0) {
  console.error(`\n${failures.length} fork invariant(s) broken: ${failures.join(', ')}`);
  console.error('See docs/upstream-compatibility.md for why each of these exists.');
  process.exit(1);
}
console.log(`\nAll ${checks.length} fork invariants hold.`);
