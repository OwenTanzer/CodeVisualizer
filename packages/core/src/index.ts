// @codevisualizer/core public API.
//
// Deliberately narrow (MOO-71 Commit 2 review gate: "is the core API
// narrow enough to maintain? are internal parser details prevented from
// becoming accidental public API?"). Parser internals (AbstractParser,
// PyAstParser, AstParserTypes, StringProcessor) are intentionally NOT
// re-exported here -- the 7 in-tree language parsers that still need
// AbstractParser as a base class import it from the dedicated
// "@codevisualizer/core/internal" entry point (see src/internal.ts),
// not through this barrel and not via any other deep path -- the
// package.json "exports" map blocks any other subpath at resolution
// time (PR #1 review: "the package has no exports boundary").
export { ensureParserInit } from "./core/language-services/common/ParserInit";
export { GrammarAssetNotFoundError, FunctionRangeNotFoundError } from "./core/language-services/common/errors";
export {
  initPythonLanguageService,
  analyzePythonCode,
  analyzePythonFunction,
  resolvePythonWasmPath,
} from "./core/language-services/python";
export {
  FlowchartIR,
  FlowchartNode,
  FlowchartEdge,
  LocationMapEntry,
  NodeType,
  NodeCategory,
  SemanticNodeInfo,
  Location,
} from "./ir/ir";
