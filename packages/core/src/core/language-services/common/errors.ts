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
