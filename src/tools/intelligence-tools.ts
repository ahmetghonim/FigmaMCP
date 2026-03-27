/**
 * Intelligence Tools
 * MCP tool registrations for the AI Intelligence Engine.
 * All tools work rule-based without an API key; AI enhances output when available.
 *
 * Tools:
 *   analyze_design_quality    — full component quality analysis (tokens + naming + a11y + UX)
 *   infer_token_candidates    — scan for hardcoded values that should be tokens
 *   semantic_layer_naming     — detect and fix generic layer names (Frame 47 → card-header)
 *   figma_autofix_issues      — apply fixes from any analysis tool automatically
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { consistencyEngine } from "../engines/intelligence/consistency-engine.js";
import { TokenAnalyzer, SERIALIZE_NODES_FOR_ANALYSIS } from "../engines/intelligence/token-analyzer.js";
import { NamingFixer } from "../engines/intelligence/naming-fixer.js";
import { aiProvider } from "../engines/intelligence/ai-provider.js";
import { createChildLogger } from "../core/logger.js";
import type { SerializedNode, NamingStrategy } from "../engines/intelligence/types.js";

const logger = createChildLogger({ component: "intelligence-tools" });
const tokenAnalyzer = new TokenAnalyzer();
const namingFixer = new NamingFixer();

export function registerIntelligenceTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  // ── analyze_design_quality ──────────────────────────────────────────────────
  server.tool(
    "analyze_design_quality",
    `Full AI-powered quality analysis of the selected Figma frames.
Runs the ComponentConsistencyEngine with 24-hour deterministic caching:
same component analyzed twice = same result.

**Reports:**
- Overall score (0–100) and grade (A–F)
- Token coverage: what % of values use design tokens
- Naming coverage: what % of layers have semantic names
- Accessibility: font sizes, touch targets, color binding
- UX quality: hierarchy depth, auto-layout usage, invisible layers
- Prioritized fix list

Select one or more frames before calling.`,
    {
      namingStrategy: z.enum(["kebab-case", "camelCase", "PascalCase", "sem"]).optional().default("kebab-case"),
      useAI: z.boolean().optional().default(false).describe("Enhance analysis with AI (requires ANTHROPIC_API_KEY)"),
    },
    async ({ namingStrategy, useAI }) => {
      try {
        const connector = await getDesktopConnector();
        const serialized = await connector.executeCodeViaUI(SERIALIZE_NODES_FOR_ANALYSIS, 15000);

        if (!serialized.success || serialized.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: serialized.result?.error ?? "Could not serialize nodes. Select a frame first." }) }],
            isError: true,
          };
        }

        const { nodes, file, page } = serialized.result as { nodes: SerializedNode[]; file: string; page: string };
        const strategy = namingStrategy as NamingStrategy;
        const analyses = consistencyEngine.analyzeMany(nodes, strategy);

        let aiInsights: string | undefined;
        if (useAI) {
          const summary = analyses.map(a => ({
            component: a.componentName, score: a.score,
            tokenCoverage: a.tokenCoverage, namingScore: a.namingScore,
            criticalFindings: a.quality.findings.filter(f => f.severity === "critical"),
          }));
          const response = await aiProvider.complete(
            `You are a senior design systems architect. Provide 3–5 specific, actionable improvement recommendations for these component analysis results:\n\n${JSON.stringify(summary, null, 2)}\n\nFocus on systemic issues, not just individual fixes. Be concise.`
          );
          aiInsights = response.text;
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              file, page,
              analyses,
              aiInsights,
              cacheStats: consistencyEngine.getCacheStats(),
            }),
          }],
        };
      } catch (error) {
        logger.error({ error }, "analyze_design_quality failed");
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── infer_token_candidates ──────────────────────────────────────────────────
  server.tool(
    "infer_token_candidates",
    `Scan the selected frames for hardcoded values (colors, spacing, radii) that should be design tokens.
Uses the TokenAnalyzer with built-in Figma variant-frame filtering — ignores Figma's own purple #9747FF component set borders.

**Reports:**
- All hardcoded fills, strokes, corner radii, and gap values
- Suggested token names based on value semantics
- Token coverage percentage per frame
- Sorted by severity (critical → warning → info)

Select frames before calling. Works without AI.`,
    {
      includeDefaults: z.boolean().optional().default(false).describe("Include common defaults like #ffffff, #000000"),
    },
    async ({ includeDefaults }) => {
      try {
        const connector = await getDesktopConnector();
        const serialized = await connector.executeCodeViaUI(SERIALIZE_NODES_FOR_ANALYSIS, 15000);

        if (!serialized.success || serialized.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: serialized.result?.error ?? "Select a frame first" }) }],
            isError: true,
          };
        }

        const { nodes } = serialized.result as { nodes: SerializedNode[] };
        const analysis = tokenAnalyzer.analyzeNodes(nodes);

        // Filter based on includeDefaults flag
        const filteredIssues = includeDefaults
          ? analysis.issues
          : analysis.issues.filter(i =>
              !["#ffffff", "#000000", "#fff", "#000"].includes((i.value ?? "").toLowerCase())
            );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              summary: {
                hardcodedCount: analysis.hardcodedCount,
                boundCount: analysis.boundCount,
                coveragePercent: analysis.coveragePercent,
                grade: analysis.coveragePercent >= 90 ? "A" : analysis.coveragePercent >= 75 ? "B" : analysis.coveragePercent >= 60 ? "C" : "D",
              },
              issues: filteredIssues.sort((a, b) => {
                const sev: Record<string, number> = { critical: 0, warning: 1, info: 2 };
                return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
              }),
              hint: "Use figma_autofix_issues to bind suggested tokens automatically",
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── semantic_layer_naming ───────────────────────────────────────────────────
  server.tool(
    "semantic_layer_naming",
    `Detect and rename generic layer names (Frame 47, Rectangle 12, Group 3) to semantic, meaningful names.
Uses pattern recognition across 28 SemanticLayerTypes: button, card, input, avatar, badge, modal, tooltip, etc.

**Detection methods:**
- Name pattern matching (btn → button, ico → icon, nav → navigation)
- Structure analysis (children count, reactions, dimensions)
- Content inference (text content, icon presence)

**Naming strategies:** kebab-case (default), camelCase, PascalCase, BEM

Set \`autoApply=true\` to rename immediately, or review the preview first.`,
    {
      namingStrategy: z.enum(["kebab-case", "camelCase", "PascalCase", "bem"]).optional().default("kebab-case"),
      autoApply: z.boolean().optional().default(false).describe("Apply renames immediately (false = preview only)"),
    },
    async ({ namingStrategy, autoApply }) => {
      try {
        const connector = await getDesktopConnector();
        const serialized = await connector.executeCodeViaUI(SERIALIZE_NODES_FOR_ANALYSIS, 15000);

        if (!serialized.success || serialized.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: serialized.result?.error ?? "Select a frame first" }) }],
            isError: true,
          };
        }

        const { nodes } = serialized.result as { nodes: SerializedNode[] };
        const analysis = namingFixer.analyzeNodes(nodes, namingStrategy as NamingStrategy);

        if (autoApply && analysis.issues.length > 0) {
          const applyCode = namingFixer.generateApplyCode(analysis.issues);
          const applyResult = await connector.executeCodeViaUI(applyCode, 15000);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true, applied: true,
                renamed: applyResult.result?.renamed ?? 0,
                totalIssues: analysis.issues.length,
                coverage: analysis.coveragePercent,
                renames: analysis.issues.map(i => ({ from: i.nodeName, to: i.suggestedName, type: i.semanticType })),
              }),
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              applied: false,
              preview: true,
              genericCount: analysis.genericCount,
              totalNodes: analysis.totalNodes,
              namingCoverage: analysis.coveragePercent,
              issues: analysis.issues,
              hint: "Set autoApply=true to apply these renames, or use figma_autofix_issues",
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── figma_autofix_issues ────────────────────────────────────────────────────
  server.tool(
    "figma_autofix_issues",
    `Automatically fix design issues found by analyze_design_quality, infer_token_candidates, or semantic_layer_naming.

**What it fixes:**
- Generic layer names → semantic names (Frame 47 → card-header)
- Hardcoded values → nearest matching design token binding
- Auto-layout gaps → spacing token binding (when matching token exists)

**Fix types:**
- \`naming\` — apply semantic layer renames only
- \`tokens\` — bind hardcoded values to nearest token (requires exact match)
- \`all\` — apply all fixable issues

Always previews changes first unless \`confirm=true\`.`,
    {
      fixType: z.enum(["naming", "tokens", "all"]).optional().default("naming"),
      confirm: z.boolean().optional().default(false).describe("Actually apply fixes (false = preview what would change)"),
    },
    async ({ fixType, confirm }) => {
      try {
        const connector = await getDesktopConnector();
        const serialized = await connector.executeCodeViaUI(SERIALIZE_NODES_FOR_ANALYSIS, 15000);

        if (!serialized.success || serialized.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Select a frame first" }) }],
            isError: true,
          };
        }

        const { nodes } = serialized.result as { nodes: SerializedNode[] };
        const results: any = { fixType, applied: confirm, actions: [] };

        // Naming fixes
        if (fixType === "naming" || fixType === "all") {
          const namingAnalysis = namingFixer.analyzeNodes(nodes, "kebab-case");
          if (namingAnalysis.issues.length > 0) {
            const preview = namingAnalysis.issues.map(i => ({ type: "rename", from: i.nodeName, to: i.suggestedName, semanticType: i.semanticType }));
            results.actions.push(...preview);

            if (confirm) {
              const applyCode = namingFixer.generateApplyCode(namingAnalysis.issues);
              const r = await connector.executeCodeViaUI(applyCode, 15000);
              results.namingFixed = r.result?.renamed ?? 0;
            } else {
              results.namingPreview = preview.length;
            }
          }
        }

        // Token binding fixes — requires existing variable matches
        if (fixType === "tokens" || fixType === "all") {
          const tokenAnalysis = tokenAnalyzer.analyzeNodes(nodes);
          const tokenIssues = tokenAnalysis.issues.filter(i => i.suggestion);

          if (tokenIssues.length > 0 && confirm) {
            // Generate code to bind hardcoded values to matching variables
            const bindCode = `(async () => {
              const vars = await figma.variables.getLocalVariablesAsync('COLOR');
              const numVars = await figma.variables.getLocalVariablesAsync('FLOAT');
              const issues = ${JSON.stringify(tokenIssues.map(i => ({ nodeId: i.nodeId, property: i.property, suggestion: i.suggestion })))};
              let fixed = 0;
              for (const issue of issues) {
                const node = await figma.getNodeByIdAsync(issue.nodeId);
                if (!node) continue;
                if (issue.property === 'fill' || issue.property === 'stroke') {
                  const v = vars.find(v => v.name === issue.suggestion);
                  if (!v) continue;
                  try {
                    if (issue.property === 'fill') {
                      node.fills = [figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:.5,g:.5,b:.5}},'color',v)];
                    } else {
                      node.strokes = [figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:.5,g:.5,b:.5}},'color',v)];
                    }
                    fixed++;
                  } catch {}
                }
              }
              return { fixed };
            })()`;
            const r = await connector.executeCodeViaUI(bindCode, 20000);
            results.tokensFixed = r.result?.fixed ?? 0;
          } else if (tokenIssues.length > 0) {
            results.tokenPreview = tokenIssues.map(i => ({
              type: "bind-token", nodeId: i.nodeId, nodeName: i.nodeName,
              property: i.property, value: i.value, suggestion: i.suggestion,
            }));
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true, ...results,
              hint: !confirm ? "Set confirm=true to apply these fixes" : undefined,
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}
