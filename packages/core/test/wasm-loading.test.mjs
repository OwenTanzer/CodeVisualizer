// MOO-71 Commit 3: covers only what this commit introduces (default
// grammar path resolution, the typed missing-asset error, and the
// initPythonLanguageService async/await fix). Uses Node's built-in
// node:test -- no new dependency, matching codeflow-tool's own
// convention exactly. Run via `node --test packages/core/test/*.test.mjs`
// after `npm run build --workspace=packages/core`.
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  initPythonLanguageService,
  analyzePythonCode,
  resolvePythonWasmPath,
  GrammarAssetNotFoundError,
} = await import('../dist/index.js');

test('initPythonLanguageService() with no argument resolves the bundled default and parses real Python source', async () => {
  await initPythonLanguageService();
  const ir = await analyzePythonCode('def add(a, b):\n    return a + b\n', 0);
  assert.equal(ir.nodes.length, 3);
  assert.equal(ir.title, 'Flowchart for function: add');
});

test('resolvePythonWasmPath() points at a real, existing file', async () => {
  const { existsSync } = await import('node:fs');
  assert.ok(existsSync(resolvePythonWasmPath()));
});

test('initPythonLanguageService(missingPath) rejects with a typed GrammarAssetNotFoundError', async () => {
  await assert.rejects(
    () => initPythonLanguageService('/definitely/missing/tree-sitter-python.wasm'),
    (err) => {
      assert.ok(err instanceof GrammarAssetNotFoundError);
      assert.equal(err.language, 'Python');
      assert.equal(err.wasmPath, '/definitely/missing/tree-sitter-python.wasm');
      assert.match(err.message, /grammar asset not found/);
      return true;
    }
  );
});

test('initPythonLanguageService(realPath) returns a promise that resolves (async/await fix)', async () => {
  const result = initPythonLanguageService(resolvePythonWasmPath());
  assert.ok(result instanceof Promise);
  await result;
});
