/**
 * Theme Tools — apply_theme_context, validate_theme_integrity, render_multi_theme_preview
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildThemeSwitchCode, buildThemeValidationCode, buildMultiTenantPreviewCode } from "../engines/theme-runtime/index.js";

export function registerThemeTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  server.tool(
    "apply_theme_context",
    `Programmatically switch the brand/tenant theme on selected frames.
Sets an explicit variable collection mode — instantly changes all token-bound values to reflect the selected tenant.

**How it works:** Your Brand collection must have one mode per tenant (e.g., Monsooq / Getmo / DefaultBrand).
This tool sets that mode on the selected frames so you see how the design looks for each tenant.

Select frames before calling, or pass nodeIds explicitly.`,
    {
      tenant: z.string().describe("Tenant/mode name to switch to (must match a mode in your Brand collection)"),
      collectionName: z.string().optional().default("Brand").describe("Variable collection containing tenant modes"),
      nodeIds: z.array(z.string()).optional().default([]).describe("Node IDs to apply to (uses selection if empty)"),
    },
    async ({ tenant, collectionName, nodeIds }) => {
      try {
        const connector = await getDesktopConnector();
        const code = buildThemeSwitchCode(collectionName, tenant, nodeIds);
        const result = await connector.executeCodeViaUI(code, 10000);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, ...result.result }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  server.tool(
    "validate_theme_integrity",
    `Audit the selected frames for correct 3-layer token chain compliance.
Enforces: Theme/Primitives → Brand → Semantic

**What it catches:**
- Chain breaks: nodes bound directly to primitive/theme tokens (bypassing semantic layer)
- Brand-direct: nodes bound to brand tokens instead of semantic tokens
- Missing mode assignments
- Hardcoded values where tokens should be used

Provides a score (0–100) and A–F grade.`,
    {
      themeCollectionName: z.string().optional().default("Theme").describe("Primitive token collection name"),
      brandCollectionName: z.string().optional().default("Brand").describe("Brand alias collection name"),
      semanticCollectionName: z.string().optional().default("Semantic").describe("Semantic token collection name"),
    },
    async ({ themeCollectionName, brandCollectionName, semanticCollectionName }) => {
      try {
        const connector = await getDesktopConnector();
        const code = buildThemeValidationCode(themeCollectionName, brandCollectionName, semanticCollectionName);
        const result = await connector.executeCodeViaUI(code, 15000);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, validation: result.result }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  server.tool(
    "render_multi_theme_preview",
    `Render the selected component side-by-side in ALL tenant themes simultaneously.
Creates labeled duplicates — one per brand mode — arranged horizontally in a container frame.

**Example:** Select a Button → generates Button@Monsooq | Button@Getmo | Button@DefaultBrand side-by-side.

Select a Frame, Component, or Instance before calling.`,
    {
      collectionName: z.string().optional().default("Brand").describe("Variable collection with tenant modes"),
      gap: z.number().optional().default(40).describe("Gap between previews in pixels"),
      addLabels: z.boolean().optional().default(true).describe("Add tenant name label below each preview"),
    },
    async ({ collectionName, gap, addLabels }) => {
      try {
        const connector = await getDesktopConnector();
        const code = buildMultiTenantPreviewCode(collectionName, gap, addLabels);
        const result = await connector.executeCodeViaUI(code, 20000);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, ...result.result }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}


/**
 * Accessibility Tools — figma_audit_a11y, figma_simulate_colorblind, audit_design_system_usage
 */

export function registerA11yTools(
  server: McpServer,
  getDesktopConnector: () => Promise<any>
): void {

  server.tool(
    "figma_audit_a11y",
    `Full WCAG 2.1 AA accessibility audit of the selected frames.
Checks: contrast ratios, minimum font sizes, touch target sizes, interactive element labels.

**Severity levels:**
- error: WCAG AA violation (must fix)
- warning: Best practice violation (should fix)
- info: Enhancement opportunity`,
    {
      level: z.enum(["AA", "AAA"]).optional().default("AA"),
    },
    async ({ level }) => {
      try {
        const connector = await getDesktopConnector();
        const code = `(async () => {
          function rgbToLum(r,g,b){const[rs,gs,bs]=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*rs+0.7152*gs+0.0722*bs;}
          function contrastRatio(l1,l2){const[hi,lo]=[Math.max(l1,l2),Math.min(l1,l2)];return(hi+0.05)/(lo+0.05);}
          function hexToRgb(hex){const r=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);return r?[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)]:[0,0,0];}
          function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
          const issues=[];
          const minContrast=${level === "AAA" ? 7 : 4.5};
          const minLargeContrast=${level === "AAA" ? 4.5 : 3};
          function audit(node){
            if(node.type==='TEXT'){
              const fs=typeof node.fontSize==='number'?node.fontSize:14;
              if(fs<12){issues.push({category:'text',severity:'error',nodeId:node.id,nodeName:node.name,message:'Font size '+fs+'px is below 12px minimum',details:{fontSize:fs}});}
              if(fs>=12&&fs<14&&${level === "AAA"}){issues.push({category:'text',severity:'warning',nodeId:node.id,nodeName:node.name,message:'Font size '+fs+'px — AAA requires 14px+ for body text'});}
            }
            if(node.type==='FRAME'||node.type==='COMPONENT'||node.type==='INSTANCE'){
              if(node.reactions?.length>0){
                const w=node.width||0,h=node.height||0;
                if(w<44||h<44){issues.push({category:'touch',severity:'error',nodeId:node.id,nodeName:node.name,message:'Touch target '+Math.round(w)+'×'+Math.round(h)+'px — WCAG 2.5.5 requires 44×44px minimum',details:{width:w,height:h}});}
              }
            }
            if(node.fills?.some(f=>f.type==='SOLID')&&!node.boundVariables?.fills){
              const fill=node.fills.find(f=>f.type==='SOLID');
              if(fill&&fill.color){
                const fg=rgbToHex(fill.color.r,fill.color.g,fill.color.b);
                if(node.type==='TEXT'&&node.parent&&node.parent.fills?.some(f=>f.type==='SOLID')){
                  const bg=node.parent.fills.find(f=>f.type==='SOLID');
                  if(bg&&bg.color){
                    const fgRgb=hexToRgb(fg);const bgHex=rgbToHex(bg.color.r,bg.color.g,bg.color.b);const bgRgb=hexToRgb(bgHex);
                    const fgL=rgbToLum(fgRgb[0],fgRgb[1],fgRgb[2]);const bgL=rgbToLum(bgRgb[0],bgRgb[1],bgRgb[2]);
                    const ratio=contrastRatio(fgL,bgL);
                    const fs=typeof node.fontSize==='number'?node.fontSize:14;
                    const required=fs>=18||(fs>=14&&node.fontName?.style?.toLowerCase().includes('bold'))?minLargeContrast:minContrast;
                    if(ratio<required){issues.push({category:'contrast',severity:'error',nodeId:node.id,nodeName:node.name,message:'Contrast ratio '+ratio.toFixed(2)+':1 — WCAG requires '+required+':1 ('+level+')',details:{ratio:+ratio.toFixed(2),required,foreground:fg,background:bgHex}});}
                  }
                }
              }
            }
            if(node.children)node.children.forEach(audit);
          }
          const sel=figma.currentPage.selection;
          if(!sel.length)return{error:'No selection'};
          sel.forEach(audit);
          const errors=issues.filter(i=>i.severity==='error').length;
          const warnings=issues.filter(i=>i.severity==='warning').length;
          return{score:Math.max(0,100-(errors*15)-(warnings*5)),level:'${level}',summary:{errors,warnings,total:issues.length},issues:issues.slice(0,50)};
        })()`;

        const result = await connector.executeCodeViaUI(code, 20000);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, a11y: result.result }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  server.tool(
    "figma_simulate_colorblind",
    `Simulate color blindness by applying color transformations to selected frames.
Creates a copy showing how your design appears to users with color vision deficiency.

**Types:**
- protanopia: no red cone sensitivity (most common)
- deuteranopia: no green cone sensitivity
- tritanopia: no blue cone sensitivity
- achromatopsia: complete color blindness (grayscale)`,
    {
      type: z.enum(["protanopia", "deuteranopia", "tritanopia", "achromatopsia"]).default("protanopia"),
    },
    async ({ type }) => {
      try {
        const connector = await getDesktopConnector();
        // Daltonization matrices
        const matrices: Record<string, number[]> = {
          protanopia:   [0.567, 0.433, 0.000,  0.558, 0.442, 0.000,  0.000, 0.242, 0.758],
          deuteranopia: [0.625, 0.375, 0.000,  0.700, 0.300, 0.000,  0.000, 0.142, 0.858],
          tritanopia:   [0.950, 0.050, 0.000,  0.000, 0.433, 0.567,  0.000, 0.475, 0.525],
          achromatopsia:[0.299, 0.587, 0.114,  0.299, 0.587, 0.114,  0.299, 0.587, 0.114],
        };
        const m = matrices[type];
        const code = `(async()=>{
          const sel=figma.currentPage.selection;
          if(!sel.length)return{error:'No selection'};
          const source=sel[0];
          const clone=source.clone();
          clone.name=source.name+' [${type}]';
          clone.x=source.x+source.width+40;
          function transform(r,g,b){return[r*${m[0]}+g*${m[1]}+b*${m[2]},r*${m[3]}+g*${m[4]}+b*${m[5]},r*${m[6]}+g*${m[7]}+b*${m[8]}].map(v=>Math.max(0,Math.min(1,v)));}
          function applyToNode(node){
            if(node.fills?.length&&!node.boundVariables?.fills){
              node.fills=node.fills.map(f=>{if(f.type!=='SOLID')return f;const[r,g,b]=transform(f.color.r,f.color.g,f.color.b);return{...f,color:{r,g,b}};});
            }
            if(node.strokes?.length&&!node.boundVariables?.strokes){
              node.strokes=node.strokes.map(s=>{if(s.type!=='SOLID')return s;const[r,g,b]=transform(s.color.r,s.color.g,s.color.b);return{...s,color:{r,g,b}};});
            }
            if(node.children)node.children.forEach(applyToNode);
          }
          applyToNode(clone);
          figma.viewport.scrollAndZoomIntoView([clone]);
          return{success:true,type:'${type}',cloneId:clone.id,cloneName:clone.name};
        })()`;
        const result = await connector.executeCodeViaUI(code, 20000);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, ...result.result }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  server.tool(
    "audit_design_system_usage",
    `Audit the current Figma page for design system health.
Reports: unused local components, detached instances, missing main components, instance count.`,
    {},
    async () => {
      try {
        const connector = await getDesktopConnector();
        const code = `(async()=>{
          const page=figma.currentPage;
          const issues=[];
          const allComps=page.findAll(n=>n.type==='COMPONENT');
          const allInsts=page.findAll(n=>n.type==='INSTANCE');
          const usedKeys=new Set();
          for(const inst of allInsts){try{const m=await inst.getMainComponentAsync();if(m)usedKeys.add(m.key);}catch{}}
          for(const comp of allComps){
            if(!usedKeys.has(comp.key))issues.push({type:'unused-component',id:comp.id,name:comp.name});
          }
          const detached=page.findAll(n=>n.type==='FRAME'&&n.name.includes('(Detached)'));
          detached.forEach(n=>issues.push({type:'detached-instance',id:n.id,name:n.name}));
          const missingMain=[];
          for(const inst of allInsts){try{const m=await inst.getMainComponentAsync();if(!m)missingMain.push({id:inst.id,name:inst.name});}catch(e){missingMain.push({id:inst.id,name:inst.name,error:e.message});}}
          missingMain.forEach(n=>issues.push({type:'missing-main-component',...n}));
          return{
            stats:{totalComponents:allComps.length,totalInstances:allInsts.length,unusedComponents:allComps.length-usedKeys.size,detachedInstances:detached.length,missingMainComponents:missingMain.length},
            issues:issues.slice(0,50),
          };
        })()`;
        const result = await connector.executeCodeViaUI(code, 30000);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: result.success, audit: result.result }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}


/**
 * Knowledge Tools — lookup_design_guidance, ingest_design_reference
 */

import { search, ingestEntry, buildTextEntry, loadEntries, getManifest } from "../engines/knowledge/index.js";

export function registerKnowledgeTools(server: McpServer): void {

  server.tool(
    "lookup_design_guidance",
    `Search the local design systems knowledge base for guidance on any design topic.
Includes the Design Systems Handbook (DesignBetter.Co) and any books/articles you've added.

**Example queries:**
- "how to structure a 3-layer token architecture"
- "when to use semantic tokens vs primitives"
- "component naming conventions"
- "design system governance and adoption"
- "scaling design systems across teams"
- "accessibility in design systems"`,
    {
      query: z.string().min(3).describe("What you want to learn about design systems"),
      category: z.string().optional().describe("Filter by category: architecture, components, tokens, a11y, process"),
      limit: z.number().optional().default(3).describe("Number of results to return (1-10)"),
      useRemote: z.boolean().optional().default(true).describe("Also search design-systems-mcp remote knowledge base"),
    },
    async ({ query, category, limit, useRemote }) => {
      try {
        const results = await search(query, { category, limit, useRemote });

        if (!results.length) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                message: `No results for "${query}". Try broader terms or add content with ingest_design_reference.`,
                availableSources: getManifest()?.sources?.map((s: any) => s.name) ?? [],
              }),
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              query, count: results.length,
              results: results.map(r => ({
                title: r.entry.title,
                source: r.sourceLabel,
                authority: r.authorityLevel,
                relevanceScore: r.score,
                content: r.chunk.text,
                section: r.chunk.metadata?.section,
                pageRange: r.chunk.metadata?.pageRange,
                tags: r.entry.metadata.tags,
              })),
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );

  server.tool(
    "ingest_design_reference",
    `Add a new design reference to the local knowledge base.
Accepts text content directly (articles, guidelines, internal documentation).

For PDFs: \`python3 local-content-library/scripts/ingest-pdf.py your-book.pdf\`

Content is chunked into searchable segments and indexed immediately.`,
    {
      title: z.string().describe("Title of the reference"),
      content: z.string().min(50).describe("Full text content to add"),
      source: z.string().optional().describe("URL or identifier for the source"),
      category: z.enum(["architecture", "components", "tokens", "a11y", "process", "tools"]).optional().default("architecture"),
      tags: z.array(z.string()).optional().default([]),
      system: z.string().optional().describe("Design system or company name this references"),
    },
    async ({ title, content, source, category, tags, system }) => {
      try {
        const entry = buildTextEntry({ title, content, source, category, tags, system });
        ingestEntry(entry);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true, id: entry.id, title,
              chunks: entry.chunks.length,
              message: `"${title}" added to knowledge base with ${entry.chunks.length} searchable chunks`,
            }),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }], isError: true };
      }
    }
  );
}
