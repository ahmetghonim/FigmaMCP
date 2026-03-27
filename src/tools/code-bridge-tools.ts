/**
 * Code Bridge Tools
 * MCP tools for Design ↔ Code transformation.
 *
 * Tools:
 *   synthesize_component_react  — Figma selection → React + Tailwind/CSS
 *   extract_computed_styles     — Figma selection → CSS properties
 *   link_design_to_code         — Generate Code Connect .figma.tsx file
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import {
  synthesizeComponentReact, extractComputedStyles,
  generateCodeConnect, SERIALIZE_FOR_CODE_BRIDGE,
} from "../engines/code-bridge/index.js";
import { createChildLogger } from "../core/logger.js";
import type { SerializedNode } from "../engines/intelligence/types.js";

const logger = createChildLogger({ component: "code-bridge-tools" });

export function registerCodeBridgeTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  // ── synthesize_component_react ──────────────────────────────────────────────
  server.tool(
    "synthesize_component_react",
    `Convert the selected Figma frame(s) to production React component code.
Generates Tailwind CSS classes where possible (falls back to inline style for custom values).

**Output includes:**
- Functional React component (TypeScript or JavaScript)
- Full layout structure matching Figma hierarchy
- Colors, spacing, typography, border-radius
- Proper className structure for easy overriding

Select one or more frames before calling.`,
    {
      useTailwind: z.boolean().optional().default(true).describe("Use Tailwind utility classes (false = inline styles)"),
      typescript: z.boolean().optional().default(true).describe("Generate TypeScript (.tsx)"),
      componentName: z.string().optional().describe("Override component name (uses Figma layer name by default)"),
    },
    async ({ useTailwind, typescript, componentName }) => {
      try {
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(SERIALIZE_FOR_CODE_BRIDGE, 10000);

        if (!result.success || result.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: result.result?.error ?? "Select a frame first" }) }],
            isError: true,
          };
        }

        const { nodes } = result.result as { nodes: SerializedNode[] };
        const code = synthesizeComponentReact(nodes, { useTailwind, typescript, componentName });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, code, componentCount: nodes.length }),
          }],
        };
      } catch (error) {
        logger.error({ error }, "synthesize_component_react failed");
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── extract_computed_styles ─────────────────────────────────────────────────
  server.tool(
    "extract_computed_styles",
    `Extract computed CSS from the selected Figma nodes.
Generates standard CSS with nested selectors based on layer hierarchy.
Useful for copying exact styles to your codebase.`,
    {
      format: z.enum(["css", "scss", "css-variables"]).optional().default("css"),
    },
    async ({ format }) => {
      try {
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(SERIALIZE_FOR_CODE_BRIDGE, 10000);

        if (!result.success || result.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Select a frame first" }) }],
            isError: true,
          };
        }

        const { nodes } = result.result as { nodes: SerializedNode[] };
        let css = extractComputedStyles(nodes);

        if (format === "css-variables") {
          // Extract all unique colors as custom properties
          const hexes = new Set<string>();
          const collectHex = (n: SerializedNode) => {
            n.fills?.filter(f => f.type === "SOLID" && f.hex).forEach(f => hexes.add(f.hex!));
            n.strokes?.filter(s => s.hex).forEach(s => hexes.add(s.hex!));
            n.children?.forEach(collectHex);
          };
          nodes.forEach(collectHex);
          const vars = [...hexes].map((h, i) => `  --color-${i + 1}: ${h};`).join("\n");
          css = `:root {\n${vars}\n}\n\n${css}`;
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, css, format, nodeCount: nodes.length }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── link_design_to_code ─────────────────────────────────────────────────────
  server.tool(
    "link_design_to_code",
    `Generate a Figma Code Connect file that links the selected component to its code counterpart.
Creates a \`.figma.tsx\` file in your output directory with the correct mapping structure.

After generating, edit the \`props\` mapping section then run:
\`npx @figma/code-connect publish\`

Supports: React (primary), Web Components, Vue.`,
    {
      componentName: z.string().describe("React/code component name (e.g., Button, CardHeader)"),
      sourcePath: z.string().describe("Import path in your codebase (e.g., @/components/ui/button)"),
      framework: z.enum(["React", "Web Components", "Vue"]).optional().default("React"),
      outputDir: z.string().optional().default(".").describe("Directory to write the .figma.tsx file"),
      nodeId: z.string().optional().describe("Figma node ID (uses selection if not provided)"),
    },
    async ({ componentName, sourcePath, framework, outputDir, nodeId }) => {
      try {
        const connector = await getDesktopConnector();

        // Get node info
        const nodeCode = nodeId
          ? `(async()=>{const n=await figma.getNodeByIdAsync('${nodeId}');return n?{id:n.id,name:n.name,type:n.type}:{error:'Node not found'};})()`
          : `(()=>{const s=figma.currentPage.selection;return s.length?{id:s[0].id,name:s[0].name,type:s[0].type}:{error:'No selection. Select a component first.'};})()`;

        const nodeResult = await connector.executeCodeViaUI(nodeCode, 5000);
        if (!nodeResult.success || nodeResult.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: nodeResult.result?.error ?? "Could not get node" }) }],
            isError: true,
          };
        }

        const node = nodeResult.result;
        const fileKey = process.env.FIGMA_FILE_KEY ?? "YOUR_FILE_KEY";

        const { filePath, code } = generateCodeConnect({
          nodeId: node.id, nodeName: node.name, fileKey,
          componentName, sourcePath, framework, outputDir,
        });

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, code);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              file: filePath,
              nodeId: node.id, nodeName: node.name,
              message: `Code Connect file written. Edit the props mapping in ${path.basename(filePath)}, then run: npx @figma/code-connect publish`,
              code,
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}
