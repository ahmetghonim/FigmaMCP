/**
 * Intelligence Engine — Naming Fixer
 * Detects generic layer names and suggests semantic replacements.
 * Ported from figmalint/src/fixes/naming-fixer.ts — runs server-side.
 *
 * Supports 28 SemanticLayerTypes inferred from node structure + content.
 */

import type { SerializedNode, SemanticLayerType, NamingIssue, NamingAnalysisResult, NamingStrategy } from "./types.js";

// ─── Generic name patterns ────────────────────────────────────────────────────

const GENERIC_PATTERNS = /^(Frame|Rectangle|Rect|Group|Ellipse|Vector|Star|Polygon|Line|Image|Component|Section|Text)\s*\d*$/i;
const NUMBERED_PATTERNS = /^.+\s+\d+$/; // "Button 3", "Card 12"

// ─── Semantic type detection ──────────────────────────────────────────────────

const NAME_TYPE_MAP: Record<string, SemanticLayerType> = {
  btn: "button", button: "button", cta: "button",
  icon: "icon", ico: "icon",
  label: "text", title: "text", heading: "text", caption: "text", body: "text",
  input: "input", field: "input", textfield: "input", search: "input",
  img: "image", photo: "image", thumbnail: "image", avatar: "avatar",
  card: "card", tile: "card",
  list: "list", items: "list", feed: "list",
  item: "list-item", row: "list-item", cell: "list-item",
  nav: "nav", navigation: "nav", navbar: "nav", menu: "nav", sidebar: "nav",
  header: "header", topbar: "header",
  footer: "footer", bottombar: "footer",
  modal: "modal", dialog: "modal", overlay: "modal", popup: "modal",
  dropdown: "dropdown", select: "dropdown", picker: "dropdown",
  checkbox: "checkbox", check: "checkbox",
  radio: "radio",
  toggle: "toggle", switch: "toggle",
  badge: "badge", chip: "badge", tag: "badge",
  divider: "divider", separator: "divider", hr: "divider",
  spacer: "spacer", gap: "spacer",
  link: "link", anchor: "link",
  tab: "tab",
  tooltip: "tooltip", hint: "tooltip",
  alert: "alert", toast: "alert", notification: "alert", banner: "alert",
  progress: "progress", bar: "progress",
  skeleton: "skeleton", placeholder: "skeleton",
  container: "container", wrapper: "container", section: "container", page: "container",
};

function detectSemanticType(node: SerializedNode): SemanticLayerType {
  const nameLower = node.name.toLowerCase().replace(/[-_\s]/g, "");

  // Check name patterns
  for (const [pattern, type] of Object.entries(NAME_TYPE_MAP)) {
    if (nameLower.includes(pattern)) return type;
  }

  // Structure-based detection
  if (node.type === "TEXT") return "text";
  if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") return "icon";

  // Children-based heuristics
  const children = node.children ?? [];
  const textChildren = children.filter(c => c.type === "TEXT");
  const iconChildren = children.filter(c => c.type === "VECTOR" || c.type === "BOOLEAN_OPERATION");
  const hasReactions = (node.reactions?.length ?? 0) > 0;

  if (hasReactions && (iconChildren.length > 0 || (node.width ?? 0) < 50)) return "button";
  if (textChildren.length === 1 && children.length === 1) return "text";
  if (node.layout?.mode && children.length > 3) return "list";
  if ((node.width ?? 0) > 200 && (node.height ?? 0) > 100 && children.length >= 2) return "card";
  if ((node.width ?? 0) < 50 && (node.height ?? 0) < 50) return "icon";

  return "container";
}

// ─── Name suggestion generator ────────────────────────────────────────────────

function generateName(node: SerializedNode, semanticType: SemanticLayerType, strategy: NamingStrategy): string {
  const typeNames: Record<SemanticLayerType, string[]> = {
    button: ["button", "btn", "action"],
    icon: ["icon", "ico"],
    text: ["label", "text", "content"],
    input: ["input", "field", "text-field"],
    image: ["image", "img", "photo"],
    container: ["container", "wrapper", "section"],
    card: ["card", "tile", "item"],
    list: ["list", "items", "collection"],
    "list-item": ["item", "row", "entry"],
    nav: ["nav", "navigation", "menu"],
    header: ["header", "top-bar", "toolbar"],
    footer: ["footer", "bottom-bar"],
    modal: ["modal", "dialog", "overlay"],
    dropdown: ["dropdown", "select", "picker"],
    checkbox: ["checkbox", "check"],
    radio: ["radio", "radio-button"],
    toggle: ["toggle", "switch"],
    avatar: ["avatar", "user-photo"],
    badge: ["badge", "chip", "tag"],
    divider: ["divider", "separator"],
    spacer: ["spacer"],
    link: ["link", "anchor"],
    tab: ["tab"],
    tooltip: ["tooltip", "hint"],
    alert: ["alert", "toast", "notification"],
    progress: ["progress-bar", "progress"],
    skeleton: ["skeleton", "placeholder"],
    unknown: ["element", "component"],
  };

  const baseName = typeNames[semanticType]?.[0] ?? "element";

  switch (strategy) {
    case "kebab-case": return baseName;
    case "camelCase": return baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    case "PascalCase": return baseName.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("");
    case "bem": return `${semanticType}__${baseName}`;
    default: return baseName;
  }
}

// ─── Main NamingFixer class ───────────────────────────────────────────────────

export class NamingFixer {
  analyzeNode(node: SerializedNode, strategy: NamingStrategy = "kebab-case"): NamingAnalysisResult {
    const issues: NamingIssue[] = [];
    let totalNodes = 0;
    let genericCount = 0;

    const traverse = (n: SerializedNode): void => {
      totalNodes++;
      const isGeneric = GENERIC_PATTERNS.test(n.name) || NUMBERED_PATTERNS.test(n.name);

      if (isGeneric) {
        genericCount++;
        const semanticType = detectSemanticType(n);
        const suggested = generateName(n, semanticType, strategy);
        issues.push({
          nodeId: n.id,
          nodeName: n.name,
          severity: GENERIC_PATTERNS.test(n.name) ? "warning" : "info",
          issue: GENERIC_PATTERNS.test(n.name)
            ? `Generic layer name "${n.name}" — should reflect purpose`
            : `Numbered layer name "${n.name}" — unstable, rename to describe purpose`,
          suggestedName: suggested,
          semanticType,
        });
      }

      if (n.children) n.children.forEach(traverse);
    };

    traverse(node);

    const coveragePercent = totalNodes === 0 ? 100 : Math.round(((totalNodes - genericCount) / totalNodes) * 100);
    return { issues, genericCount, totalNodes, coveragePercent };
  }

  analyzeNodes(nodes: SerializedNode[], strategy: NamingStrategy = "kebab-case"): NamingAnalysisResult {
    const merged: NamingAnalysisResult = { issues: [], genericCount: 0, totalNodes: 0, coveragePercent: 100 };
    for (const node of nodes) {
      const r = this.analyzeNode(node, strategy);
      merged.issues.push(...r.issues);
      merged.genericCount += r.genericCount;
      merged.totalNodes += r.totalNodes;
    }
    merged.coveragePercent = merged.totalNodes === 0 ? 100 :
      Math.round(((merged.totalNodes - merged.genericCount) / merged.totalNodes) * 100);
    return merged;
  }

  /** Generate Figma Plugin API code to apply renames */
  generateApplyCode(issues: NamingIssue[]): string {
    const renames = issues.map(i => ({ id: i.nodeId, newName: i.suggestedName }));
    return `(async () => {
      const renames = ${JSON.stringify(renames)};
      let count = 0;
      for (const { id, newName } of renames) {
        const node = await figma.getNodeByIdAsync(id);
        if (node) { node.name = newName; count++; }
      }
      return { renamed: count };
    })()`;
  }
}
