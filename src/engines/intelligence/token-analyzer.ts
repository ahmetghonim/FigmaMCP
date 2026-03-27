/**
 * Intelligence Engine — Token Analyzer
 * Analyzes serialized Figma node trees for design token usage.
 * Key feature: filters out Figma's own default variant frame styles (#9747FF).
 * Ported from figmalint/src/core/token-analyzer.ts — runs server-side.
 */

import type {
  SerializedNode, DesignToken, TokenAnalysisResult, TokenIssue
} from "./types.js";

// ─── Default variant frame detection ─────────────────────────────────────────
// Figma automatically applies these to COMPONENT_SET child frames:
// Stroke: #9747FF | cornerRadius: 5 | strokeWeight: 1 | padding: 16px all sides
// We must ignore these — they are Figma internals, not design decisions.

const DEFAULT_VARIANT_PURPLE = "#9747ff";

function isDefaultVariantStyle(node: SerializedNode): boolean {
  if (!node.isPartOfVariant) return false;
  const stroke = node.strokes?.[0];
  if (!stroke) return false;
  const isViolet = stroke.hex?.toLowerCase() === DEFAULT_VARIANT_PURPLE;
  const isDefaultRadius = node.cornerRadius === 5;
  const hasDefaultPadding =
    node.layout?.paddingTop === 16 && node.layout?.paddingRight === 16 &&
    node.layout?.paddingBottom === 16 && node.layout?.paddingLeft === 16;
  return isViolet && isDefaultRadius && Boolean(hasDefaultPadding);
}

// ─── Hardcoded value detection ────────────────────────────────────────────────

const COMMON_WHITES = ["#ffffff", "#fff", "white"];
const COMMON_BLACKS = ["#000000", "#000", "black"];
const COMMON_TRANSPARENTS = ["transparent", "#00000000"];

function shouldFlagColor(hex: string, isBound: boolean): boolean {
  if (isBound) return false;
  if (COMMON_TRANSPARENTS.includes(hex.toLowerCase())) return false;
  return true;
}

// ─── Main analyzer ────────────────────────────────────────────────────────────

export class TokenAnalyzer {
  analyzeNode(node: SerializedNode): TokenAnalysisResult {
    const tokens: DesignToken[] = [];
    const issues: TokenIssue[] = [];
    this.traverseNode(node, tokens, issues);

    const hardcodedCount = tokens.filter(t => !t.isActualToken && !t.isDefaultVariantStyle).length;
    const boundCount = tokens.filter(t => t.isActualToken).length;
    const total = hardcodedCount + boundCount;
    const coveragePercent = total === 0 ? 100 : Math.round((boundCount / total) * 100);

    return { tokens, hardcodedCount, boundCount, coveragePercent, issues };
  }

  analyzeNodes(nodes: SerializedNode[]): TokenAnalysisResult {
    const merged: TokenAnalysisResult = { tokens: [], hardcodedCount: 0, boundCount: 0, coveragePercent: 100, issues: [] };
    for (const node of nodes) {
      const result = this.analyzeNode(node);
      merged.tokens.push(...result.tokens);
      merged.hardcodedCount += result.hardcodedCount;
      merged.boundCount += result.boundCount;
      merged.issues.push(...result.issues);
    }
    const total = merged.hardcodedCount + merged.boundCount;
    merged.coveragePercent = total === 0 ? 100 : Math.round((merged.boundCount / total) * 100);
    return merged;
  }

  private traverseNode(node: SerializedNode, tokens: DesignToken[], issues: TokenIssue[]): void {
    const isVariantDefault = isDefaultVariantStyle(node);

    // ── Fill analysis
    if (node.fills?.length) {
      for (const fill of node.fills) {
        if (fill.type !== "SOLID" || !fill.hex) continue;
        const isActual = fill.isBound ?? false;
        const token: DesignToken = {
          name: `fill:${node.name}`,
          value: fill.hex,
          type: "color",
          isActualToken: isActual,
          isDefaultVariantStyle: isVariantDefault,
          source: isActual ? "figma-variable" : "hardcoded",
          variableName: fill.variableName,
        };
        if (!isVariantDefault) tokens.push(token);
        if (!isActual && !isVariantDefault && shouldFlagColor(fill.hex, false)) {
          issues.push({
            nodeId: node.id, nodeName: node.name,
            property: "fill", value: fill.hex,
            severity: "warning",
            message: `Hardcoded fill color ${fill.hex} — bind to a design token`,
            suggestion: this.suggestTokenName("fill", fill.hex),
          });
        }
      }
    }

    // ── Stroke analysis
    if (node.strokes?.length && !isVariantDefault) {
      for (const stroke of node.strokes) {
        if (stroke.type !== "SOLID" || !stroke.hex) continue;
        const isBound = node.boundVariables?.strokes ?? false;
        if (!isBound) {
          issues.push({
            nodeId: node.id, nodeName: node.name,
            property: "stroke", value: stroke.hex,
            severity: "info",
            message: `Hardcoded stroke ${stroke.hex}`,
            suggestion: this.suggestTokenName("stroke", stroke.hex),
          });
        }
        tokens.push({
          name: `stroke:${node.name}`, value: stroke.hex, type: "color",
          isActualToken: isBound,
          source: isBound ? "figma-variable" : "hardcoded",
        });
      }
    }

    // ── Corner radius
    if (node.cornerRadius !== undefined && node.cornerRadius > 0 && !isVariantDefault) {
      const isBound = node.boundVariables?.cornerRadius ?? false;
      if (!isBound) {
        issues.push({
          nodeId: node.id, nodeName: node.name,
          property: "cornerRadius", value: String(node.cornerRadius),
          severity: "info",
          message: `Hardcoded corner radius ${node.cornerRadius}px`,
          suggestion: "radius/md",
        });
      }
    }

    // ── Gap / spacing
    if (node.layout?.gap !== undefined && node.layout.gap > 0) {
      const isBound = node.boundVariables?.itemSpacing ?? false;
      if (!isBound) {
        issues.push({
          nodeId: node.id, nodeName: node.name,
          property: "gap", value: String(node.layout.gap),
          severity: "info",
          message: `Hardcoded gap ${node.layout.gap}px`,
          suggestion: `spacing/${this.closestSpacingToken(node.layout.gap)}`,
        });
      }
    }

    // ── Typography
    if (node.typography?.fontSize && !node.boundVariables?.fills) {
      if (node.typography.fontSize < 12) {
        issues.push({
          nodeId: node.id, nodeName: node.name,
          property: "fontSize", value: String(node.typography.fontSize),
          severity: "warning",
          message: `Font size ${node.typography.fontSize}px is below the 12px accessibility minimum`,
        });
      }
    }

    // ── Recurse children
    if (node.children) {
      for (const child of node.children) this.traverseNode(child, tokens, issues);
    }
  }

  private suggestTokenName(property: string, hex: string): string {
    // Simple heuristic based on color luminance
    const hexClean = hex.replace("#", "");
    const r = parseInt(hexClean.slice(0, 2), 16);
    const g = parseInt(hexClean.slice(2, 4), 16);
    const b = parseInt(hexClean.slice(4, 6), 16);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum > 240) return property === "stroke" ? "border/default" : "background/default";
    if (lum < 40) return property === "stroke" ? "border/emphasis" : "foreground/default";
    if (r > g + 30 && r > b + 30) return `feedback/error`;
    if (g > r + 30 && g > b + 30) return `feedback/success`;
    if (b > r + 30 && b > g + 30) return `action/primary`;
    return `color/${property}`;
  }

  private closestSpacingToken(px: number): string {
    const scale: Record<number, string> = { 4: "xs", 8: "sm", 12: "sm-plus", 16: "md", 24: "lg", 32: "xl", 48: "2xl", 64: "3xl" };
    const closest = Object.keys(scale).map(Number).reduce((prev, curr) =>
      Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev
    );
    return scale[closest] ?? `${px}px`;
  }
}

// ─── Figma Plugin Code: Node serializer (runs in Figma, results sent to server) ─

export const SERIALIZE_NODES_FOR_ANALYSIS = `(async () => {
  function isVariant(node) {
    let n = node;
    while (n) {
      if (n.type === 'COMPONENT_SET') return true;
      if (n.parent?.type === 'COMPONENT_SET') return true;
      n = n.parent;
    }
    return false;
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  function serializeNode(node, depth = 0) {
    if (depth > 5 || !node) return null;
    const info = {
      id: node.id, name: node.name, type: node.type,
      width: Math.round(node.width || 0), height: Math.round(node.height || 0),
      x: Math.round(node.x || 0), y: Math.round(node.y || 0),
      visible: node.visible, isPartOfVariant: isVariant(node),
    };
    if (node.cornerRadius !== undefined) info.cornerRadius = node.cornerRadius;
    if (node.opacity !== undefined && node.opacity !== 1) info.opacity = node.opacity;
    if (node.fills?.length) {
      info.fills = node.fills.map(f => {
        if (f.type !== 'SOLID') return { type: f.type };
        return {
          type: 'SOLID', hex: rgbToHex(f.color.r, f.color.g, f.color.b),
          opacity: f.opacity ?? 1,
          isBound: !!(node.boundVariables?.fills),
          variableName: (() => {
            try {
              const bv = node.boundVariables?.fills;
              if (bv) { const v = figma.variables.getVariableById(Array.isArray(bv) ? bv[0]?.id : bv?.id); return v?.name; }
            } catch {}
            return undefined;
          })(),
        };
      });
    }
    if (node.strokes?.length) {
      info.strokes = node.strokes.map(s => s.type === 'SOLID' ? { type: 'SOLID', hex: rgbToHex(s.color.r, s.color.g, s.color.b), weight: node.strokeWeight } : { type: s.type });
    }
    if (node.type === 'TEXT') {
      info.typography = {
        fontSize: typeof node.fontSize === 'number' ? node.fontSize : undefined,
        fontFamily: node.fontName?.family, fontStyle: node.fontName?.style,
        characters: node.characters?.slice(0, 100),
        textAlign: node.textAlignHorizontal, textCase: node.textCase,
      };
    }
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      info.layout = {
        mode: node.layoutMode, gap: node.itemSpacing,
        paddingTop: node.paddingTop, paddingRight: node.paddingRight,
        paddingBottom: node.paddingBottom, paddingLeft: node.paddingLeft,
        primaryAxisAlign: node.primaryAxisAlignItems,
        counterAxisAlign: node.counterAxisAlignItems,
      };
    }
    info.boundVariables = {
      fills: !!(node.boundVariables?.fills),
      strokes: !!(node.boundVariables?.strokes),
      cornerRadius: !!(node.boundVariables?.cornerRadius),
      itemSpacing: !!(node.boundVariables?.itemSpacing),
    };
    if (node.reactions?.length) info.reactions = node.reactions.map(r => r.trigger?.type);
    if (node.children) info.children = node.children.map(c => serializeNode(c, depth + 1)).filter(Boolean);
    return info;
  }
  const sel = figma.currentPage.selection;
  if (!sel.length) return { error: 'No selection. Please select a frame to analyze.' };
  return { nodes: sel.map(n => serializeNode(n)), page: figma.currentPage.name, file: figma.root.name };
})()`;
