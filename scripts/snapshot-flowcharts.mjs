#!/usr/bin/env node
// MOO-71 Commit 1: snapshot the current FlowchartIR output for each
// fixture in test-fixtures/python/, so later commits that
// extract/refactor the core have a concrete baseline to diff against.
//
// Deliberately reaches into PyAstParser directly (not the public
// analyzePythonCode(code, position) wrapper) to select the target
// function by name via listFunctions()/generateFlowchart(code, name)
// instead of by character position -- several fixtures have leading
// comments, so a fixed position (e.g. 0) would not reliably land inside
// the target function.
//
// Updated in Commit 2: PyAstParser now lives in the extracted
// @codevisualizer/core package -- src/ no longer contains PyAstParser.ts
// at all after the extraction.
//
// Updated in Commit 3 PR #1 review ("fresh-checkout builds are not
// reproducible" / "test gap"): this script is internal dev/CI tooling
// reaching into a known local build artifact, not a real package
// consumer exercising the public contract -- it now requires
// packages/core/dist/... via a relative filesystem path rather than the
// package name, since @codevisualizer/core's new "exports" map
// deliberately blocks any subpath other than "." and "./internal" (a
// package-name deep import here would now fail exactly like it would
// for a real external consumer, which is the point of that map). Also
// added `--check`: compares freshly-generated IR against the committed
// snapshots and exits non-zero on any mismatch instead of silently
// overwriting them, so this can run as a real CI gate.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const require = createRequire(import.meta.url);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesDir = join(repoRoot, 'test-fixtures', 'python');
const snapshotsDir = join(fixturesDir, '__snapshots__');
const checkMode = process.argv.includes('--check');

console.log('Building @codevisualizer/core (npm run build --workspace=packages/core)...');
execFileSync('npm', ['run', 'build', '--workspace=packages/core'], { cwd: repoRoot, stdio: 'inherit', shell: true });

const coreDist = join(repoRoot, 'packages', 'core', 'dist');
const { PyAstParser } = require(join(coreDist, 'core', 'language-services', 'python', 'PyAstParser.js'));
const wasmPath = join(coreDist, 'core', 'language-services', 'python', 'tree-sitter-python.wasm');

mkdirSync(snapshotsDir, { recursive: true });

const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith('.py'));

const parser = await PyAstParser.create(wasmPath);

let mismatches = 0;

for (const file of fixtureFiles) {
  const source = readFileSync(join(fixturesDir, file), 'utf8');
  const functionNames = parser.listFunctions(source);
  if (functionNames.length === 0) {
    throw new Error(`Fixture ${file} has no functions for listFunctions() to find.`);
  }
  const targetName = functionNames[0];
  const ir = parser.generateFlowchart(source, targetName);
  const rendered = JSON.stringify(ir, null, 2) + '\n';

  const snapshotName = basename(file, '.py') + '.json';
  const snapshotPath = join(snapshotsDir, snapshotName);

  if (checkMode) {
    // Structural comparison (parsed JSON), not raw string equality --
    // avoids false-positive mismatches from line-ending normalization
    // (git's core.autocrlf rewrites committed LF snapshots to CRLF on
    // checkout on Windows; writeFileSync always writes LF), which is a
    // formatting difference, not a real behavior change. The live `ir`
    // object is round-tripped through JSON too (not compared directly)
    // -- some FlowchartNode fields (e.g. semanticInfo) are explicitly
    // `undefined` rather than absent on the live object, which
    // isDeepStrictEqual treats as different from a genuinely absent key,
    // but which JSON.stringify (how the committed snapshot itself was
    // produced) treats identically by dropping the key entirely.
    const existing = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, 'utf8')) : null;
    const normalizedIr = JSON.parse(rendered);
    if (existing === null || !isDeepStrictEqual(existing, normalizedIr)) {
      mismatches += 1;
      console.error(`  MISMATCH: ${file} -> __snapshots__/${snapshotName} does not match the committed snapshot`);
    } else {
      console.log(`  OK: ${file} matches __snapshots__/${snapshotName}`);
    }
  } else {
    writeFileSync(snapshotPath, rendered);
    console.log(`  ${file} -> __snapshots__/${snapshotName} (function: ${targetName}, ${ir.nodes.length} nodes, ${ir.edges.length} edges)`);
  }
}

if (checkMode) {
  if (mismatches > 0) {
    console.error(`\n${mismatches} of ${fixtureFiles.length} snapshot(s) do not match. Run 'node scripts/snapshot-flowcharts.mjs' (no --check) to regenerate if this is an intentional change, then review the diff.`);
    process.exit(1);
  }
  console.log(`\nAll ${fixtureFiles.length} snapshot(s) match.`);
} else {
  console.log(`Done. ${fixtureFiles.length} snapshot(s) written to ${snapshotsDir}`);
}
