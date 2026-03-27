/**
 * Handoff Intelligence Engine
 * Generates developer-ready artifacts from Figma designs.
 *
 * - buildHandoffSpec    — developer handoff markdown document
 * - buildDevTicket      — Jira/Linear ticket from a frame
 * - buildChangelog      — formatted changelog from Figma version history
 * - buildCommentSummary — prioritized comment digest
 */

import type { SerializedNode } from "../intelligence/types.js";

// ─── Developer handoff spec ───────────────────────────────────────────────────

export function buildHandoffSpec(
  nodes: SerializedNode[],
  meta: { file: string; page: string },
  options: { format?: "markdown" | "json"; includeTokenNames?: boolean } = {}
): string {
  const { format = "markdown", includeTokenNames = true } = options;

  if (format === "json") return JSON.stringify({ file: meta.file, page: meta.page, frames: nodes }, null, 2);

  const lines: string[] = [`# Developer Handoff Specification`, ``, `**File:** ${meta.file}  **Page:** ${meta.page}  **Generated:** ${new Date().toISOString().split("T")[0]}`, ``];

  function renderNode(node: SerializedNode, level = 2): void {
    const h = "#".repeat(Math.min(level, 5));
    lines.push(`${h} ${node.name}`, ``);
    lines.push(`| Property | Value |`, `|---|---|`);
    lines.push(`| Type | ${node.type} |`);
    lines.push(`| Size | ${node.width}×${node.height}px |`);
    lines.push(`| Position | x:${node.x}, y:${node.y} |`);

    const fill = node.fills?.[0];
    if (fill?.type === "SOLID" && fill.hex) {
      const tokenInfo = includeTokenNames && fill.isBound && fill.variableName ? ` → token: \`${fill.variableName}\`` : "";
      lines.push(`| Fill | \`${fill.hex}\`${tokenInfo} |`);
    }
    const stroke = node.strokes?.[0];
    if (stroke?.hex) lines.push(`| Stroke | \`${stroke.hex}\` ${stroke.weight}px |`);
    if (node.cornerRadius) lines.push(`| Border Radius | ${node.cornerRadius}px |`);
    if (node.opacity && node.opacity !== 1) lines.push(`| Opacity | ${Math.round(node.opacity * 100)}% |`);

    if (node.layout && node.layout.mode !== "NONE") {
      const l = node.layout;
      lines.push(`| Layout | ${l.mode === "HORIZONTAL" ? "Row" : "Column"} flex |`);
      if (l.gap) lines.push(`| Gap | ${l.gap}px |`);
      const pt = l.paddingTop ?? 0, pr = l.paddingRight ?? 0, pb = l.paddingBottom ?? 0, pl = l.paddingLeft ?? 0;
      if (pt || pr || pb || pl) lines.push(`| Padding | ${pt}/${pr}/${pb}/${pl}px (T/R/B/L) |`);
    }
    if (node.type === "TEXT" && node.typography) {
      const t = node.typography;
      if (t.fontSize) lines.push(`| Font Size | ${t.fontSize}px |`);
      if (t.fontFamily) lines.push(`| Font Family | ${t.fontFamily} |`);
      if (t.fontWeight) lines.push(`| Font Weight | ${t.fontWeight} |`);
      if (t.characters) lines.push(`| Content | "${t.characters.slice(0, 80)}${t.characters.length > 80 ? "…" : ""}" |`);
    }
    lines.push(``);

    if (node.children?.length) {
      lines.push(`**Children (${node.children.length}):**`, ``);
      for (const child of node.children.slice(0, 20)) renderNode(child, level + 1);
    }
  }

  for (const node of nodes) renderNode(node);
  return lines.join("\n");
}

// ─── Figma plugin code: serialize for handoff ─────────────────────────────────

export const SERIALIZE_FOR_HANDOFF = `(async () => {
  function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
  function getVarName(node,prop){
    try{const bv=node.boundVariables?.[prop];if(!bv)return undefined;const id=Array.isArray(bv)?bv[0]?.id:bv?.id;if(!id)return undefined;const v=figma.variables.getVariableById(id);return v?.name;}catch{return undefined;}
  }
  function serialize(node,depth=0){
    if(depth>4)return null;
    const n={id:node.id,name:node.name,type:node.type,width:Math.round(node.width||0),height:Math.round(node.height||0),x:Math.round(node.x||0),y:Math.round(node.y||0)};
    if(node.fills?.length)n.fills=node.fills.slice(0,2).map(f=>f.type==='SOLID'?{type:'SOLID',hex:rgbToHex(f.color.r,f.color.g,f.color.b),isBound:!!node.boundVariables?.fills,variableName:getVarName(node,'fills')}:{type:f.type});
    if(node.strokes?.length)n.strokes=node.strokes.slice(0,1).map(s=>s.type==='SOLID'?{type:'SOLID',hex:rgbToHex(s.color.r,s.color.g,s.color.b),weight:node.strokeWeight}:{type:s.type});
    if(node.cornerRadius)n.cornerRadius=node.cornerRadius;
    if(node.opacity&&node.opacity!==1)n.opacity=node.opacity;
    if(node.type==='TEXT')n.typography={fontSize:typeof node.fontSize==='number'?node.fontSize:undefined,fontFamily:node.fontName?.family,fontWeight:typeof node.fontWeight==='number'?node.fontWeight:undefined,textAlign:node.textAlignHorizontal,characters:node.characters?.slice(0,200)};
    if(node.layoutMode&&node.layoutMode!=='NONE')n.layout={mode:node.layoutMode,gap:node.itemSpacing,paddingTop:node.paddingTop,paddingRight:node.paddingRight,paddingBottom:node.paddingBottom,paddingLeft:node.paddingLeft,primaryAxisAlign:node.primaryAxisAlignItems,counterAxisAlign:node.counterAxisAlignItems};
    if(node.children)n.children=node.children.map(c=>serialize(c,depth+1)).filter(Boolean);
    return n;
  }
  const sel=figma.currentPage.selection;
  if(!sel.length)return{error:'No selection. Select frames to generate handoff spec.'};
  return{nodes:sel.map(n=>serialize(n)),file:figma.root.name,page:figma.currentPage.name,fileKey:figma.fileKey};
})()`;

// ─── Dev ticket generator ─────────────────────────────────────────────────────

export interface DevTicketOptions {
  projectKey?: string;
  issueType?: "Story" | "Task" | "Bug" | "Epic";
  assignee?: string;
  sprint?: string;
  labels?: string[];
}

export function buildDevTicket(
  node: { id: string; name: string; width: number; height: number; fileKey?: string; file: string; page: string },
  options: DevTicketOptions = {}
): Record<string, any> {
  const { projectKey = "FE", issueType = "Story", assignee, sprint, labels = [] } = options;
  const figmaUrl = node.fileKey
    ? `https://www.figma.com/design/${node.fileKey}?node-id=${node.id.replace(":", "-")}`
    : `[Figma link — add file key to FIGMA_FILE_KEY env]`;

  return {
    summary: `[Design] Implement: ${node.name}`,
    description: `## Design Implementation Task\n\n### Reference\n- **File:** ${node.file}\n- **Page:** ${node.page}\n- **Component:** ${node.name} (${node.width}×${node.height}px)\n- **Figma:** ${figmaUrl}\n\n### Acceptance Criteria\n- [ ] Implements ${node.name} matching Figma spec pixel-perfectly\n- [ ] Uses design system tokens (no hardcoded values)\n- [ ] Responsive: mobile → desktop breakpoints\n- [ ] WCAG AA accessible (contrast, focus, touch targets)\n- [ ] Unit tests written\n- [ ] Cross-browser tested (Chrome, Firefox, Safari)\n- [ ] Reviewed against Figma handoff spec${assignee ? `\n\n### Assigned To\n@${assignee}` : ""}${sprint ? `\n\n### Sprint\n${sprint}` : ""}`,
    labels: ["design-implementation", "frontend", ...labels],
    project: projectKey,
    issueType,
    figmaUrl,
    metadata: { generatedAt: new Date().toISOString(), source: "fdis" },
  };
}

// ─── Comment summarizer (Figma REST API data) ─────────────────────────────────

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  critical:  ["wrong", "broken", "error", "fix", "incorrect", "missing", "crash"],
  high:      ["change", "update", "revise", "different", "off", "issue", "problem"],
  question:  ["?", "why", "how", "what", "should", "which", "when", "can we"],
  approval:  ["looks good", "lgtm", "approved", "✓", "👍", "perfect", "great", "ship it"],
  feedback:  ["consider", "maybe", "suggestion", "could", "might", "idea"],
};

export function summarizeComments(comments: any[], groupBy: "priority" | "author" | "topic" = "priority"): Record<string, any[]> {
  const tagged = comments.map(c => {
    const text = (c.message ?? "").toLowerCase();
    let priority = "feedback";
    let topic = "general";
    for (const [p, kws] of Object.entries(PRIORITY_KEYWORDS)) {
      if (kws.some(kw => text.includes(kw))) { priority = p; topic = p; break; }
    }
    return { ...c, priority, topic };
  });

  const grouped: Record<string, any[]> = {};
  for (const c of tagged) {
    const key = groupBy === "priority" ? c.priority : groupBy === "author" ? (c.user?.handle ?? "unknown") : c.topic;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: c.id, message: (c.message ?? "").slice(0, 200),
      author: c.user?.handle, created: c.created_at,
      topic: c.topic,
    });
  }
  return grouped;
}
