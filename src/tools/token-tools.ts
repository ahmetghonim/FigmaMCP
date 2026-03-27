/**
 * Token Orchestration Tools
 * MCP tool registrations for the Token Orchestration Engine.
 *
 * Tools:
 *   figma_create_token_preset   — install Tailwind/shadcn/Radix/IDS preset collections
 *   figma_import_tokens         — import JSON token object → Figma variables
 *   sync_design_tokens          — bi-directional tokens.json ↔ Figma variables
 *   compare_token_schemas       — diff two token snapshots
 *   migrate_token_structure     — batch rename/remap token names across the file
 *   measure_token_adoption      — coverage report: % using tokens vs hardcoded
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import {
  TAILWIND_COLORS, SHADCN_SEMANTIC, SPACING_TOKENS, RADIUS_TOKENS,
  TYPOGRAPHY_TOKENS, IDS_BASE_SEMANTIC,
  buildColorCollectionCode, buildShadcnSemanticCode, buildNumericCollectionCode,
} from "../engines/token-orchestration/presets.js";
import {
  buildExportVariablesCode, buildImportTokensCode, buildMigrateTokensCode,
  diffTokenTrees, MEASURE_ADOPTION_CODE,
} from "../engines/token-orchestration/sync.js";
import { createChildLogger } from "../core/logger.js";

const logger = createChildLogger({ component: "token-tools" });

export function registerTokenTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  // ── figma_create_token_preset ───────────────────────────────────────────────
  server.tool(
    "figma_create_token_preset",
    `Install a production-ready design token preset as Figma variables.

**Presets:**
- \`tailwind\`   — Full Tailwind CSS color palette (22 families × 11 shades = 242 COLOR variables)
- \`shadcn\`     — shadcn/ui: primitives (zinc palette) + semantic Light/Dark mode variables
- \`radix\`      — Radix UI Colors: 13 families × 12 perceptual steps
- \`spacing\`    — Tailwind spacing scale (0–256px, 4px base unit) as FLOAT variables
- \`radii\`      — Border radius scale: none/sm/default/md/lg/xl/2xl/3xl/full
- \`typography\` — Font size (xs→6xl), weight (thin→extrabold), line-height scale
- \`ids-base\`   — IDS Base Design System: semantic Light/Dark colors + spacing + radii (recommended starting point for multi-tenant systems)`,
    {
      preset: z.enum(["tailwind", "shadcn", "radix", "spacing", "radii", "typography", "ids-base"])
        .describe("Which token preset to install"),
      collectionName: z.string().optional().describe("Override the default collection name"),
    },
    async ({ preset, collectionName }) => {
      try {
        const connector = await getDesktopConnector();
        const results: any[] = [];

        const run = async (code: string, label: string) => {
          const r = await connector.executeCodeViaUI(code, 30000);
          results.push({ label, success: r.success, result: r.result, error: r.error });
          return r;
        };

        if (preset === "tailwind") {
          await run(buildColorCollectionCode(collectionName ?? "Color/Primitives", TAILWIND_COLORS), "Tailwind colors");
        }

        if (preset === "shadcn") {
          await run(buildColorCollectionCode("shadcn/primitives", { zinc: TAILWIND_COLORS.zinc, slate: TAILWIND_COLORS.slate }), "shadcn primitives");
          await run(buildShadcnSemanticCode(), "shadcn semantic (Light/Dark)");
        }

        if (preset === "radix") {
          // Radix color scale — embedded subset
          const RADIX: Record<string, Record<string, string>> = {
            gray:  {1:"#fcfcfc",2:"#f9f9f9",3:"#f0f0f0",4:"#e8e8e8",5:"#e0e0e0",6:"#d9d9d9",7:"#cecece",8:"#bbbbbb",9:"#8d8d8d",10:"#838383",11:"#646464",12:"#202020"},
            red:   {1:"#fffcfc",2:"#fff7f7",3:"#feebec",4:"#ffdbdc",5:"#ffcdce",6:"#fdbdbe",7:"#f4a9aa",8:"#eb8e90",9:"#e5484d",10:"#dc3e42",11:"#ce2c31",12:"#641723"},
            orange:{1:"#fefcfb",2:"#fff7ed",3:"#ffefd6",4:"#ffdfb5",5:"#ffd19a",6:"#ffc182",7:"#f5ae73",8:"#ec9455",9:"#f76b15",10:"#ef5f00",11:"#cc4e00",12:"#582d1d"},
            green: {1:"#fbfefc",2:"#f4fbf6",3:"#e6f6eb",4:"#d6f1df",5:"#c4e8d1",6:"#adddc0",7:"#8eceaa",8:"#5bb98b",9:"#30a46c",10:"#2b9a66",11:"#218358",12:"#193b2d"},
            blue:  {1:"#fbfdff",2:"#f4faff",3:"#e6f4fe",4:"#d5efff",5:"#c2e5ff",6:"#acd8fc",7:"#8ec8f6",8:"#5eb1ef",9:"#0090ff",10:"#0588f0",11:"#0d74ce",12:"#113264"},
            violet:{1:"#fdfcfe",2:"#faf8ff",3:"#f4f0fe",4:"#ebe4ff",5:"#e1d9ff",6:"#d4cafe",7:"#c2b5f5",8:"#aa99ec",9:"#6e56cf",10:"#654dc4",11:"#6550b9",12:"#2f265f"},
            amber: {1:"#fefdfb",2:"#fefbe9",3:"#fff7c2",4:"#ffee9c",5:"#fbe577",6:"#f3d673",7:"#e9c162",8:"#e2a336",9:"#ffc53d",10:"#ffba18",11:"#ab6400",12:"#4f3422"},
            teal:  {1:"#fafefd",2:"#f3fbf9",3:"#e0f8f3",4:"#ccf3ea",5:"#b8eae0",6:"#a1ded2",7:"#83cdc1",8:"#53b9ab",9:"#12a594",10:"#0d9b8a",11:"#008573",12:"#0d3d38"},
          };
          await run(buildColorCollectionCode(collectionName ?? "radix/colors", RADIX), "Radix colors");
        }

        if (preset === "spacing") {
          await run(buildNumericCollectionCode(collectionName ?? "Spacing", SPACING_TOKENS), "Spacing scale");
        }

        if (preset === "radii") {
          await run(buildNumericCollectionCode(collectionName ?? "Border Radius", RADIUS_TOKENS), "Border radius");
        }

        if (preset === "typography") {
          await run(buildNumericCollectionCode(collectionName ?? "Typography", TYPOGRAPHY_TOKENS), "Typography scale");
        }

        if (preset === "ids-base") {
          // Build semantic Light/Dark collection from IDS_BASE_SEMANTIC
          const semanticCode = `(async()=>{
            function h(hex){const e=hex.replace('#','');const f=e.length===3?e[0]+e[0]+e[1]+e[1]+e[2]+e[2]:e;return{r:parseInt(f.slice(0,2),16)/255,g:parseInt(f.slice(2,4),16)/255,b:parseInt(f.slice(4,6),16)/255};}
            const cols=await figma.variables.getLocalVariableCollectionsAsync();
            let col=cols.find(c=>c.name==='Color/Semantic');
            if(!col)col=figma.variables.createVariableCollection('Color/Semantic');
            col.renameMode(col.modes[0].modeId,'Light');
            const lightId=col.modes[0].modeId;
            let darkId=col.modes.find(m=>m.name==='Dark')?.modeId;
            if(!darkId)darkId=col.addMode('Dark');
            const existing=await figma.variables.getLocalVariablesAsync('COLOR');
            const data=${JSON.stringify(IDS_BASE_SEMANTIC)};
            let created=0;
            for(const[name,{light,dark}] of Object.entries(data)){
              let v=existing.find(ev=>ev.name===name&&ev.variableCollectionId===col.id);
              if(!v){v=figma.variables.createVariable(name,col,'COLOR');created++;}
              v.setValueForMode(lightId,h(light));v.setValueForMode(darkId,h(dark));
            }
            return{collection:'Color/Semantic',created};
          })()`;
          await run(semanticCode, "IDS semantic (Light/Dark)");
          await run(buildNumericCollectionCode("Spacing", SPACING_TOKENS), "IDS spacing");
          await run(buildNumericCollectionCode("Border Radius", RADIUS_TOKENS), "IDS radii");
          await run(buildNumericCollectionCode("Typography", TYPOGRAPHY_TOKENS), "IDS typography");
        }

        const totalCreated = results.reduce((sum, r) => sum + (r.result?.created ?? 0), 0);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, preset, totalVariablesCreated: totalCreated, steps: results }),
          }],
        };
      } catch (error) {
        logger.error({ error }, "figma_create_token_preset failed");
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── figma_import_tokens ─────────────────────────────────────────────────────
  server.tool(
    "figma_import_tokens",
    `Import design tokens from a JSON object into Figma as variables.
Supports W3C DTCG format (\`{ $value, $type }\`), Style Dictionary format, and flat key:value format.
Nested objects become slash-separated variable names: \`{ colors: { primary: '#3b82f6' } }\` → \`colors/primary\`.`,
    {
      tokens: z.record(z.any()).describe("Token object to import (supports nested structure)"),
      collectionName: z.string().default("Imported Tokens").describe("Target Figma variable collection name"),
    },
    async ({ tokens, collectionName }) => {
      try {
        const code = buildImportTokensCode({ [collectionName]: tokens });
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(code, 30000);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, ...result.result }) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── sync_design_tokens ──────────────────────────────────────────────────────
  server.tool(
    "sync_design_tokens",
    `Two-way sync between Figma variables and a tokens.json file in your codebase.

**pull** — Export all Figma variables → tokens.json (Figma is source of truth)
**push** — Import tokens.json → Figma variables (file is source of truth)
**diff** — Show what changed without applying anything`,
    {
      direction: z.enum(["pull", "push", "diff"]).describe("Sync direction"),
      tokensFilePath: z.string().optional().default("./tokens.json").describe("Path to tokens.json"),
      collectionFilter: z.string().optional().describe("Only sync collections whose name starts with this prefix"),
    },
    async ({ direction, tokensFilePath, collectionFilter }) => {
      try {
        const connector = await getDesktopConnector();
        const absPath = path.resolve(tokensFilePath);

        if (direction === "pull" || direction === "diff") {
          const code = buildExportVariablesCode(collectionFilter);
          const result = await connector.executeCodeViaUI(code, 20000);
          const currentTokens = result.result;

          if (direction === "pull") {
            fs.writeFileSync(absPath, JSON.stringify(currentTokens, null, 2));
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: true, direction: "pull",
                  path: absPath,
                  collections: Object.keys(currentTokens ?? {}),
                  message: `Exported to ${absPath}`,
                }),
              }],
            };
          }

          // diff
          const existingTokens = fs.existsSync(absPath)
            ? JSON.parse(fs.readFileSync(absPath, "utf-8"))
            : {};
          const diff = diffTokenTrees(existingTokens, currentTokens ?? {});
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ direction: "diff", diff, figmaCollections: Object.keys(currentTokens ?? {}) }) }],
          };
        }

        if (direction === "push") {
          if (!fs.existsSync(absPath)) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${absPath}` }) }], isError: true };
          }
          const tokens = JSON.parse(fs.readFileSync(absPath, "utf-8"));
          const code = buildImportTokensCode(tokens);
          const result = await connector.executeCodeViaUI(code, 30000);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ success: result.success, direction: "push", ...result.result }),
            }],
          };
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown direction" }) }], isError: true };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── compare_token_schemas ───────────────────────────────────────────────────
  server.tool(
    "compare_token_schemas",
    `Compare two token snapshots and report what changed.
Pass the current file's tokens vs a saved baseline to track architecture drift.
If no baseline provided, exports the current file's tokens as a starting snapshot.`,
    {
      baseline: z.record(z.any()).optional().describe("Previous token snapshot to compare against (from a prior pull)"),
      collectionFilter: z.string().optional().describe("Only compare collections matching this prefix"),
    },
    async ({ baseline, collectionFilter }) => {
      try {
        const connector = await getDesktopConnector();
        const code = buildExportVariablesCode(collectionFilter);
        const result = await connector.executeCodeViaUI(code, 20000);
        const current = result.result;

        if (!baseline) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                message: "No baseline provided — here is the current token snapshot. Save this and pass it back as 'baseline' to compare later.",
                snapshot: current,
                collections: Object.keys(current ?? {}),
                total: Object.values(current ?? {}).reduce((s: number, c: any) => s + Object.keys(c ?? {}).length, 0),
              }),
            }],
          };
        }

        const diff = diffTokenTrees(baseline, current ?? {});
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, diff }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── migrate_token_structure ─────────────────────────────────────────────────
  server.tool(
    "migrate_token_structure",
    `Batch rename or remap design token names across the entire Figma file.
Use when restructuring your token architecture (e.g., \`primary\` → \`action/primary\`, \`spacing.4\` → \`spacing/md\`).
Supports exact matches and wildcard prefix matching (append \`*\` to \`from\`).

**Example migrations:**
\`[{ from: "color/primary", to: "action/primary" }, { from: "color/*", to: "brand/*" }]\``,
    {
      migrations: z.array(z.object({
        from: z.string().describe("Old variable name (exact or prefix with *)"),
        to: z.string().describe("New variable name"),
      })).min(1).describe("List of rename mappings"),
      dryRun: z.boolean().optional().default(true).describe("Preview changes without applying (set false to apply)"),
    },
    async ({ migrations, dryRun }) => {
      try {
        const code = buildMigrateTokensCode(migrations, dryRun);
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(code, 20000);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: result.success,
              dryRun,
              ...result.result,
              hint: dryRun ? "Set dryRun=false to apply these changes" : undefined,
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── measure_token_adoption ──────────────────────────────────────────────────
  server.tool(
    "measure_token_adoption",
    `Measure design token adoption across the current Figma page.
Reports what percentage of fills, strokes, corner radii, gaps, and typography use design tokens vs hardcoded values.
Provides an A–F grade and per-property breakdown.`,
    {},
    async () => {
      try {
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(MEASURE_ADOPTION_CODE, 20000);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: result.success, adoption: result.result }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}
