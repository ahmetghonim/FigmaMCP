# FigmaMCP — Figma Design Intelligence System

> The most powerful Figma MCP server — built on figma-console-mcp and extended with AI analysis, token orchestration, JSX rendering, multi-tenant theming, code generation, and a built-in design knowledge base.

**97 tools** across 9 capability layers. Works with Claude Desktop, Claude CLI, Cursor, and any MCP-compatible client.

---

## ✨ What Makes FigmaMCP Different

| Feature | figma-console-mcp | FigmaMCP |
|---|---|---|
| Core Figma read/write | ✅ 65 tools | ✅ 65 tools (inherited) |
| JSX → Figma renderer | ❌ | ✅ `figma_render_jsx` |
| Natural language → design | ❌ | ✅ `generate_ui_from_intent` |
| AI design review | ❌ | ✅ `analyze_design_quality` |
| Token coverage report | ❌ | ✅ `measure_token_adoption` |
| Token presets (Tailwind, shadcn) | ❌ | ✅ `figma_create_token_preset` |
| React/CSS code export | ❌ | ✅ `synthesize_component_react` |
| Multi-tenant theme switching | ❌ | ✅ `apply_theme_context` |
| Hardcoded value scanner | ❌ | ✅ `infer_token_candidates` |
| AI layer renaming | ❌ | ✅ `semantic_layer_naming` |
| Design knowledge base (RAG) | via separate repo | ✅ built-in |
| `browse_by_category` tool | design-systems-mcp | ✅ `browse_design_knowledge_by_category` |
| `search_chunks` tool | design-systems-mcp | ✅ `search_knowledge_chunks` |
| `get_all_tags` tool | design-systems-mcp | ✅ `get_knowledge_tags` |
| Token Browser MCP App | figma-console-mcp | ✅ `ENABLE_MCP_APPS=true` |
| Design System Dashboard App | figma-console-mcp | ✅ `ENABLE_MCP_APPS=true` |
| Orphaned process cleanup | figma-console-mcp | ✅ auto on startup |
| Port advertisement (heartbeat) | figma-console-mcp | ✅ every 30s |
| Graceful shutdown | figma-console-mcp | ✅ SIGINT/SIGTERM |
| Developer handoff spec | ❌ | ✅ `generate_handoff_documentation` |
| Jira/Linear ticket generator | ❌ | ✅ `create_dev_ticket_from_design` |
| WCAG accessibility audit | basic | ✅ full AA/AAA + colorblind sim |

---

## 🚀 Quick Start

### Step 1 — Clone and build

```bash
git clone https://github.com/ahmetghonim/FigmaMCP.git
cd FigmaMCP
npm install
npm run build:local
```

### Step 2 — Configure Claude Desktop

Open `~/Library/Application Support/Claude/claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "figmamcp": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/FigmaMCP/dist/local.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_your_token_here",
        "ANTHROPIC_API_KEY": "sk-ant-your_key_here"
      }
    }
  }
}
```

> Replace `YOUR_USERNAME` with your actual macOS username.

Restart Claude Desktop after saving.

### Step 3 — Install the MCP Bridge plugin in Figma

1. Open **Figma Desktop** (must be the desktop app, not browser)
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select: `/Users/YOUR_USERNAME/FigmaMCP/MCP-Bridge-Plugin/manifest.json`
4. Run it: **Plugins → Development → MCP Bridge**
5. Wait for the **green connected indicator** ✅

### Step 4 — Verify

Ask Claude:
> *"What's the status of my Figma connection?"*

---

## 🔑 API Keys

### Figma Personal Access Token
Required for REST API tools (reading files, comments, version history).

1. Go to **figma.com → Account Settings → Security**
2. Scroll to **Personal access tokens → Generate new token**
3. Name: `FigmaMCP` — check **File content** and **Variables** read/write
4. Copy the token (starts with `figd_`)

### Anthropic API Key
Required for AI-powered tools (`analyze_design_quality`, `generate_ui_from_intent`, etc.).
All tools work without it in rule-based mode — just with less nuanced output.

1. Go to **console.anthropic.com**
2. Create a new API key
3. Add to `ANTHROPIC_API_KEY` in your config

---

## 🛠 All 97 Tools

### 🏗 Layer 1 — Core Figma (65 tools)
*Inherited from figma-console-mcp — full credit to [Southleft](https://github.com/southleft/figma-console-mcp)*

<details>
<summary>Show all 65 base tools</summary>

**Execute & Read**
| Tool | Description |
|---|---|
| `figma_execute` | Execute arbitrary JavaScript in Figma's plugin context |
| `figma_get_selection` | Get currently selected nodes |
| `figma_get_status` | Check Desktop Bridge connection status |
| `figma_get_file_data` | Full file structure and document tree |
| `figma_get_design_system_kit` | Full design system in one call — tokens, components, styles |
| `figma_get_design_system_summary` | Compact overview of the design system |
| `figma_list_open_files` | List all Figma files connected via Desktop Bridge |
| `figma_get_design_changes` | Recent document changes |
| `figma_get_console_logs` | Retrieve console logs |
| `figma_watch_console` | Stream console logs in real-time |
| `figma_take_screenshot` | Screenshot via REST API |
| `figma_capture_screenshot` | Screenshot via plugin's exportAsync |
| `figma_lint_design` | Run accessibility and design quality checks |

**Write & Modify**
| Tool | Description |
|---|---|
| `figma_set_fills` | Set fill colors on nodes |
| `figma_set_strokes` | Set stroke colors |
| `figma_set_text` | Set text content |
| `figma_set_image_fill` | Set image fill |
| `figma_set_instance_properties` | Update component instance properties |
| `figma_clone_node` | Duplicate a node |
| `figma_delete_node` | Delete a node |
| `figma_rename_node` | Rename a layer |
| `figma_resize_node` | Resize a node |
| `figma_move_node` | Move a node |
| `figma_create_child` | Create a new child node |

**Variables / Tokens**
| Tool | Description |
|---|---|
| `figma_get_variables` | All variables with format export support |
| `figma_get_token_values` | Resolved token values |
| `figma_create_variable` | Create a single variable |
| `figma_create_variable_collection` | Create a collection |
| `figma_batch_create_variables` | Create multiple variables in one call |
| `figma_batch_update_variables` | Update multiple variables |
| `figma_update_variable` | Update a single variable |
| `figma_delete_variable` | Delete a variable |
| `figma_delete_variable_collection` | Delete a collection |
| `figma_rename_variable` | Rename a variable |
| `figma_add_mode` | Add a new mode to a collection |
| `figma_rename_mode` | Rename a mode |
| `figma_setup_design_tokens` | Create full token structure in one operation |

**Components**
| Tool | Description |
|---|---|
| `figma_get_component` | Component metadata or reconstruction spec |
| `figma_get_component_details` | Full details with variants and properties |
| `figma_get_component_for_development` | Component + image for implementation |
| `figma_get_component_for_development_deep` | Deep nested tree with resolved tokens |
| `figma_get_component_image` | Render component as image |
| `figma_get_library_components` | Components from shared libraries |
| `figma_search_components` | Search by name, category, or description |
| `figma_instantiate_component` | Create an instance |
| `figma_analyze_component_set` | Analyze variant state machine |
| `figma_arrange_component_set` | Organize component set layout |
| `figma_generate_component_doc` | Generate AI component documentation |
| `figma_check_design_parity` | Compare Figma specs against code implementation |

**Slides / FigJam / Comments**
| Tool | Description |
|---|---|
| `figma_list_slides` / `figma_create_slide` / `figma_delete_slide` | Slides management |
| `figjam_create_sticky` / `figjam_create_stickies` | Sticky notes |
| `figjam_create_connector` / `figjam_create_table` | Diagrams and tables |
| `figma_get_comments` / `figma_post_comment` / `figma_delete_comment` | File comments |
| `figma_get_annotations` / `figma_set_annotations` | Design annotations |

</details>

---

### 🎨 Layer 2 — Component Synthesis (3 tools)

> Write UI in JSX syntax — it becomes real Figma nodes instantly.

| Tool | Description |
|---|---|
| `figma_render_jsx` | JSX string → real Figma nodes (`<Frame>`, `<Text>`, `<Icon>`, `<Image>`, `<Rect>`) |
| `figma_render_jsx_batch` | Render multiple frames in one call (10x faster) |
| `generate_ui_from_intent` | Natural language → full screen design *(requires Anthropic key)* |

**JSX example:**
```jsx
<Frame name="Card" flex="col" bg="#ffffff" rounded={12} p={0} w={320}>
  <Frame name="Card/Image" w="fill" h={160} bg="#f4f4f5" />
  <Frame name="Card/Body" flex="col" gap={12} p={16} w="fill">
    <Text size={18} weight="semibold" color="#18181b">Card Title</Text>
    <Text size={14} color="#71717a">Supporting description text</Text>
    <Frame name="Actions" flex="row" gap={8}>
      <Frame bg="#3b82f6" rounded={8} px={16} py={8}>
        <Text color="#ffffff" weight="medium">Get Started</Text>
      </Frame>
    </Frame>
  </Frame>
</Frame>
```

---

### 🪙 Layer 3 — Token Orchestration (6 tools)

| Tool | Description |
|---|---|
| `figma_create_token_preset` | Install **Tailwind** / **shadcn** / **Radix** / **IDS Base** preset collections |
| `figma_import_tokens` | JSON → Figma variables (DTCG, Style Dictionary, flat) |
| `sync_design_tokens` | `pull` / `push` / `diff` between Figma variables and `tokens.json` |
| `compare_token_schemas` | Diff two snapshots — track token architecture drift |
| `migrate_token_structure` | Batch rename tokens across the file (`color/*` → `brand/*`) |
| `measure_token_adoption` | Token coverage report with **A–F grade** per property |

---

### 🧠 Layer 4 — Intelligence Engine (4 tools)

> Deterministic analysis with 24-hour hash caching. Works without AI key in rule-based mode.

| Tool | Description |
|---|---|
| `analyze_design_quality` | Full audit: score, grade, token coverage, naming, a11y findings |
| `infer_token_candidates` | Find hardcoded values that should be tokens *(ignores Figma's own `#9747FF` variant borders)* |
| `semantic_layer_naming` | Rename `Frame 47` → `card-header` using 28 semantic type patterns |
| `figma_autofix_issues` | Apply naming + token fixes automatically |

---

### ⚡ Layer 5 — Code Bridge (3 tools)

| Tool | Description |
|---|---|
| `synthesize_component_react` | Selected frames → React + Tailwind component code |
| `extract_computed_styles` | Selected nodes → CSS / SCSS / CSS variables |
| `link_design_to_code` | Generate Figma Code Connect `.figma.tsx` mapping file |

---

### 📋 Layer 6 — Workflow (4 tools)

| Tool | Description |
|---|---|
| `generate_handoff_documentation` | Full developer spec: dimensions, colors, spacing, tokens |
| `create_dev_ticket_from_design` | Frame → Jira/Linear ticket with acceptance criteria |
| `summarize_design_feedback` | Open comments → priority digest |
| `generate_design_changelog` | Figma version history → Markdown changelog |

---

### 🎭 Layer 7 — Multi-Tenant Theme Runtime (3 tools)

> Built for Mondia Group's multi-brand architecture (Monsooq / Getmo).

| Tool | Description |
|---|---|
| `apply_theme_context` | Switch tenant brand tokens on selected frames |
| `validate_theme_integrity` | Audit 3-layer token chain: Theme → Brand → Semantic (A–F grade) |
| `render_multi_theme_preview` | Same component in all tenant themes side-by-side |

**3-layer token contract:**
```
Theme/Primitives  →  Brand (per tenant)  →  Semantic  →  Components
    zinc/500             Monsooq/primary        action/primary
```

---

### ♿ Layer 8 — Accessibility (3 tools)

| Tool | Description |
|---|---|
| `figma_audit_a11y` | WCAG AA/AAA audit: contrast ratios, font sizes, touch targets |
| `figma_simulate_colorblind` | Daltonization preview: protanopia / deuteranopia / tritanopia / achromatopsia |
| `audit_design_system_usage` | Library health: unused components, detached instances |

---

### 📚 Layer 9 — Design Knowledge Base (2 tools)

| Tool | Description |
|---|---|
| `lookup_design_guidance` | Semantic search over the Design Systems Handbook + your custom refs |
| `search_knowledge_chunks` | Search specific content chunks — returns precise excerpts |
| `browse_design_knowledge_by_category` | Browse all entries by category (architecture / components / tokens / a11y) |
| `get_knowledge_tags` | List all available tags and categories in the knowledge base |
| `ingest_design_reference` | Add articles or guidelines to the local knowledge base |

**Built-in:** Design Systems Handbook (DesignBetter.Co / InVision) — 7 chapters, 104 searchable chunks.

**Add your own PDFs:**
```bash
python3 local-content-library/scripts/ingest-pdf.py path/to/your-book.pdf
```

---

## 💬 Example Prompts

```
"Design a mobile onboarding screen with 3 steps"
"Install shadcn tokens with Light and Dark modes"
"Review this card component for token coverage and accessibility issues"
"Rename all generic layer names to semantic names"
"Convert this selected frame to React with Tailwind"
"Show me the token coverage report for this page"
"Preview this button component in all tenant themes side by side"
"Generate a Jira ticket for this login screen"
"What does the Design Systems Handbook say about token architecture?"
```

---

## 🖥 Interactive MCP Apps

FigmaMCP includes two interactive UI panels that render directly inside Claude Desktop — just like the originals from figma-console-mcp.

### Enable MCP Apps

Add `ENABLE_MCP_APPS` to your Claude Desktop config:

```json
{
  "mcpServers": {
    "figmamcp": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/FigmaMCP/dist/local.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "ENABLE_MCP_APPS": "true"
      }
    }
  }
}
```

### Token Browser
Ask Claude: *"browse the design tokens"* or *"show me the design tokens"*

Opens an interactive token explorer with:
- All collections with expandable sections
- Filter by type (Colors, Numbers, Strings)
- Per-collection mode columns (Light/Dark/Custom)
- Color swatches with hex values + click-to-copy

### Design System Dashboard
Ask Claude: *"audit the design system"* or *"show me design system health"*

Opens a Lighthouse-style scorecard with:
- Overall score (0–100) with A–F grade
- Six category gauges: Naming, Tokens, Components, Accessibility, Consistency, Coverage
- Actionable findings with severity levels

---

## ⚙️ Environment Variables

| Variable | Required | Used for |
|---|---|---|
| `FIGMA_ACCESS_TOKEN` | For REST tools | Reading files, comments, version history |
| `ANTHROPIC_API_KEY` | For AI tools | Design review, intent generation, smart naming |
| `FIGMA_FILE_KEY` | Optional | Default file for REST calls |
| `FIGMA_WS_PORT` | Optional | Override WebSocket port (default: 9223) |
| `FIGMA_WS_HOST` | Optional | Override bind address (use `0.0.0.0` for Docker) |
| `OPENAI_API_KEY` | Optional fallback | If Anthropic unavailable |
| `GOOGLE_API_KEY` | Optional fallback | If Anthropic + OpenAI unavailable |

---

## 🏛 Architecture

```
Claude (LLM)
    │
    ▼
FigmaMCP MCP Server (stdio)
    │
    ├─ Layer 1:  figma-console-mcp base (65 tools)
    │            REST API + Desktop Bridge WebSocket
    │
    ├─ Layer 2:  Component Synthesis Engine
    │            JSX parser → Figma Plugin API code generator
    │            (ported from figma-cli)
    │
    ├─ Layer 3:  Token Orchestration Engine
    │            Tailwind/shadcn/Radix presets + bi-directional sync
    │
    ├─ Layer 4:  Intelligence Engine
    │            ComponentConsistencyEngine + TokenAnalyzer + NamingFixer
    │            (ported from figmalint, runs server-side)
    │
    ├─ Layer 5:  Code Bridge
    │            React + CSS + Code Connect generation
    │
    ├─ Layer 6:  Workflow Engine
    │            Handoff specs + Jira tickets + changelogs
    │
    ├─ Layer 7:  Theme Runtime
    │            Multi-tenant token switching + 3-layer chain validation
    │
    ├─ Layer 8:  Accessibility Engine
    │            WCAG audit + colorblind simulation (Daltonization)
    │
    └─ Layer 9:  Knowledge RAG
                 Local content library + optional remote search
                 (architecture from design-systems-mcp)
    │
    ▼
MCP Bridge Plugin (Figma Desktop)
    │ WebSocket ws://localhost:9223–9232
    ▼
Figma Design File
```

---

## 🔧 Troubleshooting

**"MCP Bridge plugin not connected"**
- Make sure Figma Desktop is running (not browser)
- Check the MCP Bridge plugin is running (green dot)
- Try: Plugins → Development → Reload plugin

**"FIGMA_ACCESS_TOKEN not set"**
- REST API tools need this; Desktop Bridge tools don't
- Restart Claude Desktop after adding to config

**"ANTHROPIC_API_KEY not set"**
- Only needed for AI-powered tools
- All other tools work without it

**Port conflict**
- If port 9223 is taken, FigmaMCP auto-tries 9224–9232
- Set `FIGMA_WS_PORT=9230` in config to use a specific port

---

## 📦 Built On

| Repo | Contribution |
|---|---|
| [figma-console-mcp](https://github.com/southleft/figma-console-mcp) | Base MCP server, 65 tools, Desktop Bridge — kept 100% intact |
| [figma-cli](https://github.com/silships/figma-cli) | JSX renderer + token presets — ported to TypeScript |
| [figmalint](https://github.com/figmalint/figmalint) | AI intelligence classes — ported server-side |
| [design-systems-mcp](https://github.com/southleft/design-systems-mcp) | Knowledge base architecture — local-first |
| [Design Systems Handbook](https://www.designbetter.co/design-systems-handbook) | DesignBetter.Co / InVision — bundled knowledge |

---

## 📄 License

MIT — see [LICENSE](./LICENSE)
