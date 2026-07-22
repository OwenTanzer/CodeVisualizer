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
// @codevisualizer/core package, imported via its workspace symlink (the
// same deep-import path the 7 in-tree language parsers use for
// AbstractParser) rather than compiling src/ directly -- src/ no longer
// contains PyAstParser.ts at all after the extraction.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesDir = join(repoRoot, 'test-fixtures', 'python');
const snapshotsDir = join(fixturesDir, '__snapshots__');

console.log('Building @codevisualizer/core (npm run build --workspace=packages/core)...');
execFileSync('npm', ['run', 'build', '--workspace=packages/core'], { cwd: repoRoot, stdio: 'inherit', shell: true });

const { PyAstParser } = require('@codevisualizer/core/dist/core/language-services/python/PyAstParser');
const wasmPath = require.resolve('@codevisualizer/core/dist/core/language-services/python/tree-sitter-python.wasm');

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
