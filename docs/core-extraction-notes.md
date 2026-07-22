# Core extraction notes (MOO-71 Commit 1)

Characterization of the current core/extension boundary before any
extraction/refactoring, done by compiling and actually running the
Python pipeline standalone (not by reading code alone) — see the
Verification section below for exactly how each claim was checked.

## `vscode` import trace

Files importing `vscode` today, found via `grep -rl "from 'vscode'" src/`:

- `src/extension.ts` — the extension entry point itself.
- `src/view/BaseFlowchartProvider.ts`, `CodebaseFlowProvider.ts`,
  `FlowchartPanelProvider.ts`, `FlowchartViewProvider.ts` — webview UI,
  out of scope for the core package by design.
- `src/core/llm/CacheManager.ts`, `LLMContext.ts`, `LLMLogger.ts`,
  `LLMManager.ts` — LLM annotation feature. Out of scope per the ticket
  ("Expanded LLM annotation is out of scope"); excluded from the core
  package boundary entirely rather than decoupled.
- `src/core/dependency/CodebaseAnalyzer.ts` — the codebase-level
  dependency-graph feature (a second, separate capability from
  function-level flowcharts). Not needed for MOO-71 (Python function
  control flow only); excluded rather than decoupled.
- `src/core/utils/EnvironmentDetector.ts` — detects VS Code vs. other
  editor environments; only relevant inside the extension.
- `src/core/language-services/index.ts` — **the one real coupling in the
  actual parser pipeline.** It resolves each language's `.wasm` path via
  `vscode.Uri.joinPath(context.extensionUri, "dist", "tree-sitter-<lang>.wasm").fsPath`
  before calling that language's `init*LanguageService(wasmPath)`, and
  calls `vscode.window.showWarningMessage(...)` on partial init failure
  in compatibility mode.
- `src/core/analyzer.ts` — has `import * as vscode from "vscode"` but
  **never references `vscode` anywhere in the file** (confirmed via
  `grep -n "vscode\." src/core/analyzer.ts`, zero matches). This is a
  dead import, trivially removable in a later commit.

## The Python pipeline itself has zero `vscode` coupling

`src/core/language-services/python/{PyAstParser.ts,index.ts}`,
`src/core/common/{AbstractParser.ts,AstParserTypes.ts}`,
`src/core/utils/StringProcessor.ts`,
`src/core/language-services/common/ParserInit.ts`, and `src/ir/ir.ts`
import none of the files listed above and never import `vscode`
directly. `initPythonLanguageService(wasmPath: string)` already takes a
plain filesystem path — the `vscode.Uri.joinPath(...).fsPath` resolution
in `language-services/index.ts` is entirely upstream of this call, not
inside it.

**Verified, not assumed**: this subtree was compiled standalone with
`tsc` (zero errors) and then actually run in plain Node — no VS Code, no
webpack — against the real
`src/core/language-services/python/tree-sitter-python.wasm` and real
Python source covering branches/loops/exceptions/early returns/nested
higher-order-function calls. See `scripts/snapshot-flowcharts.mjs` and
`test-fixtures/python/__snapshots__/*.json` for the reproducible version
of this same check.

## Async/await: parses correctly, no distinct semantic treatment

Spiked directly (see `test-fixtures/python/async_await.py`): `async def`,
`await`, and `async with` all parse without error and produce correct
control flow — tree-sitter-python represents `async def` as an ordinary
`function_definition` node, so `listFunctions`/`findFunctionAtPosition`/
`generateFlowchart` all find it the same way as a synchronous function.

However, `PyAstParser` gives async/await **no distinct node type**.
`ir.ts`'s `NodeType` enum already defines `ASYNC_OPERATION` and `AWAIT`
values, and `AbstractParser.inferNodeTypeFromSyntax` has a fallback rule
that maps a statement whose tree-sitter type string contains "async" or
"await" to `ASYNC_OPERATION` — but `await expr` in Python is an
*expression* inside a larger statement (e.g. an `assignment` or
`expression_statement`), not a statement whose own type string is
literally "await", so that fallback never fires for Python. In practice
an `await resp.json()` assignment shows up as a plain `assignment` node
and a bare `await process(item)` shows up as a plain `process` node —
indistinguishable from non-async code. This is current, real behavior;
not a bug this commit fixes.

## FlowchartIR shape (`src/ir/ir.ts`)

```
FlowchartIR = {
  nodes: FlowchartNode[]
  edges: FlowchartEdge[]        // { from, to, label? }
  entryNodeId?: string
  exitNodeId?: string
  locationMap: LocationMapEntry[]   // { start, end, nodeId }
  functionRange?: { start, end }
  title?: string
}
```

`FlowchartNode.location` is a **byte-offset** `{start, end}` pair (tree-
sitter's `startIndex`/`endIndex`), not line/column — will need
conversion when a later commit maps this into GraphIR's
`SourceRange` (line/column-based). `FlowchartNode.style` is a literal
Mermaid CSS fill/stroke string — presentation, not semantic (matches
this project's existing "don't rely on presentation labels as source
metadata" precedent from the sibling MOO-70 file-layer work); `nodeType`/
`nodeCategory` are the semantic signal to carry forward instead.

## Current WASM loading and packaging

- **Loading**: `initLanguageServices(context: vscode.ExtensionContext)`
  in `language-services/index.ts` is called once at extension activation.
  For each language it resolves
  `vscode.Uri.joinPath(context.extensionUri, "dist", "tree-sitter-<lang>.wasm").fsPath`
  and passes that plain path to the language's own
  `init<Lang>LanguageService(wasmPath)`. Each language's `index.ts` (e.g.
  `python/index.ts`) then calls `<Lang>AstParser.create(wasmPath)`, which
  calls `ensureParserInit()` (a one-time global `Parser.init()`) followed
  by `Parser.Language.load(wasmPath)`. Nothing below
  `initLanguageServices` itself is VS Code-specific.
- **Packaging**: `webpack.config.js` + `copy-webpack-plugin` bundle the
  whole extension into `dist/extension.js` and copy every language's
  `.wasm` file next to it (`dist/tree-sitter-<lang>.wasm`). There is no
  separate build target, entry point, or package for just the core today
  — `package.json`'s only relevant scripts are `compile` (full webpack
  bundle) and `compile-tests` (`tsc -p . --outDir out`, used by this
  commit's snapshot script since it already compiles the whole `src`
  tree, core included, without requiring a real VS Code environment).

## Dependency-version note for later commits (not this one)

This repo pins `web-tree-sitter@^0.22.2` + `@vscode/tree-sitter-wasm@^0.1.4`.
CodeFlow's own MOO-70 work (the sibling file-layer ticket, already
merged) separately pins `web-tree-sitter@0.20.8` + `tree-sitter-wasms@0.1.13`
for an unrelated Python symbol index. These are two independent
tree-sitter runtimes for two different consumers — not required to be
API-compatible with each other, since npm resolves separate copies once
this core is consumed as its own package (Commit 4). Flagged here so it
isn't rediscovered as a surprise later.

## Baseline check results

- `npm run compile` (webpack production build): **PASS**, unmodified —
  this commit only adds new files (`test-fixtures/`, `docs/`,
  `scripts/snapshot-flowcharts.mjs`), no existing source changed.
- `npm run lint` (eslint): **PASS**, unmodified for the same reason.
- `npm test` (`vscode-test`): **ran successfully** (downloaded and
  launched a real VS Code 1.129.1 instance headlessly, exit code 0) but
  reported **"0 passing"**. This is not an environment limitation —
  `.vscode-test.mjs` looks for `out/test/**/*.test.js`, and there are
  genuinely no `*.test.ts` files anywhere in `src/` today despite
  `@vscode/test-cli`/`@types/mocha` being wired up as devDependencies.
  The extension currently has no automated test suite at all; this
  commit's "existing tests still pass" check is trivially true (0 of 0)
  but should not be read as meaningful regression coverage.

## Commit 3 findings: WASM loading and initialization

Fixed for Python (the only language extracted into the package):
`initPythonLanguageService` is now `async` and rethrows real
initialization failures instead of returning `undefined` synchronously,
a missing grammar file now throws a typed `GrammarAssetNotFoundError`
(`language`/`wasmPath` fields) instead of a bare `ENOENT`, and
`resolvePythonWasmPath()` gives Node consumers (e.g. `codeflow-tool`) a
working default grammar path without needing to know the package's
internal `dist/` layout.

Two things found but **not fixed**, recorded so they aren't silently
lost:

- **Three sibling languages have the exact same async/await bug Python
  had**: `initTypeScriptLanguageService`, `initJavaLanguageService`, and
  `initPhpLanguageService` are not `async` and never return/await their
  own `<Lang>AstParser.create(...)` promise — the same
  "extension's per-language try/catch never actually catches this"
  problem this commit fixed for Python. `initCppLanguageService`/
  `initCLanguageService`/`initRustLanguageService`/
  `initGoLanguageService` are already correctly written (see
  `src/core/language-services/cpp/index.ts` — the pattern Python's fix
  mirrors). Not fixed here: those 3 languages aren't part of the
  extracted package and MOO-71's v1 acceptance is Python-first: fixing
  them is a legitimate, separate CodeVisualizer bug-fix, not part of this
  ticket's scope.
- **No browser/fetch-based WASM loading exists anywhere in this
  codebase** — parsing happens in the extension host (Node), not the
  webview. The ticket's "keep browser loading available only if useful"
  bullet has nothing to preserve or build here.
