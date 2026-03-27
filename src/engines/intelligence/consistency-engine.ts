/**
 * Intelligence Engine — Component Consistency Engine
 * Deterministic analysis with 24h hash-based caching.
 * Ported from figmalint/src/core/consistency-engine.ts — runs server-side.
 *
 * Cache key = structural hash of node (name, type, hierarchy, token fingerprint)
 * Same component analyzed twice → same result (deterministic via temperature:0.1)
 */

import { createHash } from "crypto";
import type {
  SerializedNode, ComponentAnalysisResult, DesignQualityResult,
  QualityFinding
} from "./types.js";
import { TokenAnalyzer } from "./token-analyzer.js";
import { NamingFixer } from "./naming-fixer.js";
import type { NamingStrategy } from "./types.js";

// ─── Cache entry ──────────────────────────────────────────────────────────────

interface CacheEntry {
  hash: string;
  result: ComponentAnalysisResult;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── ComponentConsistencyEngine ───────────────────────────────────────────────

export class ComponentConsistencyEngine {
  private cache = new Map<string, CacheEntry>();
  private tokenAnalyzer = new TokenAnalyzer();
  private namingFixer = new NamingFixer();

  // ── Hash generation ─────────────────────────────────────────────────────────

  generateHash(node: SerializedNode): string {
    const fingerprint = {
      name: node.name,
      type: node.type,
      w: Math.round(node.width ?? 0),
      h: Math.round(node.height ?? 0),
      childCount: node.children?.length ?? 0,
      childTypes: node.children?.map(c => c.type).sort().join(",") ?? "",
      fillHexes: node.fills?.filter(f => f.type === "SOLID").map(f => f.hex).sort().join(",") ?? "",
      hasBoundFills: String(node.fills?.some(f => f.isBound) ?? false),
      cornerRadius: node.cornerRadius ?? 0,
      layoutMode: node.layout?.mode ?? "NONE",
      gap: node.layout?.gap ?? 0,
    };
    return createHash("sha1").update(JSON.stringify(fingerprint)).digest("hex").slice(0, 16);
  }

  // ── Cache operations ────────────────────────────────────────────────────────

  getCached(hash: string): ComponentAnalysisResult | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(hash);
      return null;
    }
    return { ...entry.result, cacheHit: true };
  }

  setCached(hash: string, result: ComponentAnalysisResult): void {
    this.cache.set(hash, { hash, result, timestamp: Date.now() });
  }

  clearCache(): void { this.cache.clear(); }

  getCacheStats(): { size: number; oldestEntry: number | null } {
    const entries = [...this.cache.values()];
    const oldest = entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null;
    return { size: this.cache.size, oldestEntry: oldest };
  }

  // ── Rule-based quality scoring ──────────────────────────────────────────────

  private scoreQuality(
    node: SerializedNode,
    tokenCoverage: number,
    namingCoverage: number
  ): DesignQualityResult {
    const findings: QualityFinding[] = [];
    let score = 100;

    // Token coverage scoring
    if (tokenCoverage < 50) {
      findings.push({ severity: "critical", category: "tokens", location: node.name, issue: `Only ${tokenCoverage}% of values use design tokens`, fix: "Bind hardcoded colors, spacing and radii to variables" });
      score -= 25;
    } else if (tokenCoverage < 80) {
      findings.push({ severity: "warning", category: "tokens", location: node.name, issue: `${tokenCoverage}% token coverage — target is 100%`, fix: "Use infer_token_candidates to find remaining hardcoded values" });
      score -= 10;
    }

    // Naming coverage scoring
    if (namingCoverage < 60) {
      findings.push({ severity: "warning", category: "naming", location: node.name, issue: `${100 - namingCoverage}% of layers have generic names`, fix: "Run semantic_layer_naming or figma_autofix_issues" });
      score -= 15;
    }

    // Depth check
    const maxDepth = this.getMaxDepth(node);
    if (maxDepth > 6) {
      findings.push({ severity: "warning", category: "hierarchy", location: node.name, issue: `Nesting depth ${maxDepth} — complex hierarchy increases maintenance cost`, fix: "Extract deep sub-trees into separate components" });
      score -= 10;
    }

    // Auto-layout check
    if (node.layout?.mode === "NONE" && (node.children?.length ?? 0) > 1) {
      findings.push({ severity: "info", category: "spacing", location: node.name, issue: "Frame has children but no auto-layout — spacing may be inconsistent", fix: "Enable auto-layout (Shift+A) and define gap/padding tokens" });
      score -= 5;
    }

    // Accessibility checks
    if (node.children) {
      for (const child of node.children) {
        if (child.type === "TEXT") {
          const fontSize = child.typography?.fontSize;
          if (fontSize && fontSize < 12) {
            findings.push({ severity: "critical", category: "accessibility", location: child.name, issue: `Text "${child.typography?.characters?.slice(0, 30)}" is ${fontSize}px — below 12px minimum`, fix: "Increase to at least 12px for readability" });
            score -= 15;
          }
        }
        if ((child.width ?? 0) > 0 && (child.width ?? 0) < 44 && (child.height ?? 0) < 44 && child.reactions?.length) {
          findings.push({ severity: "warning", category: "accessibility", location: child.name, issue: `Interactive element ${child.width}×${child.height}px — below 44px touch target`, fix: "Minimum touch target should be 44×44px per WCAG 2.5.5" });
          score -= 10;
        }
      }
    }

    // Invisible node check
    const invisibleCount = this.countInvisible(node);
    if (invisibleCount > 0) {
      findings.push({ severity: "info", category: "hierarchy", location: node.name, issue: `${invisibleCount} hidden layers — may be leftover from iteration`, fix: "Remove or document hidden layers" });
    }

    const clampedScore = Math.max(0, Math.min(100, score));
    const strengths: string[] = [];
    if (tokenCoverage >= 90) strengths.push("Excellent token coverage");
    if (namingCoverage >= 90) strengths.push("Well-named layers");
    if (maxDepth <= 4) strengths.push("Clean hierarchy depth");
    if (node.layout?.mode !== "NONE") strengths.push("Uses auto-layout");

    return {
      score: clampedScore,
      grade: clampedScore >= 90 ? "A" : clampedScore >= 75 ? "B" : clampedScore >= 60 ? "C" : clampedScore >= 45 ? "D" : "F",
      summary: this.buildSummary(clampedScore, findings),
      findings,
      strengths,
      priorities: findings.filter(f => f.severity === "critical").map(f => f.fix).slice(0, 3),
    };
  }

  private buildSummary(score: number, findings: QualityFinding[]): string {
    const criticals = findings.filter(f => f.severity === "critical").length;
    const warnings = findings.filter(f => f.severity === "warning").length;
    if (criticals > 0) return `${criticals} critical issue${criticals > 1 ? "s" : ""} require immediate attention. Score: ${score}/100.`;
    if (warnings > 0) return `${warnings} warning${warnings > 1 ? "s" : ""} found. Score: ${score}/100.`;
    return `Component looks healthy. Score: ${score}/100.`;
  }

  private getMaxDepth(node: SerializedNode, depth = 0): number {
    if (!node.children?.length) return depth;
    return Math.max(...node.children.map(c => this.getMaxDepth(c, depth + 1)));
  }

  private countInvisible(node: SerializedNode): number {
    let count = 0;
    if (node.visible === false) count++;
    if (node.children) for (const c of node.children) count += this.countInvisible(c);
    return count;
  }

  // ── Full analysis pipeline ──────────────────────────────────────────────────

  analyze(node: SerializedNode, strategy: NamingStrategy = "kebab-case"): ComponentAnalysisResult {
    const hash = this.generateHash(node);
    const cached = this.getCached(hash);
    if (cached) return cached;

    // Run all analyzers
    const tokens = this.tokenAnalyzer.analyzeNode(node);
    const naming = this.namingFixer.analyzeNode(node, strategy);

    // Compute a11y score from findings
    const hasContrastIssue = tokens.issues.some(i => i.property === "fill" && i.severity === "critical");
    const a11yScore = hasContrastIssue ? 60 : 85;

    const quality = this.scoreQuality(node, tokens.coveragePercent, naming.coveragePercent);

    const componentScore = Math.round(
      (tokens.coveragePercent * 0.35) +
      (naming.coveragePercent * 0.25) +
      (quality.score * 0.30) +
      (a11yScore * 0.10)
    );

    const result: ComponentAnalysisResult = {
      componentName: node.name,
      score: componentScore,
      hash,
      tokenCoverage: tokens.coveragePercent,
      namingScore: naming.coveragePercent,
      a11yScore,
      tokens,
      naming,
      quality,
      cacheHit: false,
      analysisTimestamp: Date.now(),
    };

    this.setCached(hash, result);
    return result;
  }

  analyzeMany(nodes: SerializedNode[], strategy: NamingStrategy = "kebab-case"): ComponentAnalysisResult[] {
    return nodes.map(n => this.analyze(n, strategy));
  }
}

// Singleton instance
export const consistencyEngine = new ComponentConsistencyEngine();
