// Negative fixtures for VSCODE_IMPORT and LLM_REFERENCE (PR #3 review). Each
// case is a syntax form the regexes must catch, plus one shape that must NOT
// trip them, so the guard proves it can both fail and pass.
// Run via `node --test scripts/*.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';

import { VSCODE_IMPORT, LLM_REFERENCE } from './check-fork-invariants.mjs';

const vscodeOffenders = [
  ['static import with binding', `import * as vscode from "vscode";`],
  ['static named import', `import { window } from 'vscode';`],
  ['bare side-effect import', `import "vscode";`],
  ['dynamic import', `const vscode = await import("vscode");`],
  ['CommonJS require', `const vscode = require("vscode");`],
  ['TS import-assignment require', `import vscode = require("vscode");`],
];

for (const [name, src] of vscodeOffenders) {
  test(`VSCODE_IMPORT catches: ${name}`, () => {
    assert.match(src, VSCODE_IMPORT);
  });
}

test('VSCODE_IMPORT does not flag an unrelated import', () => {
  assert.doesNotMatch(`import { readFileSync } from 'node:fs';`, VSCODE_IMPORT);
});

const llmOffenders = [
  ['relative import of the llm directory itself', `import { LLMService } from '../llm';`],
  ['relative import into the llm directory', `import { callAnthropic } from '../llm/LLMService';`],
  ['bare specifier named exactly llm', `import x from 'llm';`],
  ['LLMService identifier reference', `const svc: LLMService = getService();`],
  ['LLMManager identifier reference', `new LLMManager().pickProvider();`],
];

for (const [name, src] of llmOffenders) {
  test(`LLM_REFERENCE catches: ${name}`, () => {
    assert.match(src, LLM_REFERENCE);
  });
}

test('LLM_REFERENCE does not flag a path that merely contains "llm" as a substring', () => {
  assert.doesNotMatch(`import { helper } from './llmHelper';`, LLM_REFERENCE);
});
