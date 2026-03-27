/**
 * Code Bridge Engine
 * Transforms Figma node data into production code artifacts.
 *
 * - synthesizeComponentReact — Figma nodes → React + Tailwind/CSS Modules
 * - extractComputedStyles    — Figma nodes → CSS
 * - syncDesignTokens         — bi-directional tokens.json ↔ Figma variables
 * - generateCodeConnect      — Figma component → .figma.tsx Code Connect file
 */

import * as fs from "fs";
import * as path from "path";
import type { SerializedNode } from "../intelligence/types.js";
import {
  buildExportVariablesCode, buildImportTokensCode, diffTokenTrees
} from "../token-orchestration/sync.js";

// ─── Tailwind color map (hex → class fragment) ────────────────────────────────

const TW_COLORS: Record<string, string> = {
  "#ffffff":"white","#000000":"black","#f9fafb":"gray-50","#f3f4f6":"gray-100",
  "#e5e7eb":"gray-200","#d1d5db":"gray-300","#9ca3af":"gray-400","#6b7280":"gray-500",
  "#4b5563":"gray-600","#374151":"gray-700","#1f2937":"gray-800","#111827":"gray-900",
  "#fafafa":"zinc-50","#f4f4f5":"zinc-100","#e4e4e7":"zinc-200","#d4d4d8":"zinc-300",
  "#a1a1aa":"zinc-400","#71717a":"zinc-500","#52525b":"zinc-600","#3f3f46":"zinc-700",
  "#27272a":"zinc-800","#18181b":"zinc-900","#09090b":"zinc-950",
  "#eff6ff":"blue-50","#dbeafe":"blue-100","#bfdbfe":"blue-200","#93c5fd":"blue-300",
  "#60a5fa":"blue-400","#3b82f6":"blue-500","#2563eb":"blue-600","#1d4ed8":"blue-700",
  "#f0fdf4":"green-50","#dcfce7":"green-100","#22c55e":"green-500","#16a34a":"green-600",
  "#fef2f2":"red-50","#fee2e2":"red-100","#ef4444":"red-500","#dc2626":"red-600",
};

function tw(hex: string): string | null {
  return TW_COLORS[hex.toLowerCase()] ?? null;
}

const ALIGN_TW: Record<string, string> = { MIN: "items-start", CENTER: "items-center", MAX: "items-end", STRETCH: "items-stretch", SPACE_BETWEEN: "justify-between" };
const JUSTIFY_TW: Record<string, string> = { MIN: "justify-start", CENTER: "justify-center", MAX: "justify-end", SPACE_BETWEEN: "justify-between" };

// ─── Node → React JSX string ──────────────────────────────────────────────────

function nodeToJSX(node: SerializedNode, indent = 0, useTw = true): string {
  const pad = "  ".repeat(indent);
  const name = (node.name || "el").replace(/[^a-zA-Z0-9]/g, "");

  if (node.type === "TEXT") {
    const fill = node.fills?.[0]?.hex ?? "#000000";
    const fs = node.typography?.fontSize ?? 14;
    const fw = (node.typography?.fontWeight ?? 400) >= 600 ? "font-semibold" : (node.typography?.fontWeight ?? 400) >= 500 ? "font-medium" : "";
    const fsClass = fs <= 12 ? "text-xs" : fs <= 14 ? "text-sm" : fs <= 16 ? "text-base" : fs <= 18 ? "text-lg" : fs <= 20 ? "text-xl" : fs <= 24 ? "text-2xl" : "text-3xl";
    const colorClass = tw(fill) ? `text-${tw(fill)}` : ``;
    const classes = [fsClass, fw, colorClass].filter(Boolean).join(" ");
    const inlineStyle = !tw(fill) ? ` style={{color:'${fill}'}}` : "";
    return `${pad}<p className="${classes}"${inlineStyle}>${node.typography?.characters ?? ""}</p>`;
  }

  if (!node.layout) {
    // Static frame / rectangle
    const fill = node.fills?.[0]?.hex;
    const bgClass = fill && tw(fill) ? `bg-${tw(fill)}` : "";
    const rClass = node.cornerRadius ? (node.cornerRadius >= 9999 ? "rounded-full" : node.cornerRadius >= 16 ? "rounded-2xl" : node.cornerRadius >= 8 ? "rounded-lg" : "rounded") : "";
    const style = fill && !tw(fill) ? ` style={{background:'${fill}'}}` : "";
    return `${pad}<div className="w-[${node.width}px] h-[${node.height}px] ${[bgClass, rClass].filter(Boolean).join(" ")}"${style} />`;
  }

  const l = node.layout;
  const isRow = l.mode === "HORIZONTAL";
  const fill = node.fills?.[0]?.hex;
  const bgClass = fill ? (tw(fill) ? `bg-${tw(fill)}` : "") : "";
  const rClass = node.cornerRadius ? (node.cornerRadius >= 9999 ? "rounded-full" : node.cornerRadius >= 16 ? "rounded-2xl" : node.cornerRadius >= 8 ? "rounded-lg" : "rounded") : "";
  const gapClass = l.gap ? `gap-[${l.gap}px]` : "";
  const pt = l.paddingTop ?? 0, pr = l.paddingRight ?? 0, pb = l.paddingBottom ?? 0, pl = l.paddingLeft ?? 0;
  const pClass = pt === pr && pr === pb && pb === pl && pt > 0 ? `p-[${pt}px]` : [pt ? `pt-[${pt}px]` : "", pr ? `pr-[${pr}px]` : "", pb ? `pb-[${pb}px]` : "", pl ? `pl-[${pl}px]` : ""].filter(Boolean).join(" ");
  const alignClass = l.counterAxisAlign ? (ALIGN_TW[l.counterAxisAlign] ?? "items-start") : "items-start";
  const justifyClass = l.primaryAxisAlign ? (JUSTIFY_TW[l.primaryAxisAlign] ?? "justify-start") : "justify-start";
  const sizeClass = `w-[${node.width}px] h-[${node.height}px]`;
  const inlineStyle = fill && !tw(fill) ? ` style={{background:'${fill}'}}` : "";
  const classes = ["flex", isRow ? "flex-row" : "flex-col", gapClass, pClass, alignClass, justifyClass, bgClass, rClass, sizeClass].filter(Boolean).join(" ");

  const children = node.children?.map(c => nodeToJSX(c, indent + 1, useTw)).join("\n") ?? "";
  return `${pad}<div className="${classes}"${inlineStyle}>\n${children}\n${pad}</div>`;
}

export function synthesizeComponentReact(
  nodes: SerializedNode[],
  options: { useTailwind?: boolean; typescript?: boolean; componentName?: string } = {}
): string {
  const { useTailwind = true, typescript = true, componentName } = options;

  return nodes.map((node, i) => {
    const name = componentName ?? (node.name.replace(/[^a-zA-Z0-9]/g, "") || `Component${i + 1}`);
    const jsx = nodeToJSX(node, 2, useTailwind);
    const ext = typescript ? "tsx" : "jsx";
    const props = typescript ? `interface ${name}Props {}\n\n` : "";
    const sig = typescript ? `const ${name}: React.FC<${name}Props> = () => {` : `const ${name} = () => {`;
    return `// ${node.name} (${node.width}×${node.height}px)\n${props}${sig}\n  return (\n${jsx}\n  );\n};\n\nexport default ${name};`;
  }).join("\n\n---\n\n");
}

// ─── Node → CSS ───────────────────────────────────────────────────────────────

function nodeToCSS(node: SerializedNode, selector = ""): string {
  const sel = selector || `.${(node.name || "el").replace(/\s+/g, "-").toLowerCase()}`;
  const rules: string[] = [];
  const fill = node.fills?.[0];
  if (fill?.type === "SOLID" && fill.hex) rules.push(`  background-color: ${fill.hex};`);
  const stroke = node.strokes?.[0];
  if (stroke?.hex) rules.push(`  border: ${stroke.weight ?? 1}px solid ${stroke.hex};`);
  if (node.cornerRadius) rules.push(`  border-radius: ${node.cornerRadius}px;`);
  if (node.opacity && node.opacity !== 1) rules.push(`  opacity: ${node.opacity};`);
  if (node.width) rules.push(`  width: ${node.width}px;`);
  if (node.height) rules.push(`  height: ${node.height}px;`);
  if (node.type === "TEXT" && node.typography) {
    const t = node.typography;
    if (t.fontSize) rules.push(`  font-size: ${t.fontSize}px;`);
    if (t.fontFamily) rules.push(`  font-family: '${t.fontFamily}', sans-serif;`);
    if (t.fontWeight) rules.push(`  font-weight: ${t.fontWeight};`);
    if (t.textAlign && t.textAlign !== "LEFT") rules.push(`  text-align: ${t.textAlign.toLowerCase()};`);
    if (fill?.hex) rules.push(`  color: ${fill.hex};`);
    if (rules.find(r => r.includes("background-color"))) rules.splice(rules.findIndex(r => r.includes("background-color")), 1);
  }
  if (node.layout && node.layout.mode !== "NONE") {
    const l = node.layout;
    rules.push(`  display: flex;`);
    rules.push(`  flex-direction: ${l.mode === "HORIZONTAL" ? "row" : "column"};`);
    if (l.gap) rules.push(`  gap: ${l.gap}px;`);
    const pt = l.paddingTop ?? 0, pr = l.paddingRight ?? 0, pb = l.paddingBottom ?? 0, pl = l.paddingLeft ?? 0;
    if (pt || pr || pb || pl) rules.push(`  padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    const am: Record<string, string> = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between" };
    if (l.counterAxisAlign) rules.push(`  align-items: ${am[l.counterAxisAlign] ?? "flex-start"};`);
    if (l.primaryAxisAlign) rules.push(`  justify-content: ${am[l.primaryAxisAlign] ?? "flex-start"};`);
  }
  let css = `${sel} {\n${rules.join("\n")}\n}\n`;
  if (node.children) {
    for (const c of node.children) {
      css += "\n" + nodeToCSS(c, `${sel} .${(c.name || "el").replace(/\s+/g, "-").toLowerCase()}`);
    }
  }
  return css;
}

export function extractComputedStyles(nodes: SerializedNode[]): string {
  return nodes.map(n => nodeToCSS(n)).join("\n");
}

// ─── Code Connect file generator ─────────────────────────────────────────────

export function generateCodeConnect(options: {
  nodeId: string;
  nodeName: string;
  fileKey: string;
  componentName: string;
  sourcePath: string;
  framework: "React" | "Vue" | "Web Components";
  outputDir: string;
}): { filePath: string; code: string } {
  const { nodeId, nodeName, fileKey, componentName, sourcePath, framework, outputDir } = options;
  const figmaUrl = `https://www.figma.com/design/${fileKey}/?node-id=${nodeId.replace(":", "-")}`;

  const code = framework === "React" ? `import figma from '@figma/code-connect';
import { ${componentName} } from '${sourcePath}';

/**
 * FDIS Code Connect — ${nodeName}
 * Auto-generated by figma-mcp-ultimate
 * Figma node: ${nodeId}
 */
figma.connect(${componentName}, '${figmaUrl}', {
  props: {
    // Map Figma component properties to React props here.
    // Examples (uncomment and adapt):
    // variant: figma.enum('Variant', { primary: 'primary', secondary: 'secondary', ghost: 'ghost' }),
    // label: figma.string('Label'),
    // disabled: figma.boolean('Disabled'),
    // icon: figma.instance('Icon'),
    // children: figma.children('*'),
  },
  example: (/* { variant, label, disabled } */) => (
    <${componentName}
      // variant={variant}
      // disabled={disabled}
    />
  ),
});
` : `// Code Connect for ${framework} — ${componentName}\n// Figma node: ${nodeId}\n// TODO: Implement ${framework} Code Connect mapping\n`;

  const fileName = `${componentName}.figma.tsx`;
  const filePath = path.join(outputDir, fileName);
  return { filePath, code };
}

// ─── Node serializer code (Figma plugin → server) ─────────────────────────────

export const SERIALIZE_FOR_CODE_BRIDGE = `(async () => {
  function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
  function serialize(node,depth=0){
    if(depth>5)return null;
    const info={id:node.id,name:node.name,type:node.type,width:Math.round(node.width||0),height:Math.round(node.height||0),x:Math.round(node.x||0),y:Math.round(node.y||0)};
    if(node.fills?.length)info.fills=node.fills.slice(0,2).map(f=>f.type==='SOLID'?{type:'SOLID',hex:rgbToHex(f.color.r,f.color.g,f.color.b),isBound:!!node.boundVariables?.fills}:{type:f.type});
    if(node.strokes?.length)info.strokes=node.strokes.slice(0,1).map(s=>s.type==='SOLID'?{type:'SOLID',hex:rgbToHex(s.color.r,s.color.g,s.color.b),weight:node.strokeWeight}:{type:s.type});
    if(node.cornerRadius)info.cornerRadius=node.cornerRadius;
    if(node.opacity&&node.opacity!==1)info.opacity=node.opacity;
    if(node.type==='TEXT'){info.typography={fontSize:typeof node.fontSize==='number'?node.fontSize:undefined,fontFamily:node.fontName?.family,fontWeight:typeof node.fontWeight==='number'?node.fontWeight:undefined,textAlign:node.textAlignHorizontal,characters:node.characters?.slice(0,200)};}
    if(node.layoutMode&&node.layoutMode!=='NONE')info.layout={mode:node.layoutMode,gap:node.itemSpacing,paddingTop:node.paddingTop,paddingRight:node.paddingRight,paddingBottom:node.paddingBottom,paddingLeft:node.paddingLeft,primaryAxisAlign:node.primaryAxisAlignItems,counterAxisAlign:node.counterAxisAlignItems};
    if(node.children)info.children=node.children.map(c=>serialize(c,depth+1)).filter(Boolean);
    return info;
  }
  const sel=figma.currentPage.selection;
  if(!sel.length)return{error:'No selection'};
  return{nodes:sel.map(n=>serialize(n)),fileKey:figma.fileKey,file:figma.root.name,page:figma.currentPage.name};
})()`;
