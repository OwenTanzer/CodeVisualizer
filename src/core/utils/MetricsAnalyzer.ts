import { FlowchartIR, NodeType } from "@codevisualizer/core";

export interface CodeMetrics {
  linesOfCode: number;
  numberOfNodes: number;
  numberOfEdges: number;
  decisionPoints: number;
  returnStatements: number;
  functionParameters: number;
}

export class MetricsAnalyzer {
  /**
   * Analyzes the FlowchartIR and source code to calculate metrics
   */
  static analyze(ir: FlowchartIR, sourceCode?: string): CodeMetrics {
    // Number of Nodes
    const numberOfNodes = ir.nodes.length;

    // Number of Edges/Branches
    const numberOfEdges = ir.edges.length;

    // Decision Points (if/switch/while/for)
    const decisionPoints = ir.nodes.filter(
      (node) =>
        node.nodeType === NodeType.DECISION ||
        node.nodeType === NodeType.LOOP_START
    ).length;

    // Return Statements Count
    const returnStatements = ir.nodes.filter(
      (node) => node.nodeType === NodeType.RETURN
    ).length;

    // Lines of Code (LOC)
    let linesOfCode = 0;
    if (ir.functionRange && sourceCode) {
      const functionCode = sourceCode.substring(
        ir.functionRange.start,
        ir.functionRange.end
      );
      linesOfCode = functionCode.split(/\r?\n/).filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("*");
      }).length;
    } else if (ir.functionRange) {
      // Fallback: estimate from location map
      const locations = ir.locationMap;
      if (locations.length > 0) {
        const maxEnd = Math.max(...locations.map((l) => l.end));
        const minStart = Math.min(...locations.map((l) => l.start));
        // Rough estimate: assume average 50 chars per line
        linesOfCode = Math.ceil((maxEnd - minStart) / 50);
      }
    }

    // Function Parameters Count
    // Try to extract from function signature or estimate from nodes
    let functionParameters = 0;
    if (sourceCode && ir.functionRange) {
      functionParameters = this.extractParameterCount(
        sourceCode,
        ir.functionRange.start
      );
    }

    return {
      linesOfCode,
      numberOfNodes,
      numberOfEdges,
      decisionPoints,
      returnStatements,
      functionParameters,
    };
  }

  /**
   * Extracts the number of parameters from function signature
   */
  private static extractParameterCount(
    sourceCode: string,
    functionStart: number
  ): number {
    // Look backwards from function start to find function signature
    const beforeFunction = sourceCode.substring(
      Math.max(0, functionStart - 500),
      functionStart
    );

    // Common patterns for function definitions
    const patterns = [
      // Function name(...params)
      /function\s+\w+\s*\(([^)]*)\)/g,
      // (params) => or (params) {
      /\(([^)]*)\)\s*[=>{]/g,
      // def name(params):
      /def\s+\w+\s*\(([^)]*)\)/g,
      // func name(params) {
      /func\s+\w+\s*\(([^)]*)\)/g,
      // public/private name(params)
      /(?:public|private|protected)?\s*\w+\s+\w+\s*\(([^)]*)\)/g,
    ];

    for (const pattern of patterns) {
      const matches = Array.from(beforeFunction.matchAll(pattern));
      if (matches.length > 0) {
        // Get the last match (closest to function start)
        const lastMatch = matches[matches.length - 1];
        const paramsStr = lastMatch[1] || "";
        // Count parameters (split by comma, filter empty)
        const params = paramsStr
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        return params.length;
      }
    }

    return 0;
  }
}

