/**
 * Intelligence Engine — AI Provider
 * Multi-provider LLM support for enhanced analysis.
 * Ported from figmalint/src/api/providers/ — runs server-side.
 *
 * Priority: Anthropic → OpenAI → Google → Rule-based fallback
 * All tools WORK without any API key (rule-based mode, less nuanced output).
 */

export type ProviderId = "anthropic" | "openai" | "google" | "none";

export interface AIProviderConfig {
  anthropicKey?: string;
  openaiKey?: string;
  googleKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  provider: ProviderId;
  model: string;
  tokensUsed?: number;
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function callAnthropic(prompt: string, cfg: AIProviderConfig): Promise<AIResponse> {
  const model = cfg.model ?? "claude-sonnet-4-5-20250929";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.anthropicKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: cfg.maxTokens ?? 2048,
      temperature: cfg.temperature ?? 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const d = await res.json() as any;
  return { text: d.content[0].text, provider: "anthropic", model, tokensUsed: d.usage?.output_tokens };
}

async function callOpenAI(prompt: string, cfg: AIProviderConfig): Promise<AIResponse> {
  const model = cfg.model ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${cfg.openaiKey}` },
    body: JSON.stringify({
      model, temperature: cfg.temperature ?? 0.1, max_tokens: cfg.maxTokens ?? 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const d = await res.json() as any;
  return { text: d.choices[0].message.content, provider: "openai", model, tokensUsed: d.usage?.completion_tokens };
}

async function callGoogle(prompt: string, cfg: AIProviderConfig): Promise<AIResponse> {
  const model = cfg.model ?? "gemini-1.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.googleKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: cfg.temperature ?? 0.1, maxOutputTokens: cfg.maxTokens ?? 2048 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const d = await res.json() as any;
  return { text: d.candidates[0].content.parts[0].text, provider: "google", model };
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

function ruleBased(prompt: string): AIResponse {
  // Extract structured guidance using heuristics when no AI is available
  const lower = prompt.toLowerCase();
  let text = "Rule-based analysis (no AI provider configured):";

  if (lower.includes("naming") || lower.includes("layer")) {
    text += "\n- Rename generic layers (Frame, Rectangle) to semantic names describing purpose\n- Use kebab-case for consistency\n- Names should reflect content, not visual properties";
  }
  if (lower.includes("token") || lower.includes("color") || lower.includes("hardcoded")) {
    text += "\n- Bind hardcoded colors to semantic variables (background/default, foreground/muted)\n- Replace px values with spacing tokens (spacing/md = 16px)\n- Corner radius should use radius tokens";
  }
  if (lower.includes("accessibility") || lower.includes("contrast") || lower.includes("a11y")) {
    text += "\n- Ensure minimum 4.5:1 contrast ratio for normal text (WCAG AA)\n- Interactive elements need 44×44px minimum touch target\n- All images need descriptive alt text";
  }
  if (lower.includes("hierarchy") || lower.includes("spacing") || lower.includes("layout")) {
    text += "\n- Use 8px grid — spacing should be multiples of 8\n- Establish clear visual hierarchy with 2-3 type sizes\n- Auto-layout ensures consistent spacing";
  }
  if (lower.includes("component") || lower.includes("design system")) {
    text += "\n- Extract repeated patterns into reusable components\n- Document all component variants\n- Use component properties for flexible configuration";
  }

  return { text, provider: "none", model: "rule-based" };
}

// ─── Main provider class ──────────────────────────────────────────────────────

export class AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig = {}) {
    this.config = {
      anthropicKey: config.anthropicKey ?? process.env.ANTHROPIC_API_KEY,
      openaiKey: config.openaiKey ?? process.env.OPENAI_API_KEY,
      googleKey: config.googleKey ?? process.env.GOOGLE_API_KEY,
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens ?? 2048,
    };
  }

  getActiveProvider(): ProviderId {
    if (this.config.anthropicKey) return "anthropic";
    if (this.config.openaiKey) return "openai";
    if (this.config.googleKey) return "google";
    return "none";
  }

  async complete(prompt: string, overrideConfig?: Partial<AIProviderConfig>): Promise<AIResponse> {
    const cfg = { ...this.config, ...overrideConfig };

    try {
      if (cfg.anthropicKey) return await callAnthropic(prompt, cfg);
    } catch (e) {
      console.warn("[AIProvider] Anthropic failed, trying OpenAI:", (e as Error).message);
    }

    try {
      if (cfg.openaiKey) return await callOpenAI(prompt, cfg);
    } catch (e) {
      console.warn("[AIProvider] OpenAI failed, trying Google:", (e as Error).message);
    }

    try {
      if (cfg.googleKey) return await callGoogle(prompt, cfg);
    } catch (e) {
      console.warn("[AIProvider] Google failed, using rule-based:", (e as Error).message);
    }

    return ruleBased(prompt);
  }

  /** Parse JSON from AI response (strips markdown code fences) */
  parseJSON<T>(response: AIResponse): T {
    const cleaned = response.text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned) as T;
  }
}

// Singleton
export const aiProvider = new AIProvider();
