/**
 * Workflow Tools
 * generate_design_changelog, create_dev_ticket_from_design,
 * generate_handoff_documentation, summarize_design_feedback
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import {
  buildHandoffSpec, buildDevTicket, summarizeComments,
  SERIALIZE_FOR_HANDOFF,
} from "../engines/handoff/index.js";
import type { SerializedNode } from "../engines/intelligence/types.js";

export function registerWorkflowTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  // ── generate_handoff_documentation ─────────────────────────────────────────
  server.tool(
    "generate_handoff_documentation",
    `Generate a complete developer handoff specification for the selected Figma frame(s).
Produces a structured Markdown document with all dimensions, colors, spacing, typography, and token references.
Select frames before calling.`,
    {
      format: z.enum(["markdown", "json"]).optional().default("markdown"),
      includeTokenNames: z.boolean().optional().default(true),
      outputPath: z.string().optional().describe("Write to file (e.g., ./handoff.md) — returns content if omitted"),
    },
    async ({ format, includeTokenNames, outputPath }) => {
      try {
        const connector = await getDesktopConnector();
        const result = await connector.executeCodeViaUI(SERIALIZE_FOR_HANDOFF, 15000);

        if (!result.success || result.result?.error) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: result.result?.error ?? "Select frames first" }) }],
            isError: true,
          };
        }

        const { nodes, file, page } = result.result as { nodes: SerializedNode[]; file: string; page: string };
        const spec = buildHandoffSpec(nodes, { file, page }, { format, includeTokenNames });

        if (outputPath) {
          fs.writeFileSync(outputPath, spec);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, path: outputPath, length: spec.length }) }] };
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, spec, format }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── create_dev_ticket_from_design ───────────────────────────────────────────
  server.tool(
    "create_dev_ticket_from_design",
    `Convert the selected Figma frame into a structured developer ticket (Jira/Linear format).
Includes Figma link, dimensions, acceptance criteria, and implementation checklist.
Select a frame before calling.`,
    {
      projectKey: z.string().optional().default("FE").describe("Jira/Linear project key"),
      issueType: z.enum(["Story", "Task", "Bug", "Epic"]).optional().default("Story"),
      assignee: z.string().optional().describe("Assignee @handle"),
      labels: z.array(z.string()).optional().default([]),
    },
    async ({ projectKey, issueType, assignee, labels }) => {
      try {
        const connector = await getDesktopConnector();
        const code = `(async()=>{const s=figma.currentPage.selection;if(!s.length)return{error:'No selection'};const n=s[0];return{id:n.id,name:n.name,type:n.type,width:Math.round(n.width),height:Math.round(n.height),fileKey:figma.fileKey,file:figma.root.name,page:figma.currentPage.name};})()`;
        const result = await connector.executeCodeViaUI(code, 5000);

        if (!result.success || result.result?.error) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: result.result?.error ?? "Select a frame first" }) }], isError: true };
        }

        const ticket = buildDevTicket(result.result, { projectKey, issueType, assignee, labels });
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, ticket }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── summarize_design_feedback ───────────────────────────────────────────────
  server.tool(
    "summarize_design_feedback",
    `Fetch and summarize all open comments in the Figma file, grouped by priority.
Auto-classifies comments as: critical, question, feedback, or approval.
Requires FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY.`,
    {
      fileKey: z.string().optional().describe("Figma file key (uses FIGMA_FILE_KEY env if not set)"),
      groupBy: z.enum(["priority", "author", "topic"]).optional().default("priority"),
    },
    async ({ fileKey, groupBy }) => {
      const token = process.env.FIGMA_ACCESS_TOKEN;
      const key = fileKey ?? process.env.FIGMA_FILE_KEY;
      if (!token || !key) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Set FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY" }) }], isError: true };
      }
      try {
        const res = await fetch(`https://api.figma.com/v1/files/${key}/comments`, { headers: { "X-Figma-Token": token } });
        if (!res.ok) throw new Error(`Figma API ${res.status}`);
        const data = await res.json() as any;
        const open = (data.comments ?? []).filter((c: any) => !c.resolved_at);
        const grouped = summarizeComments(open, groupBy);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, total: open.length, groupBy, grouped }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  // ── generate_design_changelog ───────────────────────────────────────────────
  server.tool(
    "generate_design_changelog",
    `Generate a formatted changelog from Figma file version history.
Produces a Markdown changelog ordered newest-first.
Requires FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY.`,
    {
      fileKey: z.string().optional().describe("Figma file key"),
      limit: z.number().optional().default(20).describe("Number of versions to include"),
    },
    async ({ fileKey, limit }) => {
      const token = process.env.FIGMA_ACCESS_TOKEN;
      const key = fileKey ?? process.env.FIGMA_FILE_KEY;
      if (!token || !key) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Set FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY" }) }], isError: true };
      }
      try {
        const res = await fetch(`https://api.figma.com/v1/files/${key}/versions`, { headers: { "X-Figma-Token": token } });
        if (!res.ok) throw new Error(`Figma API ${res.status}`);
        const data = await res.json() as any;
        const versions = (data.versions ?? []).slice(0, limit);
        const changelog = versions.map((v: any) => ({
          version: v.id, label: v.label || "Auto-saved",
          description: v.description || "", author: v.user?.handle, date: v.created_at,
        }));
        const md = `# Design Changelog\n\n` + changelog.map((v: any) =>
          `## ${v.date?.split("T")[0] ?? "unknown"} — ${v.label}\n${v.author ? `*By @${v.author}*\n\n` : ""}${v.description || "*No description*"}`
        ).join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, changelog, markdown: md }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}
