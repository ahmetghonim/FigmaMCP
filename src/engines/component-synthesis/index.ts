/**
 * Component Synthesis Engine — Public API
 * Entry point for JSX → Figma code generation.
 */

import { parseJsxRoot, collectIconNames } from "./jsx-parser.js";
import { generateFigmaCode } from "./jsx-code-generator.js";
import type { SynthesisResult, BatchSynthesisOptions } from "./types.js";

// ─── Icon fetcher ─────────────────────────────────────────────────────────────

export async function fetchIconSvgs(names: Set<string>): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  await Promise.all([...names].map(async iconName => {
    try {
      const [prefix, name] = iconName.split(":");
      const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg?width=24&height=24`);
      if (res.ok) {
        const svg = await res.text();
        if (svg.includes("<svg")) map[iconName] = svg;
      }
    } catch { /* icon not found — fallback placeholder */ }
  }));
  return map;
}

// ─── Single JSX → Figma code ──────────────────────────────────────────────────

export async function synthesizeJSX(jsx: string): Promise<SynthesisResult> {
  const { props, children } = parseJsxRoot(jsx.trim());
  const iconNames = collectIconNames(children);
  const iconSvgMap = iconNames.size > 0 ? await fetchIconSvgs(iconNames) : {};
  const code = generateFigmaCode(props, children, iconSvgMap);
  return { code, iconSvgMap };
}

// ─── Batch JSX → Figma code ───────────────────────────────────────────────────

export async function synthesizeJSXBatch(
  jsxArray: string[],
  options: BatchSynthesisOptions = {}
): Promise<SynthesisResult[]> {
  return Promise.all(jsxArray.map(jsx => synthesizeJSX(jsx)));
}

// ─── Natural language → JSX → Figma code ─────────────────────────────────────

export interface IntentGenerationOptions {
  width?: number;
  height?: number;
  style?: "minimal" | "material" | "ios" | "enterprise";
  apiKey: string;
}

const STYLE_GUIDES: Record<string, string> = {
  minimal: "Clean white backgrounds (#ffffff), zinc/gray palette, subtle borders (#e4e4e7), 8px base spacing, rounded corners 8-12px, Inter font",
  material: "Material Design 3: tonal colors, 16dp spacing, filled buttons, prominent CTAs, slightly larger touch targets",
  ios: "iOS HIG: system blue (#007AFF), large titles 34px, grouped lists, native feel, generous spacing",
  enterprise: "Dense layout, 4px grid, professional blue (#0062cc) + gray palette, small 12-14px text, compact spacing",
};

export async function generateFromIntent(
  brief: string,
  options: IntentGenerationOptions
): Promise<SynthesisResult> {
  const { width = 375, height = 812, style = "minimal", apiKey } = options;

  const prompt = `You are an expert UI designer. Generate a Figma design using ONLY this JSX syntax.

BRIEF: ${brief}
CANVAS: ${width}×${height}px
STYLE: ${style} — ${STYLE_GUIDES[style]}

JSX ELEMENTS AVAILABLE:
- <Frame name="" flex="row|col" gap={8} p={16} px={} py={} bg="#hex" stroke="#hex" rounded={8} w={320} h={200} align="start|center|end" justify="start|center|end" clip={true}>
- <Text size={16} weight="regular|medium|semibold|bold" color="#hex" w="fill">content</Text>  
- <Rect w={200} h={100} bg="#hex" rounded={8} />
- <Image w={300} h={200} rounded={12} />
- <Icon name="lucide:icon-name" size={24} color="#hex" />

RULES:
1. Root MUST be: <Frame name="Screen Name" flex="col" w={${width}} h={${height}} bg="#ffffff">
2. Use realistic content — real placeholder text, proper proportions
3. Use w="fill" for full-width children inside flex frames  
4. Icon names: lucide:mail, lucide:lock, lucide:arrow-right, lucide:eye, lucide:user, lucide:search
5. Max 4 nesting levels
6. NO hardcoded values — use good defaults from the style guide

Respond with ONLY the JSX. No explanation. No markdown.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const jsx = data.content?.[0]?.text?.trim() ?? "";

  if (!jsx.startsWith("<Frame")) {
    throw new Error(`AI returned invalid JSX. Expected <Frame...>, got: ${jsx.slice(0, 100)}`);
  }

  return synthesizeJSX(jsx);
}
