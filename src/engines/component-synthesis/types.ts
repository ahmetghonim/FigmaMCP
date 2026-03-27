/**
 * Component Synthesis Engine — Types
 * Defines the JSX intermediate representation used by the parser and code generator.
 */

export interface SynthesisFrameProps {
  name?: string;
  // Size
  w?: string | number; h?: string | number;
  width?: string | number; height?: string | number;
  // Visual
  bg?: string; fill?: string; stroke?: string; strokeWidth?: number; strokeAlign?: string;
  rounded?: number; radius?: number;
  opacity?: number;
  // Auto-layout
  flex?: "row" | "col";
  gap?: number; p?: number; px?: number; py?: number;
  pt?: number; pr?: number; pb?: number; pl?: number;
  align?: string; items?: string; justify?: string;
  wrap?: boolean | "true" | "false"; wrapGap?: number;
  hug?: string; clip?: boolean | "true" | "false"; overflow?: string;
  // Position
  x?: number; y?: number; position?: string;
  grow?: number;
  // Misc
  [key: string]: any;
}

export interface SynthesisTextProps {
  _type: "text";
  _index: number;
  content: string;
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "bold";
  color?: string;
  w?: string; align?: string;
  [key: string]: any;
}

export interface SynthesisFrameElement extends SynthesisFrameProps {
  _type: "frame";
  _index: number;
  _children: SynthesisElement[];
}

export interface SynthesisRectElement {
  _type: "rect";
  _index: number;
  name?: string;
  w?: number; h?: number; width?: number; height?: number;
  bg?: string; fill?: string; rounded?: number; radius?: number;
  [key: string]: any;
}

export interface SynthesisImageElement {
  _type: "image";
  _index: number;
  name?: string;
  w?: number; h?: number; width?: number; height?: number;
  rounded?: number; bg?: string;
  [key: string]: any;
}

export interface SynthesisIconElement {
  _type: "icon";
  _index: number;
  name: string; // e.g. "lucide:star"
  size?: number; s?: number;
  color?: string; c?: string;
  [key: string]: any;
}

export type SynthesisElement =
  | SynthesisTextProps
  | SynthesisFrameElement
  | SynthesisRectElement
  | SynthesisImageElement
  | SynthesisIconElement;

export interface SynthesisResult {
  /** Generated Figma Plugin API JavaScript code */
  code: string;
  /** Icon SVG data keyed by "prefix:name" */
  iconSvgMap: Record<string, string>;
}

export interface BatchSynthesisOptions {
  gap?: number;
  vertical?: boolean;
}
