// MOO-71 Commit 3: a missing grammar .wasm file previously surfaced as a
// bare `ENOENT` from deep inside web-tree-sitter, with no indication of
// which language failed or that this was a parser-initialization
// problem. This gives that failure a name and the context to act on it.
export class GrammarAssetNotFoundError extends Error {
  public readonly language: string;
  public readonly wasmPath: string;

  constructor(language: string, wasmPath: string) {
    super(
      `${language} grammar asset not found at ${wasmPath}. ` +
        `Did the package build copy tree-sitter-${language.toLowerCase()}.wasm into dist/?`
    );
    this.name = "GrammarAssetNotFoundError";
    this.language = language;
    this.wasmPath = wasmPath;
  }
}

// PR #1 review: the public API had no way to resolve an EXACT function
// by canonical coordinate (only "the function containing this position",
// which can return an outer function instead of a nested one). This is
// thrown by PyAstParser.generateFlowchartForRange when no
// function_definition has exactly the requested range -- a deliberate
// hard failure (a caller with a genuine canonical coordinate should
// always get an exact match), not a silent fallback to a nearby
// function.
//
// Correction (found downstream in codeflow-tool's MOO-71 Commit 5, which
// actually consumes this API): startByte/endByte are NOT UTF-8 byte
// offsets, despite the "byte" naming and this comment's own prior claim.
// The general "tree-sitter uses byte offsets" fact is true of the
// native/C tree-sitter library, but web-tree-sitter's JS binding (used
// here) reports startIndex/endIndex in UTF-16 code units -- plain JS
// string .length semantics -- not raw UTF-8 bytes. Verified by
// cross-parsing a real fixture containing multi-byte UTF-8 characters: a
// byte-length-based offset computation drifted by exactly the
// UTF-8-vs-UTF-16 difference of the unicode line; a plain-.length-based
// computation matched exactly. Do not "fix" a caller's UTF-16-based
// conversion to use byte length -- that would reintroduce this bug.
export class FunctionRangeNotFoundError extends Error {
  public readonly startByte: number;
  public readonly endByte: number;

  constructor(startByte: number, endByte: number) {
    super(
      `No function definition found with the exact range [${startByte}, ${endByte}]. ` +
        `Note: these are UTF-16 code unit offsets (plain JS string .length semantics), not UTF-8 byte offsets.`
    );
    this.name = "FunctionRangeNotFoundError";
    this.startByte = startByte;
    this.endByte = endByte;
  }
}
