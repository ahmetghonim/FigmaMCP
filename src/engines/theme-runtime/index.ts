/**
 * Theme Runtime Engine
 * Multi-tenant brand token management for Mondia Group architecture.
 *
 * 3-layer contract: Theme/Primitives → Brand (per tenant) → Semantic
 *
 * - ThemeSwitcher    — swap brand mode on frames
 * - ThemeValidator   — audit 3-layer chain integrity
 * - ThemePreviewer   — render component in all tenant themes side-by-side
 */

// ─── Figma plugin code: switch theme mode ─────────────────────────────────────

export function buildThemeSwitchCode(
  collectionName: string,
  modeName: string,
  nodeIds: string[]
): string {
  return `(async () => {
    const colName=${JSON.stringify(collectionName)};
    const targetMode=${JSON.stringify(modeName)};
    const nodeIds=${JSON.stringify(nodeIds)};
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    const col=cols.find(c=>c.name.toLowerCase().includes(colName.toLowerCase()));
    if(!col)return{error:'Collection "'+colName+'" not found. Available: '+cols.map(c=>c.name).join(', ')};
    const mode=col.modes.find(m=>m.name.toLowerCase()===targetMode.toLowerCase()||m.name.toLowerCase().includes(targetMode.toLowerCase()));
    if(!mode)return{error:'Mode "'+targetMode+'" not found in "'+col.name+'". Available: '+col.modes.map(m=>m.name).join(', ')};
    let nodes=[];
    if(nodeIds.length>0){
      for(const id of nodeIds){const n=await figma.getNodeByIdAsync(id);if(n)nodes.push(n);}
    }else{
      nodes=figma.currentPage.selection.filter(n=>['FRAME','COMPONENT','INSTANCE','SECTION'].includes(n.type));
    }
    if(!nodes.length)return{error:'No frames selected. Select frames to apply theme to.'};
    for(const n of nodes)n.setExplicitVariableModeForCollection(col,mode.modeId);
    return{success:true,tenant:mode.name,collection:col.name,appliedTo:nodes.length,nodeNames:nodes.map(n=>n.name)};
  })()`;
}

// ─── Figma plugin code: validate 3-layer token chain ─────────────────────────

export function buildThemeValidationCode(
  themeColName: string,
  brandColName: string,
  semanticColName: string
): string {
  return `(async () => {
    const [themeName,brandName,semName]=${JSON.stringify([themeColName, brandColName, semanticColName])};
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    const themeCol=cols.find(c=>c.name.toLowerCase().includes(themeName.toLowerCase()));
    const brandCol=cols.find(c=>c.name.toLowerCase().includes(brandName.toLowerCase()));
    const semCol=cols.find(c=>c.name.toLowerCase().includes(semName.toLowerCase()));
    const allVars=await figma.variables.getLocalVariablesAsync();
    const themeIds=new Set(themeCol?.variableIds??[]);
    const brandIds=new Set(brandCol?.variableIds??[]);
    const semIds=new Set(semCol?.variableIds??[]);
    const issues=[],warnings=[];
    let correct=0;
    function audit(node){
      if(!node.boundVariables){if(node.children)node.children.forEach(audit);return;}
      for(const[prop,binding] of Object.entries(node.boundVariables)){
        const b=Array.isArray(binding)?binding[0]:binding;
        if(!b?.id)continue;
        const vid=b.id;
        if(themeIds.has(vid)){
          const v=allVars.find(x=>x.id===vid);
          issues.push({type:'chain-break',severity:'critical',nodeId:node.id,nodeName:node.name,property:prop,variable:v?.name,message:'Bound directly to primitive/theme layer — use Semantic tokens instead'});
        }else if(brandIds.has(vid)){
          const v=allVars.find(x=>x.id===vid);
          warnings.push({type:'brand-direct',severity:'warning',nodeId:node.id,nodeName:node.name,property:prop,variable:v?.name,message:'Bound to Brand layer — prefer Semantic layer if available'});
        }else if(semIds.has(vid)){correct++;}
      }
      if(node.children)node.children.forEach(audit);
    }
    const sel=figma.currentPage.selection;
    if(!sel.length)return{error:'No selection'};
    sel.forEach(audit);
    const total=correct+issues.length+warnings.length;
    const score=Math.max(0,100-(issues.length*20)-(warnings.length*5));
    return{
      score,grade:score>=90?'A':score>=75?'B':score>=60?'C':'D',
      summary:{correct,critical:issues.length,warnings:warnings.length,total},
      issues:[...issues,...warnings].slice(0,50),
      collections:{theme:themeCol?.name??'not found',brand:brandCol?.name??'not found',semantic:semCol?.name??'not found'},
    };
  })()`;
}

// ─── Figma plugin code: multi-tenant side-by-side preview ────────────────────

export function buildMultiTenantPreviewCode(
  collectionName: string,
  gap: number,
  addLabels: boolean
): string {
  return `(async () => {
    const colName=${JSON.stringify(collectionName)};
    const gapPx=${gap};
    const addLabels=${addLabels};
    await figma.loadFontAsync({family:'Inter',style:'Regular'});
    await figma.loadFontAsync({family:'Inter',style:'Medium'});
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    const brandCol=cols.find(c=>c.name.toLowerCase().includes(colName.toLowerCase()));
    if(!brandCol)return{error:'Collection "'+colName+'" not found'};
    const sel=figma.currentPage.selection;
    if(!sel.length)return{error:'Select a frame to preview across tenants'};
    const source=sel[0];
    if(!['FRAME','COMPONENT','INSTANCE'].includes(source.type))return{error:'Select a Frame, Component, or Instance'};
    const container=figma.createFrame();
    container.name=source.name+' — Multi-Tenant Preview';
    container.fills=[{type:'SOLID',color:{r:0.97,g:0.97,b:0.97}}];
    container.layoutMode='HORIZONTAL';
    container.primaryAxisSizingMode='AUTO';
    container.counterAxisSizingMode='AUTO';
    container.itemSpacing=gapPx;
    container.paddingTop=32;container.paddingBottom=32;
    container.paddingLeft=32;container.paddingRight=32;
    container.cornerRadius=16;
    container.x=source.x+source.width+80;container.y=source.y;
    const previews=[];
    for(const mode of brandCol.modes){
      const wrapper=figma.createFrame();
      wrapper.name=mode.name;wrapper.fills=[];
      wrapper.layoutMode='VERTICAL';wrapper.primaryAxisSizingMode='AUTO';
      wrapper.counterAxisSizingMode='AUTO';wrapper.itemSpacing=12;
      wrapper.counterAxisAlignItems='CENTER';
      const clone=source.clone();
      clone.name=source.name+' @ '+mode.name;
      clone.setExplicitVariableModeForCollection(brandCol,mode.modeId);
      wrapper.appendChild(clone);
      if(addLabels){
        const label=figma.createText();
        label.characters=mode.name;label.fontSize=13;
        label.fontName={family:'Inter',style:'Medium'};
        label.fills=[{type:'SOLID',color:{r:0.45,g:0.45,b:0.45}}];
        wrapper.appendChild(label);
      }
      container.appendChild(wrapper);
      previews.push({tenant:mode.name,nodeId:clone.id});
    }
    figma.viewport.scrollAndZoomIntoView([container]);
    return{success:true,tenants:brandCol.modes.map(m=>m.name),containerId:container.id,previews};
  })()`;
}

// ─── Index exports ────────────────────────────────────────────────────────────

export { buildThemeSwitchCode as themeSwitchCode };
export { buildThemeValidationCode as themeValidateCode };
export { buildMultiTenantPreviewCode as themePreviewCode };
