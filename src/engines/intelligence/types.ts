/**
 * Intelligence Engine — Shared Types
 * Ported from figmalint's types.ts, adapted for MCP server-side execution.
 * These run in the Node.js MCP process, NOT inside the Figma plugin.
 */

// ─── Serialized node data (received from Figma via figma_execute) ─────────────

export interface SerializedFill {
  type: "SOLID" | "GRADIENT_LINEAR" | "IMAGE" | string;
  hex?: string;
  opacity?: number;
  isBound?: boolean;
  variableName?: string;
}

export interface SerializedStroke {
  type: "SOLID" | string;
  hex?: string;
  weight?: number;
}

export interface SerializedTypography {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlign?: string;
  textCase?: string;
  characters?: string;
  isBound?: boolean;
}

export interface SerializedLayout {
  mode: "HORIZONTAL" | "VERTICAL" | "NONE";
  gap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: string;
  counterAxisAlign?: string;
  primaryAxisSizing?: string;
  counterAxisSizing?: string;
}

export interface SerializedBoundVariables {
  fills?: boolean;
  strokes?: boolean;
  cornerRadius?: boolean;
  itemSpacing?: boolean;
  paddingTop?: boolean;
  paddingRight?: boolean;
  paddingBottom?: boolean;
  paddingLeft?: boolean;
  opacity?: boolean;
}

export interface SerializedNode {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  fills?: SerializedFill[];
  strokes?: SerializedStroke[];
  cornerRadius?: number;
  opacity?: number;
  visible?: boolean;
  layoutMode?: string;
  layout?: SerializedLayout;
  typography?: SerializedTypography;
  boundVariables?: SerializedBoundVariables;
  isPartOfVariant?: boolean; // has default Figma variant frame styles
  children?: SerializedNode[];
  // Component-specific
  componentId?: string;
  mainComponentKey?: string;
  isDetached?: boolean;
  reactions?: any[];
}

// ─── Token Analysis ───────────────────────────────────────────────────────────

export interface DesignToken {
  name: string;
  value: string;
  type: "color" | "number" | "string" | "boolean";
  isActualToken: boolean; // true = bound to variable, false = hardcoded
  isDefaultVariantStyle?: boolean; // #9747FF purple border — ignore
  source: "figma-variable" | "figma-style" | "hardcoded" | "ai-suggestion";
  variableName?: string;
  suggestion?: string;
}

export interface TokenAnalysisResult {
  tokens: DesignToken[];
  hardcodedCount: number;
  boundCount: number;
  coveragePercent: number;
  issues: TokenIssue[];
}

export interface TokenIssue {
  nodeId: string;
  nodeName: string;
  property: string;
  value: string;
  severity: "critical" | "warning" | "info";
  message: string;
  suggestion?: string;
}

// ─── Naming Analysis ──────────────────────────────────────────────────────────

export type SemanticLayerType =
  | "button" | "icon" | "text" | "input" | "image" | "container"
  | "card" | "list" | "list-item" | "nav" | "header" | "footer"
  | "modal" | "dropdown" | "checkbox" | "radio" | "toggle" | "avatar"
  | "badge" | "divider" | "spacer" | "link" | "tab" | "tooltip"
  | "alert" | "progress" | "skeleton" | "unknown";

export type NamingStrategy = "semantic" | "bem" | "kebab-case" | "camelCase" | "PascalCase";

export interface NamingIssue {
  nodeId: string;
  nodeName: string;
  severity: "error" | "warning" | "info";
  issue: string;
  suggestedName: string;
  semanticType?: SemanticLayerType;
}

export interface NamingAnalysisResult {
  issues: NamingIssue[];
  genericCount: number;
  totalNodes: number;
  coveragePercent: number;
}

// ─── Design Quality Analysis ──────────────────────────────────────────────────

export interface DesignQualityResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  findings: QualityFinding[];
  strengths: string[];
  priorities: string[];
}

export interface QualityFinding {
  severity: "critical" | "warning" | "info";
  category: "hierarchy" | "spacing" | "typography" | "color" | "accessibility" | "naming" | "tokens";
  issue: string;
  location: string;
  fix: string;
}

// ─── Accessibility ────────────────────────────────────────────────────────────

export interface A11yResult {
  score: number;
  level: "AA" | "AAA";
  summary: { textNodes: number; interactiveElements: number; errors: number; warnings: number };
  issues: A11yIssue[];
}

export interface A11yIssue {
  category: "contrast" | "text" | "touch" | "focus";
  severity: "error" | "warning";
  nodeId: string;
  nodeName: string;
  message: string;
  details?: Record<string, any>;
}

// ─── Component Analysis ───────────────────────────────────────────────────────

export interface ComponentAnalysisResult {
  componentName: string;
  score: number;
  hash: string; // deterministic cache key
  tokenCoverage: number;
  namingScore: number;
  a11yScore: number;
  tokens: TokenAnalysisResult;
  naming: NamingAnalysisResult;
  quality: DesignQualityResult;
  cacheHit: boolean;
  analysisTimestamp: number;
}
