/**
 * Component Synthesis Engine — JSX Parser
 * Parses JSX-like syntax into a tree of SynthesisElement nodes.
 * Ported from figma-cli's FigmaClient.parseJSX() to clean TypeScript.
 *
 * Supported elements: <Frame>, <Text>, <Rect>/<Rectangle>, <Image>, <Icon>
 */

import type { SynthesisElement, SynthesisFrameProps } from "./types.js";

// ─── Prop parsing ─────────────────────────────────────────────────────────────

export function parseProps(propsStr: string): Record<string, any> {
  const props: Record<string, any> = {};
  const re = /(\w+)=(?:"([^"]*)"|{([^}]*)}|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(propsStr)) !== null) {
    const key = m[1];
    const raw = m[2] ?? m[3] ?? m[4];
    // Type coercion: booleans, numbers
    if (raw === "true") props[key] = true;
    else if (raw === "false") props[key] = false;
    else if (!isNaN(Number(raw)) && raw.trim() !== "") props[key] = Number(raw);
    else props[key] = raw;
  }
  return props;
}

// ─── Content extraction ───────────────────────────────────────────────────────

export function extractContent(str: string, tag: string): string {
  const close = `</${tag}>`;
  let depth = 1, i = 0;
  while (i < str.length && depth > 0) {
    const rest = str.slice(i);
    if (rest.startsWith(close)) {
      if (--depth === 0) return str.slice(0, i);
      i += close.length;
    } else if (rest.startsWith(`<${tag} `) || rest.startsWith(`<${tag}>`)) {
      const selfClose = rest.match(new RegExp(`^<${tag}(?:\\s[^>]*?)?\\s*\\/>`));
      if (selfClose) i += selfClose[0].length;
      else { depth++; i++; }
    } else i++;
  }
  return str;
}

// ─── Children parser ──────────────────────────────────────────────────────────

export function parseChildren(str: string): SynthesisElement[] {
  const children: SynthesisElement[] = [];
  const consumed: Array<{ start: number; end: number }> = [];

  const isConsumed = (idx: number) =>
    consumed.some(c => idx >= c.start && idx < c.end);

  // ── <Frame> with children
  const frameOpenRe = /<Frame(?:\s+([^>]*?))?>/g;
  let m: RegExpExecArray | null;
  while ((m = frameOpenRe.exec(str)) !== null) {
    if (m[0].endsWith("/>")) continue;
    const props = parseProps(m[1] ?? "");
    const afterOpen = str.slice(m.index + m[0].length);
    const inner = extractContent(afterOpen, "Frame");
    const fullLen = m[0].length + inner.length + "</Frame>".length;
    children.push({ ...props, _type: "frame", _index: m.index, _children: parseChildren(inner) });
    consumed.push({ start: m.index, end: m.index + fullLen });
    frameOpenRe.lastIndex = m.index + fullLen;
  }

  // ── Self-closing <Frame />
  const frameSelfRe = /<Frame(?:\s+([^>]*?))?\s*\/>/g;
  while ((m = frameSelfRe.exec(str)) !== null) {
    if (isConsumed(m.index)) continue;
    children.push({ ...parseProps(m[1] ?? ""), _type: "frame", _index: m.index, _children: [] });
    consumed.push({ start: m.index, end: m.index + m[0].length });
  }

  // ── <Text>content</Text>
  const textRe = /<Text(?:\s+([^>]*?))?>([^<]*)<\/Text>/g;
  while ((m = textRe.exec(str)) !== null) {
    if (isConsumed(m.index)) continue;
    children.push({ ...parseProps(m[1] ?? ""), _type: "text", _index: m.index, content: m[2] ?? "" });
  }

  // ── <Rect /> or <Rectangle />
  const rectRe = /<(?:Rectangle|Rect)(?:\s+([^/]*?))?\s*\/>/g;
  while ((m = rectRe.exec(str)) !== null) {
    if (isConsumed(m.index)) continue;
    children.push({ ...parseProps(m[1] ?? ""), _type: "rect", _index: m.index });
    consumed.push({ start: m.index, end: m.index + m[0].length });
  }

  // ── <Image />
  const imgRe = /<Image(?:\s+([^/]*?))?\s*\/>/g;
  while ((m = imgRe.exec(str)) !== null) {
    if (isConsumed(m.index)) continue;
    children.push({ ...parseProps(m[1] ?? ""), _type: "image", _index: m.index });
    consumed.push({ start: m.index, end: m.index + m[0].length });
  }

  // ── <Icon />
  const iconRe = /<Icon(?:\s+([^/]*?))?\s*\/>/g;
  while ((m = iconRe.exec(str)) !== null) {
    if (isConsumed(m.index)) continue;
    const props = parseProps(m[1] ?? "");
    if (props.name) {
      children.push({ ...props, name: props.name as string, _type: "icon" as const, _index: m.index });
      consumed.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  return children.sort((a, b) => (a._index ?? 0) - (b._index ?? 0));
}

// ─── Icon collection ──────────────────────────────────────────────────────────

export function collectIconNames(items: SynthesisElement[]): Set<string> {
  const names = new Set<string>();
  for (const item of items) {
    if (item._type === "icon" && item.name?.includes(":")) names.add(item.name);
    if (item._type === "frame" && item._children) {
      for (const n of collectIconNames(item._children)) names.add(n);
    }
  }
  return names;
}

// ─── Top-level JSX parse ──────────────────────────────────────────────────────

export function parseJsxRoot(jsx: string): { props: Record<string, any>; children: SynthesisElement[] } {
  const openMatch = jsx.match(/<Frame\s+([^>]*)>/);
  if (!openMatch) throw new Error("JSX must start with <Frame ...>. Got: " + jsx.slice(0, 80));
  const propsStr = openMatch[1];
  const afterOpen = jsx.slice(openMatch.index! + openMatch[0].length);
  const inner = extractContent(afterOpen, "Frame");
  return { props: parseProps(propsStr), children: parseChildren(inner) };
}
