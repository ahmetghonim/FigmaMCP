/**
 * Token Orchestration Engine — Sync / Diff / Migration
 * Bi-directional sync between Figma variables and tokens.json
 */

import * as fs from "fs";
import * as path from "path";

// ─── Token data structures ────────────────────────────────────────────────────

export interface TokenValue {
  $value: string | number;
  $type: "color" | "number" | "string" | "boolean";
  $modes?: Record<string, string | number>;
}

export type TokenTree = Record<string, TokenValue | Record<string, any>>;

export interface TokenSyncResult {
  direction: "pull" | "push" | "diff";
  collections?: string[];
  created?: number;
  updated?: number;
  errors?: string[];
  diff?: TokenDiff;
}

export interface TokenDiff {
  added: string[];
  removed: string[];
  changed: Array<{ token: string; before: any; after: any }>;
  summary: { added: number; removed: number; changed: number; total: number };
}

// ─── Figma plugin code: export all variables ──────────────────────────────────

export function buildExportVariablesCode(collectionFilter?: string): string {
  return `(async () => {
    function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    const result={};
    for(const col of cols){
      ${collectionFilter ? `if(!col.name.startsWith(${JSON.stringify(collectionFilter)}))continue;` : ""}
      const colTokens={};
      for(const id of col.variableIds){
        const v=await figma.variables.getVariableByIdAsync(id);
        if(!v)continue;
        const parts=v.name.split('/');
        let target=colTokens;
        for(let i=0;i<parts.length-1;i++){if(!target[parts[i]])target[parts[i]]={};target=target[parts[i]];}
        const leaf=parts[parts.length-1];
        const modeVals={};
        for(const mode of col.modes){
          const val=v.valuesByMode[mode.modeId];
          if(val===undefined)continue;
          if(v.resolvedType==='COLOR'&&typeof val==='object'&&'r' in val){
            modeVals[mode.name]=rgbToHex(val.r,val.g,val.b);
          }else if(val&&typeof val==='object'&&val.type==='VARIABLE_ALIAS'){
            const refVar=await figma.variables.getVariableByIdAsync(val.id);
            modeVals[mode.name]={$alias:refVar?.name??val.id};
          }else{
            modeVals[mode.name]=val;
          }
        }
        const type=v.resolvedType.toLowerCase();
        if(col.modes.length===1){
          target[leaf]={$value:modeVals[col.modes[0].name],$type:type};
        }else{
          target[leaf]={$value:modeVals[col.modes[0].name],$type:type,$modes:modeVals};
        }
      }
      result[col.name]=colTokens;
    }
    return result;
  })()`;
}

// ─── Figma plugin code: import tokens ─────────────────────────────────────────

export function buildImportTokensCode(tokens: Record<string, TokenTree>): string {
  return `(async () => {
    function hexToRgb(hex){const e=hex.replace('#','');const f=e.length===3?e[0]+e[0]+e[1]+e[1]+e[2]+e[2]:e;return{r:parseInt(f.slice(0,2),16)/255,g:parseInt(f.slice(2,4),16)/255,b:parseInt(f.slice(4,6),16)/255};}
    function flatten(obj,prefix=''){
      const out=[];
      for(const[k,v] of Object.entries(obj)){
        const name=prefix?prefix+'/'+k:k;
        if(v&&typeof v==='object'&&!('$value' in v)&&!('$type' in v)){out.push(...flatten(v,name));}
        else{const val=v.$value??v;const type=(v.$type||'color').toUpperCase();out.push({name,val,type});}
      }
      return out;
    }
    const data=${JSON.stringify(tokens)};
    let created=0,errors=[];
    for(const[colName,colData] of Object.entries(data)){
      try{
        const cols=await figma.variables.getLocalVariableCollectionsAsync();
        let col=cols.find(c=>c.name===colName);
        if(!col)col=figma.variables.createVariableCollection(colName);
        const modeId=col.modes[0].modeId;
        const existing=await figma.variables.getLocalVariablesAsync();
        for(const{name,val,type} of flatten(colData)){
          const found=existing.find(v=>v.name===name&&v.variableCollectionId===col.id);
          if(!found){
            const figmaType=type==='COLOR'?'COLOR':type==='FLOAT'||type==='NUMBER'?'FLOAT':type==='BOOLEAN'?'BOOLEAN':'STRING';
            const v=figma.variables.createVariable(name,col,figmaType);
            let fv=val;
            if(figmaType==='COLOR'&&typeof val==='string')fv=hexToRgb(val);
            if(fv!==null&&fv!==undefined){v.setValueForMode(modeId,fv);created++;}
          }
        }
      }catch(e){errors.push(colName+': '+e.message);}
    }
    return{created,errors};
  })()`;
}

// ─── Figma plugin code: migrate token names ────────────────────────────────────

export function buildMigrateTokensCode(
  migrations: Array<{ from: string; to: string }>,
  dryRun: boolean
): string {
  return `(async () => {
    const migrations=${JSON.stringify(migrations)};
    const dryRun=${dryRun};
    const vars=await figma.variables.getLocalVariablesAsync();
    const changes=[];
    for(const v of vars){
      for(const{from,to} of migrations){
        const matchExact=v.name===from;
        const matchPartial=from.endsWith('*')&&v.name.startsWith(from.slice(0,-1));
        if(matchExact||matchPartial){
          const newName=matchExact?to:to+v.name.slice(from.length-1);
          changes.push({id:v.id,oldName:v.name,newName,collection:v.variableCollectionId});
          if(!dryRun)v.setName(newName);
          break;
        }
      }
    }
    return{dryRun,changes,count:changes.length};
  })()`;
}

// ─── Diff engine (runs server-side) ───────────────────────────────────────────

export function diffTokenTrees(before: Record<string, any>, after: Record<string, any>): TokenDiff {
  const flatBefore = flattenTree(before);
  const flatAfter = flattenTree(after);

  const added = Object.keys(flatAfter).filter(k => !(k in flatBefore));
  const removed = Object.keys(flatBefore).filter(k => !(k in flatAfter));
  const changed = Object.keys(flatAfter)
    .filter(k => k in flatBefore)
    .filter(k => JSON.stringify(flatBefore[k]) !== JSON.stringify(flatAfter[k]))
    .map(k => ({ token: k, before: flatBefore[k], after: flatAfter[k] }));

  return {
    added, removed, changed,
    summary: { added: added.length, removed: removed.length, changed: changed.length, total: Object.keys(flatAfter).length },
  };
}

function flattenTree(obj: Record<string, any>, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}/${k}` : k;
    if (v && typeof v === "object" && !("$value" in v) && !("$type" in v)) {
      Object.assign(result, flattenTree(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

// ─── Token adoption metrics code ──────────────────────────────────────────────

export const MEASURE_ADOPTION_CODE = `(async () => {
  let fills={total:0,bound:0},strokes={total:0,bound:0},radius={total:0,bound:0},
      gaps={total:0,bound:0},padding={total:0,bound:0},typography={total:0,bound:0};
  function scan(node){
    if(node.fills?.some(f=>f.type==='SOLID')){fills.total++;if(node.boundVariables?.fills)fills.bound++;}
    if(node.strokes?.some(s=>s.type==='SOLID')){strokes.total++;if(node.boundVariables?.strokes)strokes.bound++;}
    if(typeof node.cornerRadius==='number'&&node.cornerRadius>0){radius.total++;if(node.boundVariables?.cornerRadius)radius.bound++;}
    if(node.itemSpacing>0){gaps.total++;if(node.boundVariables?.itemSpacing)gaps.bound++;}
    if(node.paddingLeft>0||node.paddingTop>0){padding.total++;if(node.boundVariables?.paddingLeft||node.boundVariables?.paddingTop)padding.bound++;}
    if(node.type==='TEXT'){typography.total++;if(node.boundVariables?.fontSize||node.boundVariables?.fills)typography.bound++;}
    if(node.children)node.children.forEach(scan);
  }
  figma.currentPage.children.forEach(scan);
  const pct=(b,t)=>t===0?100:Math.round(b/t*100);
  const overall=Math.round(([fills,strokes,radius,gaps].reduce((s,x)=>s+x.bound,0)/Math.max(1,[fills,strokes,radius,gaps].reduce((s,x)=>s+x.total,0)))*100);
  return{
    overall,
    grade:overall>=90?'A':overall>=75?'B':overall>=60?'C':overall>=45?'D':'F',
    breakdown:{
      fills:{...fills,coverage:pct(fills.bound,fills.total)},
      strokes:{...strokes,coverage:pct(strokes.bound,strokes.total)},
      cornerRadius:{...radius,coverage:pct(radius.bound,radius.total)},
      gaps:{...gaps,coverage:pct(gaps.bound,gaps.total)},
      padding:{...padding,coverage:pct(padding.bound,padding.total)},
      typography:{...typography,coverage:pct(typography.bound,typography.total)},
    },
  };
})()`;
