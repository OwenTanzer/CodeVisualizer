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
// function_definition has exactly the requested byte range -- a
// deliberate hard failure (a caller with a genuine canonical coordinate
// should always get an exact match), not a silent fallback to a nearby
// function. startByte/endByte are UTF-8 byte offsets (tree-sitter's own
// unit), not UTF-16 JS string indices.
export class FunctionRangeNotFoundError extends Error {
  public readonly startByte: number;
  public readonly endByte: number;

  constructor(startByte: number, endByte: number) {
    super(
      `No function definition found with the exact byte range [${startByte}, ${endByte}]. ` +
        `Note: these must be UTF-8 byte offsets (tree-sitter's own unit), not UTF-16 JS string indices.`
    );
    this.name = "FunctionRangeNotFoundError";
    this.startByte = startByte;
    this.endByte = endByte;
  }
}
