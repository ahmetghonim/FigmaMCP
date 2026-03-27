/**
 * Knowledge Engine — Design Systems RAG
 * Local-first knowledge base over the local-content-library.
 * Falls back to remote design-systems-mcp if configured.
 *
 * Local mode (default):  reads JSON entries from local-content-library/content/entries/
 * Remote mode (optional): calls design-systems-mcp.southleft.com Supabase vector search
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../../../local-content-library/content/entries");
const MANIFEST_PATH = path.resolve(__dirname, "../../../local-content-library/content/manifest.json");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  title: string;
  source: { type: string; location: string; ingested_at?: string };
  content: string;
  chunks: KnowledgeChunk[];
  metadata: {
    category: string;
    tags: string[];
    confidence: string;
    system: string;
    chapter?: string;
    authors?: string;
    publisher?: string;
    [key: string]: any;
  };
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  metadata: { section?: string; chunkIndex?: number; pageRange?: string };
}

export interface SearchResult {
  entry: KnowledgeEntry;
  chunk: KnowledgeChunk;
  score: number;
  sourceLabel: string;
  authorityLevel: "authoritative" | "official" | "community";
}

// ─── Entry loader ─────────────────────────────────────────────────────────────

let _cache: KnowledgeEntry[] | null = null;

export function loadEntries(): KnowledgeEntry[] {
  if (_cache) return _cache;
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith(".json"));
  _cache = files.flatMap(f => {
    try { return [JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8"))]; }
    catch { return []; }
  });
  return _cache;
}

export function invalidateCache(): void { _cache = null; }

// ─── Source authority scoring ─────────────────────────────────────────────────

function getAuthority(entry: KnowledgeEntry): { level: "authoritative" | "official" | "community"; label: string } {
  const loc = (entry.source?.location ?? "").toLowerCase();
  const sys = (entry.metadata?.system ?? "").toLowerCase();
  const pub = (entry.metadata?.publisher ?? "").toLowerCase();

  if (loc.includes("handbook") || pub.includes("invision") || pub.includes("designbetter")) {
    return { level: "authoritative", label: "📚 Design Systems Handbook (DesignBetter.Co)" };
  }
  if (["material", "carbon", "primer", "polaris", "fluent", "lightning", "apple"].some(s => sys.includes(s))) {
    return { level: "official", label: `✅ Official Design System (${entry.metadata.system})` };
  }
  return { level: "community", label: `🌐 ${entry.metadata.system || "Community Resource"}` };
}

// ─── Local search (keyword + tag matching) ────────────────────────────────────

export function searchLocal(query: string, options: { category?: string; limit?: number } = {}): SearchResult[] {
  const entries = loadEntries();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const results: Array<{ entry: KnowledgeEntry; chunk: KnowledgeChunk; score: number }> = [];

  for (const entry of entries) {
    if (options.category && entry.metadata.category !== options.category) continue;

    for (const chunk of entry.chunks) {
      const text = chunk.text.toLowerCase();
      let score = 0;

      // Exact phrase match — highest weight
      if (text.includes(queryLower)) score += 12;

      // Word frequency scoring
      for (const word of queryWords) {
        const count = (text.match(new RegExp(`\\b${word}\\b`, "g")) ?? []).length;
        score += count * 2;
      }

      // Tag match
      for (const tag of entry.metadata.tags ?? []) {
        if (queryWords.some(w => tag.toLowerCase().includes(w))) score += 4;
      }

      // Title match
      if (entry.title.toLowerCase().includes(queryLower)) score += 8;

      // Section/chapter match
      if (chunk.metadata?.section?.toLowerCase().includes(queryLower)) score += 6;

      if (score > 0) results.push({ entry, chunk, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5)
    .map(r => ({
      ...r,
      ...getAuthority(r.entry),
      sourceLabel: getAuthority(r.entry).label,
      authorityLevel: getAuthority(r.entry).level,
    }));
}

// ─── Remote search (design-systems-mcp.southleft.com) ────────────────────────

export async function searchRemote(query: string, limit = 5): Promise<SearchResult[]> {
  // Only runs if DESIGN_SYSTEMS_MCP_URL is configured
  const baseUrl = process.env.DESIGN_SYSTEMS_MCP_URL ?? "https://design-systems-mcp.southleft.com";
  try {
    const res = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) throw new Error(`Remote search ${res.status}`);
    const data = await res.json() as any;
    return (data.results ?? []).map((r: any) => ({
      entry: { id: r.id, title: r.title, source: { type: "remote", location: r.url }, content: r.content, chunks: [{ id: r.id, text: r.content, metadata: {} }], metadata: { category: r.category, tags: r.tags ?? [], confidence: "high", system: r.system ?? r.title } },
      chunk: { id: r.id, text: r.content, metadata: {} },
      score: r.score ?? 1,
      sourceLabel: `🌐 ${r.system ?? r.title}`,
      authorityLevel: "community" as const,
    }));
  } catch {
    return []; // Silent fallback to local
  }
}

// ─── Unified search ───────────────────────────────────────────────────────────

export async function search(query: string, options: { category?: string; limit?: number; useRemote?: boolean } = {}): Promise<SearchResult[]> {
  const local = searchLocal(query, options);
  if (local.length >= (options.limit ?? 5)) return local;

  // Supplement with remote if configured and local results are sparse
  if (options.useRemote !== false && process.env.DESIGN_SYSTEMS_MCP_URL) {
    const remote = await searchRemote(query, (options.limit ?? 5) - local.length);
    return [...local, ...remote].slice(0, options.limit ?? 5);
  }

  return local;
}

// ─── Content ingestion ────────────────────────────────────────────────────────

export function ingestEntry(entry: KnowledgeEntry): void {
  invalidateCache();
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONTENT_DIR, `${entry.id}.json`), JSON.stringify(entry, null, 2));

  // Update manifest
  if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    manifest.total_entries = (manifest.total_entries ?? 0) + 1;
    manifest.entries = [...new Set([...(manifest.entries ?? []), `${entry.id}.json`])];
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }
}

export function buildTextEntry(options: {
  title: string; content: string; source?: string;
  category?: string; tags?: string[]; system?: string;
}): KnowledgeEntry {
  const { title, content, source, category = "architecture", tags = [], system } = options;
  const id = `custom-${Date.now()}-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40)}`;

  // Chunk into ~2000 char segments
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const chunks: KnowledgeChunk[] = [];
  let cur = "", idx = 0;
  for (const para of paragraphs) {
    if (cur.length + para.length > 2000 && cur) {
      chunks.push({ id: `${id}-c${idx}`, text: cur.trim(), metadata: { section: title, chunkIndex: idx++ } });
      cur = para;
    } else {
      cur += (cur ? "\n\n" : "") + para;
    }
  }
  if (cur) chunks.push({ id: `${id}-c${idx}`, text: cur.trim(), metadata: { section: title, chunkIndex: idx } });

  return {
    id,
    title,
    source: { type: source?.startsWith("http") ? "url" : "text", location: source ?? "manual" },
    content: content.slice(0, 500) + (content.length > 500 ? "…" : ""),
    chunks,
    metadata: { category, tags: [...tags, "custom"], confidence: "high", system: system ?? title, last_updated: new Date().toISOString() },
  };
}

export function getManifest(): any {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
}
