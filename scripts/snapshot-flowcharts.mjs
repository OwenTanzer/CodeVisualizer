#!/usr/bin/env node
// MOO-71 Commit 1: snapshot the current (pre-refactor) FlowchartIR output
// for each fixture in test-fixtures/python/, so later commits that
// extract/repackage the core have a concrete baseline to diff against.
//
// Deliberately reaches into PyAstParser directly (not the public
// analyzePythonCode(code, position) wrapper) to select the target
// function by name via listFunctions()/generateFlowchart(code, name)
// instead of by character position -- several fixtures have leading
// comments, so a fixed position (e.g. 0) would not reliably land inside
// the target function.
//
// Compiles via the project's own existing "compile-tests" script (tsc
// -p . --outDir out) rather than inventing a separate ad-hoc build step
// -- that already compiles the whole src tree (vscode types resolve fine
// at compile time via @types/vscode, no real VS Code needed) into the
// already-gitignored out/ directory.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesDir = join(repoRoot, 'test-fixtures', 'python');
const snapshotsDir = join(fixturesDir, '__snapshots__');

console.log('Compiling core (npm run compile-tests)...');
execFileSync('npm', ['run', 'compile-tests'], { cwd: repoRoot, stdio: 'inherit', shell: true });

const { PyAstParser } = require(join(repoRoot, 'out', 'core', 'language-services', 'python', 'PyAstParser.js'));
const wasmPath = join(repoRoot, 'src', 'core', 'language-services', 'python', 'tree-sitter-python.wasm');

mkdirSync(snapshotsDir, { recursive: true });

const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith('.py'));

const parser = await PyAstParser.create(wasmPath);

for (const file of fixtureFiles) {
  const source = readFileSync(join(fixturesDir, file), 'utf8');
  const functionNames = parser.listFunctions(source);
  if (functionNames.length === 0) {
    throw new Error(`Fixture ${file} has no functions for listFunctions() to find.`);
  }
  const targetName = functionNames[0];
  const ir = parser.generateFlowchart(source, targetName);

  const snapshotName = basename(file, '.py') + '.json';
  writeFileSync(join(snapshotsDir, snapshotName), JSON.stringify(ir, null, 2) + '\n');
  console.log(`  ${file} -> __snapshots__/${snapshotName} (function: ${targetName}, ${ir.nodes.length} nodes, ${ir.edges.length} edges)`);
}

console.log(`Done. ${fixtureFiles.length} snapshot(s) written to ${snapshotsDir}`);
