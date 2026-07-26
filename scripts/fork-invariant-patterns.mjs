// Shared regex patterns for the fork invariant guard (check-fork-invariants.mjs)
// and its tests (check-fork-invariants.test.mjs). Kept in their own module,
// rather than guarded behind an import.meta.url/process.argv[1] entry-point
// check in the CLI script, so the CLI stays unconditionally executable and
// the patterns stay importable without relying on a comparison that
// `file://` URL encoding and platform path separators make unreliable across
// OSes.

// `vscode` is only ever available inside the extension host. An import of it
// anywhere in the core makes the package unusable from Node, which is
// CodeFlow's entire consumption model.
//
// Covers static imports with a binding (`import x from "vscode"`), bare
// side-effect imports (`import "vscode"`), dynamic imports
// (`import("vscode")`, including with whitespace before the parenthesis),
// and both plain and TS-import-assignment `require` forms
// (`require("vscode")` / `import x = require("vscode")` -- the latter
// matches via the require() alternative since it contains that exact
// substring).
//
// Not covered: keyword/callee split from `(` by a comment (e.g.
// `import/* */("vscode")`). Catching that reliably needs parsing the module
// specifier rather than another regex arm.
export const VSCODE_IMPORT =
  /(?:^|\n)\s*import\s+(?:[^;'"]*?from\s*)?['"]vscode['"]|import\s*\(\s*['"]vscode['"]\s*\)|require\s*\(\s*['"]vscode['"]\s*\)/;

// The LLM subtree was deliberately excluded from the package boundary rather
// than decoupled (MOO-71 Commit 2). Anything reaching back into it would drag
// network calls and credentials into the deterministic analysis path.
//
// Matches a quoted import specifier whose path has "llm" as a whole segment
// -- either in the middle (`../llm/x`), or as the specifier's final segment
// with nothing after it (`../llm`) -- not merely as a substring of a longer
// segment like "llmHelper".
export const LLM_REFERENCE = /['"](?:[^'"]*\/)?llm(?:\/[^'"]*)?['"]|\bLLMService\b|\bLLMManager\b/;
