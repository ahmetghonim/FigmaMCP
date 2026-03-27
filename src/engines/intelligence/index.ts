/**
 * Intelligence Engine — Public API
 * Re-exports all intelligence components for use by the tool layer.
 */

export { TokenAnalyzer, SERIALIZE_NODES_FOR_ANALYSIS } from "./token-analyzer.js";
export { NamingFixer } from "./naming-fixer.js";
export { ComponentConsistencyEngine, consistencyEngine } from "./consistency-engine.js";
export { AIProvider, aiProvider } from "./ai-provider.js";
export type {
  SerializedNode, SerializedFill, SerializedStroke, SerializedTypography,
  SerializedLayout, SerializedBoundVariables,
  DesignToken, TokenAnalysisResult, TokenIssue,
  SemanticLayerType, NamingStrategy, NamingIssue, NamingAnalysisResult,
  DesignQualityResult, QualityFinding,
  A11yResult, A11yIssue,
  ComponentAnalysisResult,
} from "./types.js";
