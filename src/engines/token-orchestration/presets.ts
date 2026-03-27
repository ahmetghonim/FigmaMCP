/**
 * Token Orchestration Engine — Presets
 * Generates Figma Plugin API code to install production-ready token collections.
 * Ported from figma-cli/src/shadcn.js and figma-cli/src/figma-client.js (token commands).
 */

// ─── Color tables ─────────────────────────────────────────────────────────────

export const TAILWIND_COLORS: Record<string, Record<string, string>> = {
  slate:   {50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",500:"#64748b",600:"#475569",700:"#334155",800:"#1e293b",900:"#0f172a",950:"#020617"},
  gray:    {50:"#f9fafb",100:"#f3f4f6",200:"#e5e7eb",300:"#d1d5db",400:"#9ca3af",500:"#6b7280",600:"#4b5563",700:"#374151",800:"#1f2937",900:"#111827",950:"#030712"},
  zinc:    {50:"#fafafa",100:"#f4f4f5",200:"#e4e4e7",300:"#d4d4d8",400:"#a1a1aa",500:"#71717a",600:"#52525b",700:"#3f3f46",800:"#27272a",900:"#18181b",950:"#09090b"},
  neutral: {50:"#fafafa",100:"#f5f5f5",200:"#e5e5e5",300:"#d4d4d4",400:"#a3a3a3",500:"#737373",600:"#525252",700:"#404040",800:"#262626",900:"#171717",950:"#0a0a0a"},
  stone:   {50:"#fafaf9",100:"#f5f5f4",200:"#e7e5e4",300:"#d6d3d1",400:"#a8a29e",500:"#78716c",600:"#57534e",700:"#44403c",800:"#292524",900:"#1c1917",950:"#0c0a09"},
  red:     {50:"#fef2f2",100:"#fee2e2",200:"#fecaca",300:"#fca5a5",400:"#f87171",500:"#ef4444",600:"#dc2626",700:"#b91c1c",800:"#991b1b",900:"#7f1d1d",950:"#450a0a"},
  orange:  {50:"#fff7ed",100:"#ffedd5",200:"#fed7aa",300:"#fdba74",400:"#fb923c",500:"#f97316",600:"#ea580c",700:"#c2410c",800:"#9a3412",900:"#7c2d12",950:"#431407"},
  amber:   {50:"#fffbeb",100:"#fef3c7",200:"#fde68a",300:"#fcd34d",400:"#fbbf24",500:"#f59e0b",600:"#d97706",700:"#b45309",800:"#92400e",900:"#78350f",950:"#451a03"},
  yellow:  {50:"#fefce8",100:"#fef9c3",200:"#fef08a",300:"#fde047",400:"#facc15",500:"#eab308",600:"#ca8a04",700:"#a16207",800:"#854d0e",900:"#713f12",950:"#422006"},
  lime:    {50:"#f7fee7",100:"#ecfccb",200:"#d9f99d",300:"#bef264",400:"#a3e635",500:"#84cc16",600:"#65a30d",700:"#4d7c0f",800:"#3f6212",900:"#365314",950:"#1a2e05"},
  green:   {50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16"},
  emerald: {50:"#ecfdf5",100:"#d1fae5",200:"#a7f3d0",300:"#6ee7b7",400:"#34d399",500:"#10b981",600:"#059669",700:"#047857",800:"#065f46",900:"#064e3b",950:"#022c22"},
  teal:    {50:"#f0fdfa",100:"#ccfbf1",200:"#99f6e4",300:"#5eead4",400:"#2dd4bf",500:"#14b8a6",600:"#0d9488",700:"#0f766e",800:"#115e59",900:"#134e4a",950:"#042f2e"},
  cyan:    {50:"#ecfeff",100:"#cffafe",200:"#a5f3fc",300:"#67e8f9",400:"#22d3ee",500:"#06b6d4",600:"#0891b2",700:"#0e7490",800:"#155e75",900:"#164e63",950:"#083344"},
  sky:     {50:"#f0f9ff",100:"#e0f2fe",200:"#bae6fd",300:"#7dd3fc",400:"#38bdf8",500:"#0ea5e9",600:"#0284c7",700:"#0369a1",800:"#075985",900:"#0c4a6e",950:"#082f49"},
  blue:    {50:"#eff6ff",100:"#dbeafe",200:"#bfdbfe",300:"#93c5fd",400:"#60a5fa",500:"#3b82f6",600:"#2563eb",700:"#1d4ed8",800:"#1e40af",900:"#1e3a8a",950:"#172554"},
  indigo:  {50:"#eef2ff",100:"#e0e7ff",200:"#c7d2fe",300:"#a5b4fc",400:"#818cf8",500:"#6366f1",600:"#4f46e5",700:"#4338ca",800:"#3730a3",900:"#312e81",950:"#1e1b4b"},
  violet:  {50:"#f5f3ff",100:"#ede9fe",200:"#ddd6fe",300:"#c4b5fd",400:"#a78bfa",500:"#8b5cf6",600:"#7c3aed",700:"#6d28d9",800:"#5b21b6",900:"#4c1d95",950:"#2e1065"},
  purple:  {50:"#faf5ff",100:"#f3e8ff",200:"#e9d5ff",300:"#d8b4fe",400:"#c084fc",500:"#a855f7",600:"#9333ea",700:"#7e22ce",800:"#6b21a8",900:"#581c87",950:"#3b0764"},
  fuchsia: {50:"#fdf4ff",100:"#fae8ff",200:"#f5d0fe",300:"#f0abfc",400:"#e879f9",500:"#d946ef",600:"#c026d3",700:"#a21caf",800:"#86198f",900:"#701a75",950:"#4a044e"},
  pink:    {50:"#fdf2f8",100:"#fce7f3",200:"#fbcfe8",300:"#f9a8d4",400:"#f472b6",500:"#ec4899",600:"#db2777",700:"#be185d",800:"#9d174d",900:"#831843",950:"#500724"},
  rose:    {50:"#fff1f2",100:"#ffe4e6",200:"#fecdd3",300:"#fda4af",400:"#fb7185",500:"#f43f5e",600:"#e11d48",700:"#be123c",800:"#9f1239",900:"#881337",950:"#4c0519"},
};

export const SHADCN_SEMANTIC: Record<string, { light: string; dark: string }> = {
  "background":            {light:"#ffffff",dark:"#09090b"},
  "foreground":            {light:"#09090b",dark:"#fafafa"},
  "card":                  {light:"#ffffff",dark:"#09090b"},
  "card-foreground":       {light:"#09090b",dark:"#fafafa"},
  "popover":               {light:"#ffffff",dark:"#09090b"},
  "popover-foreground":    {light:"#09090b",dark:"#fafafa"},
  "primary":               {light:"#18181b",dark:"#fafafa"},
  "primary-foreground":    {light:"#fafafa",dark:"#18181b"},
  "secondary":             {light:"#f4f4f5",dark:"#27272a"},
  "secondary-foreground":  {light:"#18181b",dark:"#fafafa"},
  "muted":                 {light:"#f4f4f5",dark:"#27272a"},
  "muted-foreground":      {light:"#71717a",dark:"#a1a1aa"},
  "accent":                {light:"#f4f4f5",dark:"#27272a"},
  "accent-foreground":     {light:"#18181b",dark:"#fafafa"},
  "destructive":           {light:"#ef4444",dark:"#7f1d1d"},
  "destructive-foreground":{light:"#fafafa",dark:"#fafafa"},
  "border":                {light:"#e4e4e7",dark:"#27272a"},
  "input":                 {light:"#e4e4e7",dark:"#27272a"},
  "ring":                  {light:"#18181b",dark:"#d4d4d8"},
  "radius":                {light:"#000000",dark:"#000000"}, // placeholder for radius tokens
};

// ─── Code generators ──────────────────────────────────────────────────────────

function h2r(hex: string): string {
  const h = hex.replace("#","");
  const full = h.length===3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h;
  return `{r:${(parseInt(full.slice(0,2),16)/255).toFixed(3)},g:${(parseInt(full.slice(2,4),16)/255).toFixed(3)},b:${(parseInt(full.slice(4,6),16)/255).toFixed(3)}}`;
}

export function buildColorCollectionCode(
  colName: string,
  colors: Record<string, Record<string, string>>,
  modes?: { light: string; dark: string }
): string {
  const colorJson = JSON.stringify(colors);
  const hasModes = !!modes;
  return `(async () => {
    function h(hex){const e=hex.replace('#','');const f=e.length===3?e[0]+e[0]+e[1]+e[1]+e[2]+e[2]:e;return{r:parseInt(f.slice(0,2),16)/255,g:parseInt(f.slice(2,4),16)/255,b:parseInt(f.slice(4,6),16)/255};}
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    let col=cols.find(c=>c.name===${JSON.stringify(colName)});
    if(!col)col=figma.variables.createVariableCollection(${JSON.stringify(colName)});
    ${hasModes
      ? `col.renameMode(col.modes[0].modeId,${JSON.stringify(modes.light)});
         let lightModeId=col.modes[0].modeId;
         let darkModeId=col.modes.find(m=>m.name===${JSON.stringify(modes.dark)})?.modeId;
         if(!darkModeId)darkModeId=col.addMode(${JSON.stringify(modes.dark)});`
      : `const modeId=col.modes[0].modeId;`
    }
    const existing=await figma.variables.getLocalVariablesAsync('COLOR');
    const data=${colorJson};
    let created=0;
    for(const [family,shades] of Object.entries(data)){
      for(const [shade,hex] of Object.entries(shades)){
        const vName=shade==='DEFAULT'?family:family+'/'+shade;
        const found=existing.find(v=>v.name===vName&&v.variableCollectionId===col.id);
        if(!found){
          const v=figma.variables.createVariable(vName,col,'COLOR');
          ${hasModes
            ? `v.setValueForMode(lightModeId,h(hex));v.setValueForMode(darkModeId,h(hex));`
            : `v.setValueForMode(modeId,h(hex));`
          }
          created++;
        }
      }
    }
    return{collection:${JSON.stringify(colName)},created};
  })()`;
}

export function buildShadcnSemanticCode(): string {
  return `(async () => {
    function h(hex){const e=hex.replace('#','');const f=e.length===3?e[0]+e[0]+e[1]+e[1]+e[2]+e[2]:e;return{r:parseInt(f.slice(0,2),16)/255,g:parseInt(f.slice(2,4),16)/255,b:parseInt(f.slice(4,6),16)/255};}
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    let col=cols.find(c=>c.name==='shadcn/semantic');
    if(!col)col=figma.variables.createVariableCollection('shadcn/semantic');
    col.renameMode(col.modes[0].modeId,'Light');
    const lightModeId=col.modes[0].modeId;
    let darkModeId=col.modes.find(m=>m.name==='Dark')?.modeId;
    if(!darkModeId)darkModeId=col.addMode('Dark');
    const existing=await figma.variables.getLocalVariablesAsync('COLOR');
    const data=${JSON.stringify(SHADCN_SEMANTIC)};
    let created=0;
    for(const[name,{light,dark}] of Object.entries(data)){
      if(name==='radius')continue;
      let v=existing.find(ev=>ev.name===name&&ev.variableCollectionId===col.id);
      if(!v){v=figma.variables.createVariable(name,col,'COLOR');created++;}
      v.setValueForMode(lightModeId,h(light));v.setValueForMode(darkModeId,h(dark));
    }
    return{collection:'shadcn/semantic',created};
  })()`;
}

export function buildNumericCollectionCode(
  colName: string,
  tokens: Record<string, number>
): string {
  return `(async () => {
    const cols=await figma.variables.getLocalVariableCollectionsAsync();
    let col=cols.find(c=>c.name===${JSON.stringify(colName)});
    if(!col)col=figma.variables.createVariableCollection(${JSON.stringify(colName)});
    const modeId=col.modes[0].modeId;
    const existing=await figma.variables.getLocalVariablesAsync('FLOAT');
    const data=${JSON.stringify(tokens)};
    let created=0;
    for(const[name,value] of Object.entries(data)){
      const found=existing.find(v=>v.name===name&&v.variableCollectionId===col.id);
      if(!found){const v=figma.variables.createVariable(name,col,'FLOAT');v.setValueForMode(modeId,value);created++;}
    }
    return{collection:${JSON.stringify(colName)},created};
  })()`;
}

// ─── Standard token tables ────────────────────────────────────────────────────

export const SPACING_TOKENS: Record<string, number> = {
  "spacing/0":0,"spacing/0.5":2,"spacing/1":4,"spacing/1.5":6,"spacing/2":8,
  "spacing/2.5":10,"spacing/3":12,"spacing/4":16,"spacing/5":20,"spacing/6":24,
  "spacing/7":28,"spacing/8":32,"spacing/9":36,"spacing/10":40,"spacing/12":48,
  "spacing/14":56,"spacing/16":64,"spacing/20":80,"spacing/24":96,"spacing/32":128,
  "spacing/40":160,"spacing/48":192,"spacing/64":256,
};

export const RADIUS_TOKENS: Record<string, number> = {
  "radius/none":0,"radius/sm":2,"radius/default":4,"radius/md":6,
  "radius/lg":8,"radius/xl":12,"radius/2xl":16,"radius/3xl":24,"radius/full":9999,
};

export const TYPOGRAPHY_TOKENS: Record<string, number> = {
  "font-size/xs":12,"font-size/sm":14,"font-size/base":16,"font-size/lg":18,
  "font-size/xl":20,"font-size/2xl":24,"font-size/3xl":30,"font-size/4xl":36,
  "font-size/5xl":48,"font-size/6xl":60,
  "font-weight/thin":100,"font-weight/light":300,"font-weight/normal":400,
  "font-weight/medium":500,"font-weight/semibold":600,"font-weight/bold":700,
  "font-weight/extrabold":800,
  "line-height/tight":1.25,"line-height/snug":1.375,"line-height/normal":1.5,
  "line-height/relaxed":1.625,"line-height/loose":2,
};

// IDS Base — minimal production starter kit for multi-tenant systems
export const IDS_BASE_SEMANTIC: Record<string, { light: string; dark: string }> = {
  "background/default":         {light:"#ffffff",dark:"#09090b"},
  "background/muted":           {light:"#f4f4f5",dark:"#18181b"},
  "background/emphasis":        {light:"#18181b",dark:"#fafafa"},
  "background/overlay":         {light:"rgba(0,0,0,0.5)",dark:"rgba(0,0,0,0.7)"},
  "foreground/default":         {light:"#18181b",dark:"#fafafa"},
  "foreground/muted":           {light:"#71717a",dark:"#a1a1aa"},
  "foreground/subtle":          {light:"#a1a1aa",dark:"#52525b"},
  "foreground/on-emphasis":     {light:"#ffffff",dark:"#ffffff"},
  "border/default":             {light:"#e4e4e7",dark:"#27272a"},
  "border/muted":               {light:"#f4f4f5",dark:"#18181b"},
  "border/emphasis":            {light:"#71717a",dark:"#71717a"},
  "border/focus":               {light:"#3b82f6",dark:"#60a5fa"},
  "action/primary":             {light:"#3b82f6",dark:"#3b82f6"},
  "action/primary-hover":       {light:"#2563eb",dark:"#60a5fa"},
  "action/primary-foreground":  {light:"#ffffff",dark:"#ffffff"},
  "action/secondary":           {light:"#f4f4f5",dark:"#27272a"},
  "action/secondary-hover":     {light:"#e4e4e7",dark:"#3f3f46"},
  "feedback/success":           {light:"#22c55e",dark:"#4ade80"},
  "feedback/success-muted":     {light:"#dcfce7",dark:"#052e16"},
  "feedback/warning":           {light:"#f59e0b",dark:"#fbbf24"},
  "feedback/warning-muted":     {light:"#fef3c7",dark:"#451a03"},
  "feedback/error":             {light:"#ef4444",dark:"#f87171"},
  "feedback/error-muted":       {light:"#fee2e2",dark:"#450a0a"},
  "feedback/info":              {light:"#3b82f6",dark:"#60a5fa"},
  "feedback/info-muted":        {light:"#dbeafe",dark:"#172554"},
};
