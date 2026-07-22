// PR #1 review: "the public API cannot reliably select a nested
// function" -- analyzePythonCode resolves by "the function containing
// this position", which for a position inside a nested function can
// incorrectly return the OUTER enclosing function instead (tree-sitter's
// descendantsOfType visits parents before children, so .find() hits the
// outer one first). This test reproduces that real behavior and proves
// analyzePythonFunction (exact byte-range match) resolves correctly,
// using test-fixtures/python/nested_functions.py -- two different
// closures both named "inner" at different byte ranges, so neither
// position-containment nor name-based lookup could disambiguate them
// even in principle.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(dirname(testDir)));
const { PyAstParser } = await import(pathToFileURL(join(testDir, '..', 'dist', 'core', 'language-services', 'python', 'PyAstParser.js')));
const {
  initPythonLanguageService,
  analyzePythonCode,
  analyzePythonFunction,
  FunctionRangeNotFoundError,
  resolvePythonWasmPath,
} = await import('../dist/index.js');

const fixturePath = join(repoRoot, 'test-fixtures', 'python', 'nested_functions.py');
const source = readFileSync(fixturePath, 'utf8');

async function findInnerRanges() {
  const parser = await PyAstParser.create(resolvePythonWasmPath());
  const tree = parser.parser.parse(source);
  return tree.rootNode
    .descendantsOfType('function_definition')
    .filter((f) => f.childForFieldName('name')?.text === 'inner')
    .map((f) => ({ startByte: f.startIndex, endByte: f.endIndex }));
}

test('nested_functions.py has exactly two distinct "inner" closures at different byte ranges', async () => {
  const ranges = await findInnerRanges();
  assert.equal(ranges.length, 2);
  assert.notDeepEqual(ranges[0], ranges[1]);
});

test('analyzePythonCode (position-based) resolves a position inside the second inner to its OUTER function -- documents current, real behavior', async () => {
  await initPythonLanguageService();
  const [, second] = await findInnerRanges();
  const ir = await analyzePythonCode(source, second.startByte + 5);
  assert.equal(ir.title, 'Flowchart for function: make_multiplier');
});

test('analyzePythonFunction (exact-range) resolves each inner closure distinctly, matching the requested range', async () => {
  await initPythonLanguageService();
  const [first, second] = await findInnerRanges();

  const firstIr = await analyzePythonFunction(source, first);
  assert.equal(firstIr.title, 'Flowchart for function: inner');
  assert.deepEqual(firstIr.functionRange, { start: first.startByte, end: first.endByte });

  const secondIr = await analyzePythonFunction(source, second);
  assert.equal(secondIr.title, 'Flowchart for function: inner');
  assert.deepEqual(secondIr.functionRange, { start: second.startByte, end: second.endByte });

  assert.notDeepEqual(firstIr.functionRange, secondIr.functionRange);
});

test('analyzePythonFunction rejects a non-matching range with a typed FunctionRangeNotFoundError', async () => {
  await initPythonLanguageService();
  await assert.rejects(
    () => analyzePythonFunction(source, { startByte: 99999, endByte: 999999 }),
    (err) => {
      assert.ok(err instanceof FunctionRangeNotFoundError);
      assert.equal(err.startByte, 99999);
      assert.equal(err.endByte, 999999);
      return true;
    }
  );
});
