/**
 * Synthesis Tools
 * MCP tool registrations for the Component Synthesis Engine.
 *
 * Tools:
 *   figma_render_jsx          — JSX string → real Figma nodes
 *   figma_render_jsx_batch    — multiple JSX strings in one call
 *   generate_ui_from_intent   — natural language brief → full screen design
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { synthesizeJSX, synthesizeJSXBatch, generateFromIntent } from "../engines/component-synthesis/index.js";
import { createChildLogger } from "../core/logger.js";

const logger = createChildLogger({ component: "synthesis-tools" });

export function registerSynthesisTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  // ── figma_render_jsx ────────────────────────────────────────────────────────
  server.tool(
    "figma_render_jsx",
    `Render JSX-like syntax directly to the Figma canvas as real, editable nodes.
The most powerful creation tool — describe a UI structure declaratively and it becomes a Figma design.

**Supported elements:**
- \`<Frame>\` — auto-layout container (primary building block)
- \`<Text>\`  — text layer
- \`<Rect>\` / \`<Rectangle>\` — rectangle/shape
- \`<Image>\` — image placeholder
- \`<Icon>\`  — Iconify icon (fetched live from api.iconify.design)

**Frame props:**
- Layout: \`flex="row|col"\` \`gap={8}\` \`p={16}\` \`px={16}\` \`py={8}\` \`pt\` \`pr\` \`pb\` \`pl\`
- Size: \`w={320}\` \`h={200}\` or \`w="fill"\` for full-width
- Visual: \`bg="#ffffff"\` \`stroke="#e4e4e7"\` \`rounded={12}\` \`opacity={0.8}\`
- Alignment: \`align="start|center|end"\` \`justify="start|center|end|space-between"\`
- Advanced: \`wrap={true}\` \`wrapGap={8}\` \`clip={true}\` \`position="absolute"\` \`x={0}\` \`y={0}\`

**Text props:** \`size={14}\` \`weight="regular|medium|semibold|bold"\` \`color="#000000"\` \`w="fill"\`

**Icon props:** \`name="lucide:star"\` \`size={24}\` \`color="#71717a"\`
Common icons: lucide:mail, lucide:lock, lucide:user, lucide:search, lucide:arrow-right, lucide:check, lucide:x, lucide:chevron-down

**Token binding:** Use \`bg="var:action/primary"\` to bind to Figma variables by name.

**Example — Card component:**
\`\`\`jsx
<Frame name="Card" flex="col" bg="#ffffff" rounded={12} p={0} gap={0} w={320} clip={true}>
  <Frame name="Card/Image" w="fill" h={160} bg="#f4f4f5" />
  <Frame name="Card/Body" flex="col" gap={12} p={16} w="fill">
    <Frame name="Card/Header" flex="row" gap={8} align="center" w="fill">
      <Frame name="Badge" bg="#dbeafe" rounded={4} px={8} py={2}>
        <Text size={11} weight="medium" color="#2563eb">NEW</Text>
      </Frame>
      <Text size={12} color="#71717a" w="fill">Category</Text>
    </Frame>
    <Text size={18} weight="semibold" color="#18181b" w="fill">Card Title Here</Text>
    <Text size={14} color="#71717a" w="fill">Supporting description text that spans multiple lines</Text>
    <Frame name="Card/Actions" flex="row" gap={8} w="fill">
      <Frame name="Btn/Primary" bg="#3b82f6" rounded={8} px={16} py={8}>
        <Text size={14} weight="medium" color="#ffffff">Get Started</Text>
      </Frame>
      <Frame name="Btn/Ghost" bg="#f4f4f5" rounded={8} px={16} py={8}>
        <Text size={14} color="#18181b">Learn More</Text>
      </Frame>
    </Frame>
  </Frame>
</Frame>
\`\`\``,
    {
      jsx: z.string().describe("JSX string starting with <Frame name='...' ...>"),
    },
    async ({ jsx }) => {
      try {
        const { code } = await synthesizeJSX(jsx.trim());
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(code, 30000);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: result.success,
              result: result.result,
              error: result.error,
              message: result.success
                ? `✓ Rendered "${result.result?.name}" (${result.result?.width}×${result.result?.height}px)`
                : `Render failed: ${result.error}`,
            }),
          }],
        };
      } catch (error) {
        logger.error({ error }, "figma_render_jsx failed");
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) }],
          isError: true,
        };
      }
    }
  );

  // ── figma_render_jsx_batch ──────────────────────────────────────────────────
  server.tool(
    "figma_render_jsx_batch",
    `Render multiple JSX frames in a single call — 10x faster than calling figma_render_jsx repeatedly.
Arranges frames side-by-side (horizontal) or stacked (vertical) automatically.
Use for: component variants, responsive breakpoints, design system documentation.`,
    {
      jsxArray: z.array(z.string()).min(1).max(20).describe("Array of JSX strings, each starting with <Frame>"),
      gap: z.number().optional().default(80).describe("Gap in pixels between frames"),
      direction: z.enum(["horizontal", "vertical"]).optional().default("horizontal"),
    },
    async ({ jsxArray, gap, direction }) => {
      try {
        const results = await synthesizeJSXBatch(jsxArray.map(j => j.trim()));
        const connector = await getDesktopConnector();

        // Execute each frame sequentially, positioning relative to previous
        const execResults: any[] = [];
        let posOffset = 0;

        for (let i = 0; i < results.length; i++) {
          const r = await connector.executeCodeViaUI(results[i].code, 30000);
          if (r.success && r.result?.id) {
            // Reposition frame after creation
            const posCode = direction === "vertical"
              ? `(async()=>{const n=await figma.getNodeByIdAsync('${r.result.id}');if(n){n.y=${posOffset};} return {repositioned:true};})()`
              : `(async()=>{const n=await figma.getNodeByIdAsync('${r.result.id}');if(n){n.x=${posOffset};} return {repositioned:true};})()`; 
            if (i > 0) await connector.executeCodeViaUI(posCode, 5000);
            posOffset += direction === "vertical"
              ? (r.result.height ?? 200) + gap
              : (r.result.width ?? 320) + gap;
          }
          execResults.push({ index: i, success: r.success, result: r.result, error: r.error });
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, rendered: execResults.length, results: execResults }),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }],
          isError: true,
        };
      }
    }
  );

  // ── generate_ui_from_intent ─────────────────────────────────────────────────
  server.tool(
    "generate_ui_from_intent",
    `Generate a complete Figma screen design from a natural language brief.
Claude writes a full JSX layout which is then rendered to the canvas as real nodes.
No hardcoded pixel-pushing required — just describe what you need.

**Examples:**
- "A mobile login screen with email/password fields, a sign-in button, and a 'forgot password' link"
- "An onboarding step showing a feature illustration, headline, supporting text, and two CTAs"
- "A dashboard card with a revenue chart placeholder, KPI numbers, and a date filter"
- "A settings page with grouped rows: account, notifications, privacy, danger zone"

Requires ANTHROPIC_API_KEY environment variable.`,
    {
      brief: z.string().min(10).describe("Natural language description of the UI to design"),
      width: z.number().optional().default(375).describe("Canvas width (375=mobile, 1440=desktop, 768=tablet)"),
      height: z.number().optional().default(812).describe("Canvas height"),
      style: z.enum(["minimal", "material", "ios", "enterprise"]).optional().default("minimal"),
      apiKey: z.string().optional().describe("Anthropic API key (falls back to ANTHROPIC_API_KEY env)"),
    },
    async ({ brief, width, height, style, apiKey }) => {
      const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "ANTHROPIC_API_KEY not set. Pass apiKey parameter or set the env var." }) }],
          isError: true,
        };
      }
      try {
        const { code } = await generateFromIntent(brief, { width, height, style, apiKey: key });
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(code, 45000);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: result.success,
              result: result.result,
              message: result.success
                ? `✓ Generated "${result.result?.name}" (${result.result?.width}×${result.result?.height}px) from brief`
                : `Generation failed: ${result.error}`,
            }),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }],
          isError: true,
        };
      }
    }
  );
}
