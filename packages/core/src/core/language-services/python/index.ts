import { join } from "node:path";
import { PyAstParser } from "./PyAstParser";
import { FlowchartIR } from "../../../ir/ir";

let parserPromise: Promise<PyAstParser> | null = null;

/**
 * Resolves the tree-sitter-python.wasm grammar bundled with this
 * package, relative to the compiled module itself -- correct regardless
 * of where node_modules/@codevisualizer/core ends up installed. Used as
 * initPythonLanguageService's default when no explicit path is given
 * (e.g. a Node/Railway consumer); a VS Code extension can still pass its
 * own explicit path, unchanged.
 */
export function resolvePythonWasmPath(): string {
  return join(__dirname, "tree-sitter-python.wasm");
}

/**
 * Initializes the Python language service.
 * @param wasmPath Absolute path to tree-sitter-python.wasm. Defaults to
 *   the copy bundled with this package (resolvePythonWasmPath()) when
 *   omitted.
 * @returns A promise that resolves once initialization succeeds, or
 *   rejects with the real initialization error (e.g.
 *   GrammarAssetNotFoundError) -- callers that need to observe
 *   initialization failure should await this.
 */
export async function initPythonLanguageService(wasmPath: string = resolvePythonWasmPath()): Promise<void> {
  try {
    parserPromise = PyAstParser.create(wasmPath);
    await parserPromise;
    console.log("Python language service initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Python language service:", error);
    throw error;
  }
}

/**
 * Analyzes Python code, resolving the target function by "the function
 * containing this position" -- suited to an editor cursor position,
 * where the enclosing function IS the intended target even for a
 * position inside a nested function. Not suited to resolving an exact
 * canonical coordinate; use analyzePythonFunction for that.
 */
export async function analyzePythonCode(
  code: string,
  position: number
): Promise<FlowchartIR> {
  if (!parserPromise) {
    throw new Error("Python language service not initialized.");
  }
  const parser = await parserPromise;
  return parser.generateFlowchart(code, undefined, position);
}

/**
 * Analyzes Python code, resolving the target function by its EXACT
 * range (despite the startByte/endByte naming, these are UTF-16 code
 * unit offsets via web-tree-sitter's JS binding, not UTF-8 bytes -- see
 * the correction note on FunctionRangeNotFoundError) rather than by
 * containment. Use this when the caller already has a canonical
 * function coordinate (e.g. from a symbol index built on the same
 * tree-sitter ranges) and needs the exact function, not whichever one
 * happens to contain a position -- a
 * position inside a nested function would otherwise resolve to its
 * outer enclosing function via analyzePythonCode.
 *
 * Rejects with FunctionRangeNotFoundError if no function_definition has
 * exactly this range.
 */
export async function analyzePythonFunction(
  code: string,
  range: { startByte: number; endByte: number }
): Promise<FlowchartIR> {
  if (!parserPromise) {
    throw new Error("Python language service not initialized.");
  }
  const parser = await parserPromise;
  return parser.generateFlowchartForRange(code, range);
}
