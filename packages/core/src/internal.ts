// @codevisualizer/core/internal -- the ONLY sanctioned entry point for
// consumers that need parser internals. Today that's exclusively this
// same repo's own sibling language parsers (TypeScript/Java/C++/C/Rust/
// Go/PHP, all extending AbstractParser) and the extension's Mermaid
// generators (which need StringProcessor). Nothing here is part of the
// CodeFlow-facing public contract -- import from "@codevisualizer/core"
// (src/index.ts) for that instead.
//
// PR #1 review: without this, the package had no enforced boundary at
// all -- consumers could (and did) import arbitrary paths under
// "@codevisualizer/core/dist/...", making every internal file de facto
// public API. The package.json "exports" map now only recognizes "."
// and "./internal" as valid subpaths; anything else fails to resolve
// at runtime (Node) and in webpack 5's bundler resolution.
export { AbstractParser } from "./core/common/AbstractParser";
export { ProcessResult, LoopContext } from "./core/common/AstParserTypes";
export { StringProcessor } from "./core/utils/StringProcessor";
