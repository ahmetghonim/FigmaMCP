/**
 * Component Synthesis Engine — Figma Code Generator
 * Converts a parsed JSX tree into executable Figma Plugin API JavaScript.
 * Handles: variable binding (var:token), icon SVG injection, auto-layout,
 * smart canvas positioning, font caching.
 */

import type { SynthesisElement } from "./types.js";

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgbCode(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h;
  const r = (parseInt(full.slice(0, 2), 16) / 255).toFixed(3);
  const g = (parseInt(full.slice(2, 4), 16) / 255).toFixed(3);
  const b = (parseInt(full.slice(4, 6), 16) / 255).toFixed(3);
  return `{r:${r},g:${g},b:${b}}`;
}

function isVarRef(v: any): v is string {
  return typeof v === "string" && v.startsWith("var:");
}

function genFill(val: string, nodeVar: string, prop = "fills"): string {
  if (isVarRef(val)) {
    return `if(vars[${JSON.stringify(val.slice(4))}])${nodeVar}.${prop}=[boundFill(vars[${JSON.stringify(val.slice(4))}])];`;
  }
  return `${nodeVar}.${prop}=[{type:'SOLID',color:${hexToRgbCode(val)}}];`;
}

function genStroke(val: string, nodeVar: string, weight = 1): string {
  if (isVarRef(val)) {
    return `if(vars[${JSON.stringify(val.slice(4))}])${nodeVar}.strokes=[boundFill(vars[${JSON.stringify(val.slice(4))}])];${nodeVar}.strokeWeight=${weight};`;
  }
  return `${nodeVar}.strokes=[{type:'SOLID',color:${hexToRgbCode(val)}}];${nodeVar}.strokeWeight=${weight};`;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

const ALIGN_MAP: Record<string, string> = {
  start: "MIN", center: "CENTER", end: "MAX", stretch: "STRETCH",
  "space-between": "SPACE_BETWEEN",
};

// ─── Font collection ──────────────────────────────────────────────────────────

function collectFonts(items: SynthesisElement[], fonts: Set<string>): void {
  for (const item of items) {
    if (item._type === "text") {
      const w = (item as any).weight ?? "regular";
      fonts.add(w === "bold" ? "Bold" : w === "medium" ? "Medium" : w === "semibold" ? "Semi Bold" : "Regular");
    }
    if (item._type === "frame" && (item as any)._children) {
      collectFonts((item as any)._children, fonts);
    }
  }
}

// ─── Variable usage check ─────────────────────────────────────────────────────

function hasVarRef(items: SynthesisElement[]): boolean {
  for (const item of items) {
    const i = item as any;
    if ([i.bg, i.fill, i.stroke, i.color, i.c].some(v => isVarRef(v))) return true;
    if (i._type === "frame" && i._children && hasVarRef(i._children)) return true;
  }
  return false;
}

// ─── Child code generator ─────────────────────────────────────────────────────

let _counter = 0;

function genChildren(items: SynthesisElement[], parentVar: string, parentFlex: string, iconSvgMap: Record<string, string>): string {
  return items.map(item => {
    const idx = _counter++;
    const ev = `el${idx}`;
    const i = item as any;

    if (i._type === "text") {
      const w = i.weight ?? "regular";
      const style = w === "bold" ? "Bold" : w === "medium" ? "Medium" : w === "semibold" ? "Semi Bold" : "Regular";
      const col = i.color ?? "#000000";
      const fw = i.w === "fill";
      return `
        const ${ev}=figma.createText();
        ${ev}.fontName={family:'Inter',style:'${style}'};
        ${ev}.fontSize=${i.size ?? 14};
        ${ev}.characters=${JSON.stringify(i.content ?? "")};
        ${genFill(col, ev)}
        ${parentVar}.appendChild(${ev});
        ${fw ? `${ev}.layoutSizingHorizontal='FILL';${ev}.textAutoResize='HEIGHT';` : ""}`.trim();
    }

    if (i._type === "frame") {
      const fBg = i.bg ?? i.fill;
      const fStroke = i.stroke;
      const fRounded = i.rounded ?? i.radius ?? 0;
      const fFlex = i.flex ?? "row";
      const fGap = i.gap ?? 0;
      const fP = i.p ?? 0;
      const fPx = i.px ?? fP; const fPy = i.py ?? fP;
      const fPt = i.pt ?? fPy; const fPr = i.pr ?? fPx;
      const fPb = i.pb ?? fPy; const fPl = i.pl ?? fPx;
      const fJustify = ALIGN_MAP[i.justify ?? "start"] ?? "MIN";
      const fAlign = ALIGN_MAP[i.items ?? i.align ?? "start"] ?? "MIN";
      const fClip = i.clip === true || i.clip === "true" || i.overflow === "hidden";
      const fW = i.w; const fH = i.h ?? i.height;
      const fillW = fW === "fill"; const fillH = fH === "fill";
      const hasW = fW !== undefined && !fillW; const hasH = fH !== undefined && !fillH;
      const numW = hasW ? (i.w ?? i.width ?? 100) : 100;
      const numH = hasH ? (i.h ?? i.height ?? 40) : 40;
      const hSizing = fillW ? "FILL" : hasW ? "FIXED" : "HUG";
      const vSizing = fillH ? "FILL" : hasH ? "FIXED" : "HUG";
      const fAbsX = i.x ?? 0; const fAbsY = i.y ?? 0;
      const isAbsolute = i.position === "absolute";
      const nested = i._children ? genChildren(i._children, ev, fFlex, iconSvgMap) : "";

      return `
        const ${ev}=figma.createFrame();
        ${ev}.name=${JSON.stringify(i.name ?? "Frame")};
        ${ev}.layoutMode='${fFlex === "row" ? "HORIZONTAL" : "VERTICAL"}';
        ${hasW || hasH ? `${ev}.resize(${numW},${numH});` : ""}
        ${ev}.itemSpacing=${fGap};
        ${ev}.paddingTop=${fPt};${ev}.paddingBottom=${fPb};
        ${ev}.paddingLeft=${fPl};${ev}.paddingRight=${fPr};
        ${ev}.cornerRadius=${fRounded};
        ${fBg ? genFill(fBg, ev) : `${ev}.fills=[];`}
        ${fStroke ? genStroke(fStroke, ev) : ""}
        ${ev}.primaryAxisAlignItems='${fJustify}';
        ${ev}.counterAxisAlignItems='${fAlign}';
        ${ev}.clipsContent=${fClip};
        ${parentVar}.appendChild(${ev});
        ${ev}.layoutSizingHorizontal='${hSizing}';
        ${ev}.layoutSizingVertical='${vSizing}';
        ${isAbsolute ? `${ev}.layoutPositioning='ABSOLUTE';${ev}.x=${fAbsX};${ev}.y=${fAbsY};` : ""}
        ${nested}`.trim();
    }

    if (i._type === "rect") {
      const rBg = i.bg ?? i.fill ?? "#e4e4e7";
      return `
        const ${ev}=figma.createRectangle();
        ${ev}.name=${JSON.stringify(i.name ?? "Rectangle")};
        ${ev}.resize(${i.w ?? i.width ?? 100},${i.h ?? i.height ?? 100});
        ${ev}.cornerRadius=${i.rounded ?? i.radius ?? 0};
        ${genFill(rBg, ev)}
        ${parentVar}.appendChild(${ev});`.trim();
    }

    if (i._type === "image") {
      return `
        const ${ev}=figma.createRectangle();
        ${ev}.name=${JSON.stringify(i.name ?? "Image")};
        ${ev}.resize(${i.w ?? i.width ?? 200},${i.h ?? i.height ?? 150});
        ${ev}.cornerRadius=${i.rounded ?? 8};
        ${ev}.fills=[{type:'SOLID',color:{r:0.95,g:0.95,b:0.96}}];
        ${parentVar}.appendChild(${ev});`.trim();
    }

    if (i._type === "icon") {
      const icSize = i.size ?? i.s ?? 24;
      const icCol = i.color ?? i.c ?? "#71717a";
      const svgData = iconSvgMap[i.name];
      if (svgData) {
        const colorize = !isVarRef(icCol)
          ? `function cz${idx}(n){if(n.fills?.length)n.fills=[{type:'SOLID',color:${hexToRgbCode(icCol)}}];if(n.children)n.children.forEach(cz${idx});}if(${ev}.children)${ev}.children.forEach(cz${idx});`
          : "";
        return `
          const ${ev}=figma.createNodeFromSvg(${JSON.stringify(svgData)});
          ${ev}.name=${JSON.stringify(i.name)};
          ${ev}.fills=[];
          ${ev}.resize(${icSize},${icSize});
          ${colorize}
          ${parentVar}.appendChild(${ev});`.trim();
      }
      // Fallback placeholder
      return `
        const ${ev}=figma.createRectangle();
        ${ev}.name=${JSON.stringify(i.name ?? "Icon")};
        ${ev}.resize(${icSize},${icSize});
        ${ev}.cornerRadius=${Math.round(Number(icSize) / 4)};
        ${genFill(icCol, ev)}
        ${parentVar}.appendChild(${ev});`.trim();
    }

    return "";
  }).filter(Boolean).join("\n");
}

// ─── Root code generator ──────────────────────────────────────────────────────

export function generateFigmaCode(
  props: Record<string, any>,
  children: SynthesisElement[],
  iconSvgMap: Record<string, string>
): string {
  _counter = 0; // Reset per call

  const name = props.name ?? "Frame";
  const rawW = props.w ?? props.width;
  const rawH = props.h ?? props.height;
  const hasW = rawW !== undefined;
  const hasH = rawH !== undefined;
  const fillW = rawW === "fill"; const fillH = rawH === "fill";
  const width = fillW ? 320 : (rawW ?? 320);
  const height = fillH ? 200 : (rawH ?? 200);
  const bg = props.bg ?? props.fill ?? "#ffffff";
  const stroke = props.stroke;
  const strokeWeight = props.strokeWidth ?? 1;
  const rounded = props.rounded ?? props.radius ?? 0;
  const flex = props.flex ?? "col";
  const gap = props.gap ?? 0;
  const p = props.p ?? 0;
  const px = props.px ?? p; const py = props.py ?? p;
  const align = ALIGN_MAP[props.items ?? props.align ?? "start"] ?? "MIN";
  const justify = ALIGN_MAP[props.justify ?? "start"] ?? "MIN";
  const clip = props.clip === true || props.clip === "true" || props.overflow === "hidden";
  const hugW = ["both", "w", "width"].includes(props.hug ?? "");
  const hugH = ["both", "h", "height"].includes(props.hug ?? "");
  const wrap = props.wrap === true || props.wrap === "true";
  const wrapGap = Number(props.wrapGap ?? 0);
  const useSmartPos = props.x === undefined;
  const explicitX = props.x ?? 0;
  const y = props.y ?? 0;

  // Collect fonts
  const fonts = new Set<string>(["Regular"]);
  collectFonts(children, fonts);
  const fontStyles = [...fonts];

  // Check var refs
  const usesVars = isVarRef(bg) || (stroke ? isVarRef(stroke) : false) || hasVarRef(children);

  const fontLoad = `
    if(!globalThis.__fdis_fonts)globalThis.__fdis_fonts=new Set();
    const _fontsNeeded=${JSON.stringify(fontStyles)}.filter(s=>!globalThis.__fdis_fonts.has(s));
    if(_fontsNeeded.length)await Promise.all(_fontsNeeded.map(s=>figma.loadFontAsync({family:'Inter',style:s})));
    _fontsNeeded.forEach(s=>globalThis.__fdis_fonts.add(s));`;

  const varLoad = usesVars ? `
    if(!globalThis.__fdis_vars||Date.now()-(globalThis.__fdis_vars_t||0)>30000){
      const _cols=await figma.variables.getLocalVariableCollectionsAsync();
      globalThis.__fdis_vars={};
      for(const col of _cols){
        for(const id of col.variableIds){
          const v=await figma.variables.getVariableByIdAsync(id);
          if(v)globalThis.__fdis_vars[v.name]=v;
        }
      }
      globalThis.__fdis_vars_t=Date.now();
    }
    const vars=globalThis.__fdis_vars;
    const boundFill=(variable)=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:.5,g:.5,b:.5}},'color',variable);` : "";

  const smartPos = useSmartPos
    ? `let smartX=0;figma.currentPage.children.forEach(n=>{smartX=Math.max(smartX,n.x+(n.width||0));});smartX=Math.round(smartX+100);`
    : `const smartX=${explicitX};`;

  const hMode = flex === "col"
    ? (hugW || fillW || !hasW ? "AUTO" : "FIXED")
    : (hugH || fillH || !hasH ? "AUTO" : "FIXED"); // counterAxis

  const primaryMode = flex === "col"
    ? (hugH || fillH || !hasH ? "AUTO" : "FIXED")
    : (hugW || fillW || !hasW ? "AUTO" : "FIXED");

  const childCode = genChildren(children, "frame", flex, iconSvgMap);

  return `(async function __fdis_synth(){
    ${fontLoad}
    ${varLoad}
    ${smartPos}
    let __node='root';
    try{
      const frame=figma.createFrame();
      frame.name=${JSON.stringify(name)};
      frame.resize(${width},${height});
      frame.x=smartX;frame.y=${y};
      frame.cornerRadius=${rounded};
      ${genFill(bg, "frame")}
      ${stroke ? genStroke(stroke, "frame", strokeWeight) : ""}
      frame.layoutMode='${flex === "row" ? "HORIZONTAL" : "VERTICAL"}';
      ${wrap && flex === "row" ? "frame.layoutWrap='WRAP';" : ""}
      frame.itemSpacing=${gap};
      frame.paddingTop=${py};frame.paddingBottom=${py};
      frame.paddingLeft=${px};frame.paddingRight=${px};
      frame.primaryAxisAlignItems='${justify}';
      frame.counterAxisAlignItems='${align}';
      frame.primaryAxisSizingMode='${primaryMode}';
      frame.counterAxisSizingMode='${hMode}';
      ${wrap && wrapGap > 0 ? `frame.counterAxisSpacing=${wrapGap};` : ""}
      frame.clipsContent=${clip};
      ${childCode}
      figma.currentPage.selection=[frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
      return{id:frame.id,name:frame.name,width:frame.width,height:frame.height};
    }catch(e){throw new Error('[FDIS Synthesis]['+__node+']: '+e.message);}
  })()`;
}
