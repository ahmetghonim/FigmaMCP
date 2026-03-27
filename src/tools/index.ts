/**
 * FigmaMCP — Master Tool Registry
 * 97 tools total: 65 base (figma-console-mcp) + 32 new (FigmaMCP engines)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaAPI } from "../core/figma-api.js";

// ── Layer 1: figma-console-mcp base (65 tools) ──────────────────────────────
import { registerWriteTools } from "../core/write-tools.js";
import { registerFigmaAPITools } from "../core/figma-tools.js";
import { registerDesignSystemTools } from "../core/design-system-tools.js";
import { registerDesignCodeTools } from "../core/design-code-tools.js";
import { registerFigJamTools } from "../core/figjam-tools.js";
import { registerSlidesTools } from "../core/slides-tools.js";
import { registerAnnotationTools } from "../core/annotation-tools.js";
import { registerCommentTools } from "../core/comment-tools.js";
import { registerDeepComponentTools } from "../core/deep-component-tools.js";

// ── Layer 2: Synthesis ───────────────────────────────────────────────────────
import { registerSynthesisTools } from "./synthesis-tools.js";

// ── Layer 3: Token Orchestration ─────────────────────────────────────────────
import { registerTokenTools } from "./token-tools.js";

// ── Layer 4: Intelligence Engine ─────────────────────────────────────────────
import { registerIntelligenceTools } from "./intelligence-tools.js";

// ── Layer 5: Code Bridge ─────────────────────────────────────────────────────
import { registerCodeBridgeTools } from "./code-bridge-tools.js";

// ── Layer 6: Workflow ─────────────────────────────────────────────────────────
import { registerWorkflowTools } from "./workflow-tools.js";

// ── Layers 7–9: Theme, A11y, Knowledge ───────────────────────────────────────
import {
  registerThemeTools,
  registerA11yTools,
  registerKnowledgeTools,
} from "./theme-a11y-knowledge-tools.js";

// ── MCP Apps (Token Browser + Design System Dashboard) ───────────────────────
// Gated behind ENABLE_MCP_APPS=true env var — zero impact when disabled
import { registerTokenBrowserApp } from "../apps/token-browser/server.js";
import { registerDesignSystemDashboardApp } from "../apps/design-system-dashboard/server.js";

export function registerAllTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>,
  getFigmaAPI: () => Promise<FigmaAPI>,
  getCurrentUrl: () => string | null,
): void {
  // Variables cache shared by design-system and design-code tools
  const variablesCache = new Map<string, { data: any; timestamp: number }>();

  // ── Base layer — figma-console-mcp ────────────────────────────────────────
  registerWriteTools(server, getDesktopConnector);
  registerFigmaAPITools(server, getFigmaAPI, getCurrentUrl);
  registerDesignSystemTools(server, getFigmaAPI, getCurrentUrl, variablesCache);
  registerDesignCodeTools(server, getFigmaAPI, getCurrentUrl, variablesCache, undefined, getDesktopConnector);
  registerFigJamTools(server, getDesktopConnector);
  registerSlidesTools(server, getDesktopConnector);
  registerAnnotationTools(server, getDesktopConnector);
  registerCommentTools(server, getFigmaAPI, getCurrentUrl);
  registerDeepComponentTools(server, getDesktopConnector);

  // ── New FigmaMCP layers ───────────────────────────────────────────────────────
  registerSynthesisTools(server, getDesktopConnector);
  registerTokenTools(server, getDesktopConnector);
  registerIntelligenceTools(server, getDesktopConnector);
  registerCodeBridgeTools(server, getDesktopConnector);
  registerWorkflowTools(server, getDesktopConnector);
  registerThemeTools(server, getDesktopConnector);
  registerA11yTools(server, getDesktopConnector);
  registerKnowledgeTools(server);

  // ── MCP Apps — interactive UI panels (opt-in via ENABLE_MCP_APPS=true) ──────
  if (process.env.ENABLE_MCP_APPS === "true") {
    // Token Browser: "browse the design tokens" → opens interactive token explorer
    registerTokenBrowserApp(server, async (fileUrl?: string) => {
      const connector = await getDesktopConnector();
      const code = `(async () => {
        const cols = await figma.variables.getLocalVariableCollectionsAsync();
        const vars = await figma.variables.getLocalVariablesAsync();
        return {
          variables: vars.map(v => ({
            id: v.id, name: v.name, type: v.resolvedType,
            collectionId: v.variableCollectionId,
            valuesByMode: v.valuesByMode,
            description: v.description,
          })),
          collections: cols.map(c => ({
            id: c.id, name: c.name, modes: c.modes, variableIds: c.variableIds,
          })),
        };
      })()`;
      const result = await connector.executeCodeViaUI(code, 20000);
      return result.result ?? { variables: [], collections: [] };
    });

    // Design System Dashboard: "audit the design system" → Lighthouse-style scorecard
    registerDesignSystemDashboardApp(
      server,
      async (fileUrl?: string) => {
        const connector = await getDesktopConnector();
        const code = `(async () => {
          function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
          const vars = await figma.variables.getLocalVariablesAsync();
          const cols = await figma.variables.getLocalVariableCollectionsAsync();
          const comps = figma.currentPage.findAll(n => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
          return {
            variables: vars.map(v => ({ id:v.id, name:v.name, type:v.resolvedType, collectionId:v.variableCollectionId })),
            collections: cols.map(c => ({ id:c.id, name:c.name, modes:c.modes })),
            components: comps.map(c => ({ id:c.id, name:c.name, type:c.type, description:c.description||'' })),
            fileName: figma.root.name,
            pageCount: figma.root.children.length,
          };
        })()`;
        const result = await connector.executeCodeViaUI(code, 20000);
        return result.result ?? { variables: [], collections: [], components: [], fileName: "Unknown", pageCount: 0 };
      },
      getCurrentUrl
    );
  }
}
