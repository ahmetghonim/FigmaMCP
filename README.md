# FDIS — Figma Design Intelligence System

> A Claude-powered MCP platform that gives Claude full creative and analytical control over Figma — equivalent to Cursor, but for design systems.

**97 tools** across 9 capability layers: design creation, token orchestration, AI analysis, code generation, multi-tenant theming, accessibility auditing, and a built-in design knowledge base.

Works with **Claude Desktop** and **Claude CLI (Claude Code)**.

---

## What Claude can do with FDIS

```bash
# Create a complete screen from a brief
"Design a mobile onboarding flow with three steps, each with an illustration area,
headline, description, and navigation dots"

# Install and manage tokens
"Install shadcn/ui tokens with Light and Dark mode variants"
"Export all Figma variables to tokens.json and show what changed vs last week"

# Analyze and fix
"Review this card component for token coverage, naming issues, and accessibility"
"Rename all generic layer names (Frame 47, Rectangle 12) to semantic names"

# Generate code
"Convert this selected component to React with Tailwind classes"
"Create a Jira ticket for this login screen with full acceptance criteria"

# Multi-tenant (Mondia/Monsooq)
"Preview the subscription button in all tenant themes side-by-side"
"Audit this checkout flow for token chain integrity (Theme → Brand → Semantic)"

# Learn
"How should I structure a 3-layer token architecture for multi-tenant products?"
"What does the Design Systems Handbook say about scaling design systems?"
```

---

## Installation

```bash
npm install -g fdis
```

Then follow [SETUP.md](./SETUP.md) to install the Figma plugin and configure Claude.

**Quick config (Claude Desktop):**
```json
{
  "mcpServers": {
    "fdis": {
      "command": "npx",
      "args": ["fdis"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

---

## Tool Reference (97 tools)

### Layer 1 — Core Figma (65 tools, from figma-console-mcp)

**Execute & Read**
`figma_execute` `figma_get_selection` `figma_get_status` `figma_get_file_data`
`figma_get_design_system_kit` `figma_get_design_system_summary` `figma_list_open_files`

**Write & Modify**
`figma_set_fills` `figma_set_strokes` `figma_set_text` `figma_set_image_fill`
`figma_set_instance_properties` `figma_clone_node` `figma_delete_node`
`figma_rename_node` `figma_resize_node` `figma_move_node` `figma_create_child`

**Variables / Tokens**
`figma_get_variables` `figma_create_variable` `figma_create_variable_collection`
`figma_batch_create_variables` `figma_batch_update_variables` `figma_update_variable`
`figma_delete_variable` `figma_rename_variable` `figma_add_mode` `figma_rename_mode`
`figma_get_token_values` `figma_setup_design_tokens`

**Components**
`figma_get_component` `figma_get_component_details` `figma_get_component_for_development`
`figma_get_component_for_development_deep` `figma_get_library_components`
`figma_search_components` `figma_instantiate_component` `figma_analyze_component_set`
`figma_generate_component_doc` `figma_check_design_parity`

**Design System Apps**
`figma_get_styles` `figma_lint_design` `figma_get_design_changes`
`figma_get_component_image` `figma_take_screenshot` `figma_capture_screenshot`

**Slides / FigJam / Comments / Annotations**
`figma_list_slides` `figma_create_slide` `figma_delete_slide`
`figjam_create_sticky` `figjam_create_connector` `figjam_create_table`
`figma_get_comments` `figma_post_comment` `figma_delete_comment`
`figma_get_annotations` `figma_set_annotations`

---

### Layer 2 — Component Synthesis (3 tools)

| Tool | Description |
|---|---|
| `figma_render_jsx` | JSX-like syntax → real Figma nodes (`<Frame>`, `<Text>`, `<Icon>`, `<Image>`, `<Rect>`) |
| `figma_render_jsx_batch` | Render multiple JSX frames in one call |
| `generate_ui_from_intent` | Natural language brief → full screen design (requires Anthropic API key) |

---

### Layer 3 — Token Orchestration (6 tools)

| Tool | Description |
|---|---|
| `figma_create_token_preset` | Install **Tailwind** / **shadcn** / **Radix** / **IDS Base** token collections |
| `figma_import_tokens` | Import JSON token object → Figma variables (DTCG, Style Dictionary, flat) |
| `sync_design_tokens` | `pull` / `push` / `diff` between Figma variables and `tokens.json` |
| `compare_token_schemas` | Diff two token snapshots — track architecture drift over time |
| `migrate_token_structure` | Batch rename tokens across file (`color/*` → `brand/*`) |
| `measure_token_adoption` | Token coverage report with A–F grade per property category |

---

### Layer 4 — Intelligence Engine (4 tools)

> Ported from figmalint. Runs deterministic analysis with 24-hour hash caching. Works without AI key.

| Tool | Description |
|---|---|
| `analyze_design_quality` | Full component audit: score, grade, token coverage, naming, accessibility findings |
| `infer_token_candidates` | Detect hardcoded values that should be tokens (ignores Figma's own #9747FF variant borders) |
| `semantic_layer_naming` | Rename `Frame 47` → `card-header` using 28 semantic type patterns |
| `figma_autofix_issues` | Apply naming + token fixes automatically |

---

### Layer 5 — Code Bridge (3 tools)

| Tool | Description |
|---|---|
| `synthesize_component_react` | Selected frames → React + Tailwind component code |
| `extract_computed_styles` | Selected nodes → CSS (standard, SCSS, or CSS custom properties) |
| `link_design_to_code` | Generate Figma Code Connect `.figma.tsx` mapping file |

---

### Layer 6 — Workflow (4 tools)

| Tool | Description |
|---|---|
| `generate_handoff_documentation` | Full developer spec: dimensions, colors, spacing, tokens — Markdown or JSON |
| `create_dev_ticket_from_design` | Frame → Jira/Linear ticket with acceptance criteria and Figma link |
| `summarize_design_feedback` | Open comments → priority digest (critical / question / feedback / approval) |
| `generate_design_changelog` | Figma version history → Markdown changelog |

---

### Layer 7 — Theme Runtime (3 tools)

> Built for Mondia Group's multi-brand architecture.

| Tool | Description |
|---|---|
| `apply_theme_context` | Switch tenant brand tokens on selected frames (Monsooq/Getmo/etc.) |
| `validate_theme_integrity` | Audit 3-layer token chain: Theme → Brand → Semantic (A–F grade) |
| `render_multi_theme_preview` | Same component in all tenant themes side-by-side with labels |

---

### Layer 8 — Accessibility (3 tools)

| Tool | Description |
|---|---|
| `figma_audit_a11y` | WCAG AA/AAA audit: contrast ratios, font sizes, touch targets |
| `figma_simulate_colorblind` | Daltonization preview: protanopia / deuteranopia / tritanopia / achromatopsia |
| `audit_design_system_usage` | Library health: unused components, detached instances, missing main components |

---

### Layer 9 — Knowledge RAG (2 tools)

| Tool | Description |
|---|---|
| `lookup_design_guidance` | Semantic search over Design Systems Handbook + your custom references |
| `ingest_design_reference` | Add articles or guidelines to the local knowledge base |

**Built-in knowledge base:** Design Systems Handbook (DesignBetter.Co by InVision) — 7 chapters, 104 searchable chunks.

**Add your own books:**
```bash
python3 local-content-library/scripts/ingest-pdf.py your-book.pdf --name "Book Title"
```

---

## Architecture

```
Claude (LLM)                     ← Orchestrator
    │
    ▼
FDIS MCP Server (stdio)          ← This package (97 tools)
    │
    ├── Intelligence Engine      ← figmalint: ComponentConsistencyEngine, TokenAnalyzer, NamingFixer
    ├── Component Synthesis      ← figma-cli: JSX → Figma Plugin API code
    ├── Token Orchestration      ← Tailwind/shadcn/Radix presets + bi-directional sync
    ├── Code Bridge              ← React + CSS + Code Connect generation
    ├── Theme Runtime            ← Multi-tenant token switching + chain validation
    ├── Knowledge RAG            ← Local content library + design-systems-mcp
    └── Base Tools               ← figma-console-mcp (65 tools, kept 100%)
    │
    ▼
FDIS Bridge Plugin (Figma Desktop)
    │ WebSocket on port 9223
    ▼
Figma Design File
```

---

## Merged From 4 Repos

| Repo | Lines | Contribution |
|---|---|---|
| figma-console-mcp | 51,782 | MCP server base, 65 tools, Desktop Bridge — kept 100% intact |
| figma-cli | 14,623 | JSX renderer + token presets — ported to TypeScript engines |
| figmalint | 12,054 | AI intelligence classes — ported server-side, no plugin required |
| design-systems-mcp | 22,338 | Knowledge base architecture + content — local-first with remote fallback |

---

## Credits

Built on top of:
- [figma-console-mcp](https://github.com/southleft/figma-console-mcp) — base MCP server and Desktop Bridge
- [figma-ds-cli](https://github.com/silships/figma-cli) — JSX renderer and token presets
- [figmalint](https://github.com/figmalint/figmalint) — AI-powered design intelligence
- [design-systems-mcp](https://design-systems-mcp.southleft.com) — knowledge base infrastructure
- [Design Systems Handbook](https://www.designbetter.co/design-systems-handbook) — DesignBetter.Co / InVision

---

## License

MIT — see [LICENSE](./LICENSE)
