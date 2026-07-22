import { FlowchartIR, FlowchartNode, FlowchartEdge, NodeType } from "@codevisualizer/core";
import { StringProcessor } from "@codevisualizer/core/internal";
import { SubtleThemeManager, ThemeStyles } from "./utils/ThemeManager";

// Optimized string building
class StringBuilder {
  private parts: string[] = [];

  append(str: string): void {
    this.parts.push(str);
  }

  appendLine(str: string): void {
    this.parts.push(str, "\n");
  }

  toString(): string {
    return this.parts.join("");
  }

  clear(): void {
    this.parts.length = 0;
  }
}

export class EnhancedMermaidGenerator {
  private sb = new StringBuilder();
  private themeStyles: ThemeStyles;

  constructor(
    private themeKey: string = "monokai",
    private vsCodeTheme: "light" | "dark" = "dark"
  ) {
    this.themeStyles = SubtleThemeManager.getThemeStyles(themeKey, vsCodeTheme);
  }

  /**
   * Sanitizes an ID string to be Mermaid-compatible.
   * It replaces spaces with underscores and removes all non-alphanumeric characters.
   */
  private sanitizeId(id: string): string {
    return id
      .replace(/\s+/g, '_')
      .replace(/[^\w]/g, '') // Remove all non-alphanumeric characters
      .replace(/_+/g, '_');
  }

  /**
   * Generates a map of edge IDs to their source and target node IDs.
   * @param ir The flowchart intermediate representation.
   * @returns A map where the key is a generated edge ID and the value contains the source and target node IDs.
   */
  private generateEdgeMetadata(ir: FlowchartIR): Map<string, {source: string, target: string}> {
    const edgeMap = new Map<string, {source: string, target: string}>();
    const isHashedId = (id: string) => /^N[0-9A-Z]+$/.test(id);
    
    for (const edge of ir.edges) {
      // Use IDs as-is if already hashed, otherwise sanitize
      const sanitizedFrom = isHashedId(edge.from) ? edge.from : this.sanitizeId(edge.from);
      const sanitizedTo = isHashedId(edge.to) ? edge.to : this.sanitizeId(edge.to);
      const edgeId = `${sanitizedFrom}_${sanitizedTo}`;
      
      // Store both source and target
      edgeMap.set(edgeId, {
        source: sanitizedFrom,
        target: sanitizedTo
      });
    }
    
    return edgeMap;
  }

  public generate(ir: FlowchartIR): string {
    this.sb.clear();
    this.sb.appendLine("graph TD");
    
    // Add this line to avoid default node styling conflicts
    this.sb.appendLine("    classDef default fill:none,stroke:none");

    if (ir.title) {
      this.sb.appendLine(`%% ${ir.title}`);
    }

    // Apply sanitization to all IDs first to ensure consistency
    // BUT: If IDs are already hashed (like from CodebaseGraphBuilder), don't re-sanitize
    // Check if IDs look like hashed IDs (start with 'N' followed by base36 chars)
    const isHashedId = (id: string) => /^N[0-9A-Z]+$/.test(id);
    
    for (const node of ir.nodes) {
        // Only sanitize if not already hashed
        if (!isHashedId(node.id)) {
            node.id = this.sanitizeId(node.id);
        }
    }
    for (const edge of ir.edges) {
        if (!isHashedId(edge.from)) {
            edge.from = this.sanitizeId(edge.from);
        }
        if (!isHashedId(edge.to)) {
            edge.to = this.sanitizeId(edge.to);
        }
    }

    // Generate nodes efficiently
    for (const node of ir.nodes) {
      const shape = this.getShape(node);
      let label = this.escapeString(node.label);

      this.sb.append("    ");
      this.sb.append(node.id);
      this.sb.append(shape[0]);
      this.sb.append('"');
      this.sb.append(label);
      this.sb.append('"');
      this.sb.append(shape[1]);
      this.sb.appendLine("");
    }

    // Generate edges efficiently
    for (const edge of ir.edges) {
      this.sb.append("    ");
      this.sb.append(edge.from);

      if (edge.label) {
        const label = this.escapeString(edge.label);
        this.sb.append(' -- "');
        this.sb.append(label);
        this.sb.append('" --> ');
      } else {
        this.sb.append(" --> ");
      }

      this.sb.append(edge.to);
      this.sb.appendLine("");
    }
    
    // Generate edge metadata as comments for JavaScript to parse
    this.sb.appendLine("");
    this.sb.appendLine("    %% Edge metadata for interaction");
    const edgeMetadata = this.generateEdgeMetadata(ir);
    for (const [edgeId, metadata] of edgeMetadata) {
      this.sb.appendLine(`    %% EDGE_META:${metadata.source}:${metadata.target}`);
    }

    // Generate enhanced styling class definitions
    this.generateClassDefinitions();

    // Apply classes to nodes based on their semantic types
    for (const node of ir.nodes) {
      if (node.nodeType) {
        const className = SubtleThemeManager.getNodeClassName(node.nodeType);
        this.sb.append("    class ");
        this.sb.append(node.id);
        this.sb.append(" ");
        this.sb.append(className);
        this.sb.appendLine("");
      } else if (node.style) {
        // Fallback for nodes with old-style inline styling
        this.sb.append("    ");
        this.sb.append(node.id);
        this.sb.append(":::fallback_");
        this.sb.append(node.id);
        this.sb.appendLine("");

        // Generate inline class definition for this specific node
        this.sb.append("    classDef fallback_");
        this.sb.append(node.id);
        this.sb.append(" ");
        this.sb.append(node.style);
        this.sb.appendLine("");
      }
    }

    // Generate click handlers efficiently
    for (const entry of ir.locationMap) {
      // Use the already sanitized node ID
      const sanitizedNodeId = this.sanitizeId(entry.nodeId);
      this.sb.append("    click ");
      this.sb.append(sanitizedNodeId);
      this.sb.append(" call onNodeClick(");
      this.sb.append(entry.start.toString());
      this.sb.append(", ");
      this.sb.append(entry.end.toString());
      this.sb.appendLine(")");
    }

    return this.sb.toString();
  }

  private generateClassDefinitions(): void {
    this.sb.appendLine("");
    this.sb.appendLine("    %% Enhanced node styling classes");

    // Generate class definitions for each node type
    const nodeTypes = Object.values(NodeType);

    for (const nodeType of nodeTypes) {
      const className = SubtleThemeManager.getNodeClassName(nodeType);
      const cssStyle = this.generateCSSStyle(nodeType);

      this.sb.append("    classDef ");
      this.sb.append(className);
      this.sb.append(" ");
      this.sb.append(cssStyle);
      this.sb.appendLine("");
    }
    this.sb.appendLine("");
  }

  private generateCSSStyle(nodeType: NodeType): string {
    const nodeStyle = SubtleThemeManager.getNodeStyle(nodeType);
    const themeColor = this.getThemeColorForNodeType(nodeType);

    let cssStyle = `fill:${themeColor.fill},stroke:${themeColor.stroke}`;

    // Add stroke width based on emphasis
    const strokeWidth = this.getStrokeWidthForEmphasis(nodeStyle.emphasis);
    cssStyle += `,stroke-width:${strokeWidth}px`;

    // Add dash array for border style
    const dashArray = SubtleThemeManager.getDashArrayForBorderStyle(
      nodeStyle.borderStyle
    );
    if (dashArray) {
      cssStyle += `,stroke-dasharray:${dashArray}`;
    }

    // Add text color if specified
    if (themeColor.textColor) {
      cssStyle += `,color:${themeColor.textColor}`;
    }

    return cssStyle;
  }

  private getThemeColorForNodeType(nodeType: NodeType) {
    switch (nodeType) {
      case NodeType.ENTRY:
        return this.themeStyles.entry;
      case NodeType.EXIT:
        return this.themeStyles.exit;
      case NodeType.DECISION:
      case NodeType.LOOP_START:
        return this.themeStyles.decision;
      case NodeType.LOOP_END:
        return this.themeStyles.loop;
      case NodeType.EXCEPTION:
        return this.themeStyles.exception;
      case NodeType.ASSIGNMENT:
        return this.themeStyles.assignment;
      case NodeType.FUNCTION_CALL:
        return this.themeStyles.functionCall;
      case NodeType.ASYNC_OPERATION:
        return this.themeStyles.asyncOperation;
      case NodeType.BREAK_CONTINUE:
        return this.themeStyles.breakContinue;
      case NodeType.RETURN:
        return this.themeStyles.returnNode;
      case NodeType.PROCESS:
      default:
        return this.themeStyles.process;
    }
  }

  private getStrokeWidthForEmphasis(emphasis: string): number {
    switch (emphasis) {
      case "high":
        return 2;
      case "medium":
        return 1.5;
      case "low":
      default:
        return 1;
    }
  }

  private getShape(node: FlowchartNode): [string, string] {
    if (node.nodeType) {
      const nodeStyle = SubtleThemeManager.getNodeStyle(node.nodeType);
      return this.getShapeMarkers(nodeStyle.shape);
    }

    // Fallback to original shape logic
    switch (node.shape) {
      case "diamond":
        return ["{", "}"];
      case "round":
        return ["((", "))"];
      case "stadium":
        return ["([", "])"];
      case "rect":
      default:
        return ["[", "]"];
    }
  }

  private getShapeMarkers(shape: string): [string, string] {
    switch (shape) {
      case "diamond":
        return ["{", "}"];
      case "round":
        return ["((", "))"];
      case "stadium":
        return ["([", "])"];
      case "rect":
      default:
        return ["[", "]"];
    }
  }

  private escapeString(str: string): string {
    return StringProcessor.escapeString(str);
  }

}
