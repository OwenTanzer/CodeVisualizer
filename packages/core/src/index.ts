// @codevisualizer/core public API.
//
// Deliberately narrow (MOO-71 Commit 2 review gate: "is the core API
// narrow enough to maintain? are internal parser details prevented from
// becoming accidental public API?"). Parser internals (AbstractParser,
// PyAstParser, AstParserTypes, StringProcessor) are intentionally NOT
// re-exported here -- the 7 in-tree language parsers that still need
// AbstractParser as a base class import it via a deep path
// (@codevisualizer/core/dist/core/common/AbstractParser), not through
// this barrel.
export { ensureParserInit } from "./core/language-services/common/ParserInit";
export { initPythonLanguageService, analyzePythonCode } from "./core/language-services/python";
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
