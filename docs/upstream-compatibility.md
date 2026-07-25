# Upstream compatibility

MOO-71 Commit 9. How this fork differs from upstream
`DucPhamNgoc08/CodeVisualizer`, and how to take upstream changes without
silently undoing any of it.

This fork exists to serve two consumers at once: the VS Code extension (which
must keep working exactly as upstream intends) and CodeFlow, which consumes
`@codevisualizer/core` as a plain Node package. Every divergence below exists
for the second consumer without being allowed to harm the first.

## Branch layout

- `main` — tracks upstream. Do not commit fork work here.
- `fix/anthropic-llm-provider` — the integration branch carrying **all** fork
  work. CodeFlow's `codevisualizer-core.lock.json` pins a commit on this
  branch.

**A squash-merge of this branch would break CodeFlow.** The pinned SHA must stay
reachable, so if this branch is ever merged to `main`, use a merge commit. A
squash rewrites history, the pinned commit becomes unreachable, and CodeFlow's
vendoring bootstrap fails on every clean install.

## What this fork changes

### 1. The Anthropic LLM provider (pre-MOO-71)

`353a00b`, plus `0295c47` (fall back to the `codevisualizer.llm.apiKey` setting
when SecretStorage is empty).

Upstream's settings schema and README advertise Anthropic as a supported
provider, but `LLMService`'s provider dispatch had no `case` for it — selecting
it silently produced `undefined` instead of calling any API. The fix adds
`callAnthropic()` against the Messages API and wires it into the dispatch
switch, the default-model list, and `LLMManager`'s onboarding picker.

Touches `src/core/llm/LLMService.ts` and `src/core/llm/LLMManager.ts`.

### 2. The `@codevisualizer/core` package extraction (MOO-71 Commits 1–3)

The Python parser-to-`FlowchartIR` pipeline moved out of the extension into an
npm workspace at `packages/core`, published to CodeFlow as
`@codevisualizer/core`. Files **moved out of `src/`**:

- `src/ir/ir.ts`
- `src/core/common/{AbstractParser,AstParserTypes}.ts`
- `src/core/utils/StringProcessor.ts`
- `src/core/language-services/common/ParserInit.ts`
- `src/core/language-services/python/{PyAstParser.ts,index.ts}` + the grammar
  `.wasm`

Everything still in `src/` that used them now imports from
`@codevisualizer/core` (public API) or `@codevisualizer/core/internal`
(`AbstractParser`, `AstParserTypes`, `StringProcessor` — the deep-import
surface the other seven language parsers need).

Also in this extraction: `initPythonLanguageService` became `async` and
rethrows (it previously swallowed init failures into an unhandled rejection,
bypassing the extension's own per-language degradation logic);
`resolvePythonWasmPath()` resolves the grammar relative to the compiled package
so it works from any install location; and missing grammars throw a typed
`GrammarAssetNotFoundError`.

**Mermaid generation stayed in the extension.** `MermaidGenerator`,
`EnhancedMermaidGenerator` and `ThemeManager` were deliberately *not*
extracted — they just import their types from the package now. FlowchartIR is
the boundary CodeFlow consumes; that is a statement about the core's scope, not
a deprecation of Mermaid.

### 3. CI and guards (MOO-71 Commits 1, 3, 9)

This repo had no CI before the fork. It now builds the core, checks committed
`FlowchartIR` snapshots, runs core tests, compiles, lints, runs the extension
tests, and packages a real `.vsix`.

## Merging upstream

```bash
git checkout main && git pull upstream main
git checkout fix/anthropic-llm-provider
git merge main
```

Then, before pushing:

```bash
npm ci
npm run build:core
node scripts/check-fork-invariants.mjs      # fork-specific properties
node scripts/snapshot-flowcharts.mjs --check # parsing behavior unchanged
npm run compile && npm run lint
npx @vscode/vsce package                     # packaging still valid
```

`scripts/snapshot-flowcharts.mjs --check` is the real regression gate: it
compares freshly generated `FlowchartIR` for every fixture in
`test-fixtures/python/` against the committed snapshots, structurally (not by
string equality, which false-positives on Windows CRLF normalization). If an
upstream change alters Python parsing output, this is what tells you — and
whether the change is desirable is then a judgement call, not a surprise.

## High-risk merge points

Ranked by how likely an upstream change is to quietly undo fork work:

| File | Risk |
|---|---|
| `src/core/llm/LLMService.ts` | **Highest.** Heavily modified by both sides. An upstream refactor of the provider dispatch switch is the most plausible way to silently delete the Anthropic case and restore the original bug. `check-fork-invariants.mjs` exists specifically to catch this. |
| `src/core/language-services/index.ts` | Registers every language service and resolves grammar paths. Upstream adding a language (as it did with PHP, `5d36041`) touches this. |
| `src/core/language-services/python/*` | **Moved to `packages/core`.** An upstream change to the Python parser will land as a new file at the old path rather than a conflict — it must be applied to the package copy, or it is silently lost. Same for `src/ir/ir.ts` and `src/core/utils/StringProcessor.ts`. |
| `package.json` | Workspaces, the `exports` map and `typesVersions` are all fork additions. |
| `.vscodeignore` | Fork-tuned to exclude dev artifacts while keeping `packages/core/dist` (which holds the runtime `.wasm`). |

The moved-file case is the one that does not announce itself: git reports no
conflict, the build still passes, and the extension keeps working — only the
extracted package silently misses the upstream fix. After any upstream merge
that touches Python parsing, diff the old paths against `packages/core/src`.

## The invariants, and why

`scripts/check-fork-invariants.mjs` enforces two properties:

1. **`@codevisualizer/core` imports neither `vscode` nor any LLM module.**
   `vscode` only exists inside the extension host, so importing it makes the
   package unusable from Node — CodeFlow's entire consumption model. The LLM
   exclusion is why deterministic graph generation needs no API key, which CI
   also asserts by running the core tests with the provider keys explicitly
   cleared.
2. **The Anthropic provider fix is still wired.** Asserts presence only — the
   Provider union, the dispatch case reaching `callAnthropic`, the Messages API
   endpoint and version header, and the onboarding picker entry. It deliberately
   does not exercise or extend annotation behavior; expanded LLM annotation is
   explicitly out of MOO-71's scope.

Both are checked against source *and* built output, and each failure mode has
been verified to actually fail — a guard that cannot fail is worse than none,
because it reads like coverage.
