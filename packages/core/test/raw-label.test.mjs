import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '..', '..', '..');
const { PyAstParser } = await import(pathToFileURL(join(testDir, '..', 'dist', 'core', 'language-services', 'python', 'PyAstParser.js')));
const { initPythonLanguageService, analyzePythonCode, analyzePythonFunction, resolvePythonWasmPath } = await import('../dist/index.js');
await initPythonLanguageService();
const parser = await PyAstParser.create(resolvePythonWasmPath());

// Independent source oracles from Codeflow's full-label-cases.mjs at 7f6f26a.
// Expected text is composed from source fragments, never from IR labels.
const id = 'unbroken_identifier_'.repeat(18);
const arg = '"escaped \\"quote\\" < > ... _.-(),:"';
const call = 'call_' + id + '(' + arg + ')';
const cases = [
  { name: 'for', prefix: 'for_header_', source: 'def sample():\n    for item in ' + id + ':\n        pass\n', expected: 'for item in ' + id },
  { name: 'with', prefix: 'with_', source: 'def sample():\n    with ' + call + ' as resource:\n        pass\n', expected: call + ' as resource' },
  { name: 'return', prefix: 'return_', source: 'def sample():\n    return ' + call + '\n', expected: 'return ' + call },
  { name: 'ternary true', prefix: 'ternary_true_', source: 'def sample():\n    target = ' + call + ' if check else alternative\n', expected: 'target = ' + call },
  { name: 'ternary false', prefix: 'ternary_false_', source: 'def sample():\n    target = first if check else ' + call + '\n', expected: 'target = ' + call },
  { name: 'higher order assignment', prefix: 'assign_hof_', source: 'def sample():\n    result = map(transform_' + id + ', items)\n', expected: 'result = map(transform_' + id + ', items)' },
];

function functionRange(source) {
  const node = parser.parser.parse(source).rootNode.descendantsOfType('function_definition')[0];
  return { startByte: node.startIndex, endByte: node.endIndex };
}

function findNode(ir, prefix) {
  const matches = ir.nodes.filter(node => node.id.startsWith(prefix));
  assert.equal(matches.length, 1, `expected one ${prefix} node`);
  return matches[0];
}

for (const entry of cases) {
  test(`${entry.name} preserves parser-composed text through both service entrypoints`, async () => {
    const byRange = await analyzePythonFunction(entry.source, functionRange(entry.source));
    const byPosition = await analyzePythonCode(entry.source, entry.source.indexOf('sample'));
    for (const ir of [byRange, byPosition]) {
      assert.deepEqual(findNode(ir, entry.prefix).rawLabel, {
        version: 1,
        provenance: 'python-parser-composition',
        text: entry.expected,
      });
    }
  });
}

test('higher order assignment special position path also preserves full assignment', async () => {
  const entry = cases.at(-1);
  const ir = await analyzePythonCode(entry.source, entry.source.indexOf('map('));
  assert.deepEqual(findNode(ir, entry.prefix).rawLabel, {
    version: 1,
    provenance: 'python-parser-composition',
    text: entry.expected,
  });
});

test('both higher order assignment sites retain multiline right-hand text', async () => {
  const source = 'def sample():\n    result = map(\n        transform,\n        items\n    )\n';
  const expected = 'result = map(\n        transform,\n        items\n    )';
  const byRange = await analyzePythonFunction(source, functionRange(source));
  const byPosition = await analyzePythonCode(source, source.indexOf('map('));
  for (const ir of [byRange, byPosition]) {
    assert.equal(findNode(ir, 'assign_hof_').rawLabel.text, expected);
  }
});

test('return of a higher order call retains the original return expression', async () => {
  const source = 'def sample():\n    return map(transform, items)\n';
  const ir = await analyzePythonFunction(source, functionRange(source));
  assert.equal(findNode(ir, 'return_hof_').rawLabel.text, 'return map(transform, items)');
});

test('short, escaped, entity-like, Unicode and multiline text survives without decoding or normalization', async () => {
  const samples = [
    ['def sample():\n    return 1\n', 'return 1'],
    ['def sample():\n    return "<>&#60; ... café 🐍"\n', 'return "<>&#60; ... café 🐍"'],
    ['def sample():\n    return (\n        "first\\nline",\n        "second: ...",\n    )\n', 'return (\n        "first\\nline",\n        "second: ...",\n    )'],
  ];
  for (const [source, expected] of samples) {
    const ir = await analyzePythonFunction(source, functionRange(source));
    assert.equal(findNode(ir, 'return_').rawLabel.text, expected);
  }
});

// Hashes of the seven parsed snapshots at integration head 257f0fb, before
// rawLabel existed. This pins every legacy node, edge, location and range field.
const legacySnapshotHashes = {
  'async_await.json': 'a463ab6498f4d2fecbdc6c0fd94e224ca57ee5e849acf851772b6e1c3d04741b',
  'branches.json': 'beafa590ba814c325b8b11bc945c0d55aee73e3e5eb9f3c4b2d5f866ad3fa29a',
  'early_returns.json': '55c7ba9368e72d6f6236976727e3f64ed4be676d7a2af00d6ed56a3337057241',
  'exceptions.json': 'd4dde3d64cba3dc2631fc4524cbce60e7723e92723c1e7721825e60d1cede356',
  'loops.json': '10b9caba300aa91146132924d5a58ff10e9cfe125a12bd273824313122fb64c1',
  'nested_calls.json': '6fbe616855056a91dab7f745122e05de95769ae5259ec0370ef09a8cd0c67fd1',
  'nested_functions.json': '5f34f9bad008c3559c41a9047fd85e9e7355b707f25f66fefaca21bd693b09be',
};

test('additive Python snapshots retain every legacy field', () => {
  const dir = join(repoRoot, 'test-fixtures', 'python');
  for (const file of readdirSync(dir).filter(name => name.endsWith('.py'))) {
    const source = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const name = parser.listFunctions(source)[0];
    const actual = JSON.parse(JSON.stringify(parser.generateFlowchart(source, name)));
    const expected = JSON.parse(readFileSync(join(dir, '__snapshots__', file.replace(/\.py$/, '.json')), 'utf8'));
    assert.deepEqual(actual, expected, file);
    for (const node of actual.nodes) delete node.rawLabel;
    const digest = createHash('sha256').update(JSON.stringify(actual)).digest('hex');
    assert.equal(digest, legacySnapshotHashes[file.replace(/\.py$/, '.json')], file);
  }
});
