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
}
