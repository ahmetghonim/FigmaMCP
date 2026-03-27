# FigmaMCP Setup Guide
## Figma Design Intelligence System

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18.0 | `node --version` to check |
| Figma Desktop | Latest | Required for write operations |
| Claude Desktop or Claude CLI | Latest | The MCP client |
| npm | ≥ 9 | Comes with Node.js |

---

## Step 1 — Install the Package

### Option A: npm (recommended)
```bash
npm install -g figmamcp
```

### Option B: From source
```bash
git clone <your-repo-url>
cd FigmaMCP
npm install
npm run build
```

---

## Step 2 — Install the Figma Plugin (Desktop Bridge)

The plugin bridges Claude → your Figma file via WebSocket.

1. Open **Figma Desktop** (must be the desktop app, not browser)
2. Menu → **Plugins** → **Development** → **Import plugin from manifest...**
3. Navigate to the plugin directory:
   - **If installed via npm:** `$(npm root -g)/figmamcp/figma-desktop-bridge/manifest.json`
   - **If from source:** `./figma-desktop-bridge/manifest.json`
4. Click **Open**
5. The **MCP Bridge** plugin now appears under **Plugins → Development**
6. Run it: **Plugins → Development → MCP Bridge**
   - A small panel shows connection status
   - You should see a **green connected indicator** within a few seconds

> **Tip:** Right-click the plugin → "Pin to toolbar" for persistent one-click access.

---

## Step 3 — Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "figmamcp": {
      "command": "npx",
      "args": ["figmamcp"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_your_personal_access_token",
        "ANTHROPIC_API_KEY": "sk-ant-your_api_key"
      }
    }
  }
}
```

**Restart Claude Desktop** after saving.

---

## Step 4 — Configure Claude CLI (Claude Code)

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "figmamcp": {
      "command": "npx",
      "args": ["figmamcp"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_your_personal_access_token",
        "ANTHROPIC_API_KEY": "sk-ant-your_api_key"
      }
    }
  }
}
```

---

## Step 5 — Get Your API Keys

### Figma Personal Access Token
Required for: reading file data, getting components/styles, comments, version history.

1. Go to **Figma.com → Account Settings → Security**
2. Scroll to **Personal access tokens** → **Generate new token**
3. Name it "figmamcp" — permissions: **File content read**, **Variables read/write**
4. Copy the token and add to `FIGMA_ACCESS_TOKEN` in your MCP config

### Anthropic API Key
Required for: `analyze_design_quality` (AI-enhanced), `generate_ui_from_intent`, `infer_token_candidates` (AI mode).
All tools work without this key in rule-based mode — just with less nuanced output.

1. Go to **console.anthropic.com**
2. Create a new API key
3. Add to `ANTHROPIC_API_KEY` in your MCP config

---

## Step 6 — Verify Connection

1. Open Figma Desktop with any design file
2. Run **MCP Bridge** plugin (Plugins → Development → MCP Bridge)
3. Wait for green indicator
4. Open Claude Desktop or Claude CLI
5. Type: `"What's the status of my Figma connection?"`
   - Claude will call `figma_get_status` and confirm connection

---

## Environment Variables Reference

| Variable | Required | Used For |
|---|---|---|
| `FIGMA_ACCESS_TOKEN` | For REST API tools | Reading files, comments, version history |
| `ANTHROPIC_API_KEY` | For AI-powered tools | Design review, intent generation, enhanced naming |
| `FIGMA_FILE_KEY` | Optional shorthand | Default file for REST calls |
| `OPENAI_API_KEY` | Optional fallback | If Anthropic unavailable |
| `GOOGLE_API_KEY` | Optional fallback | If Anthropic + OpenAI unavailable |
| `DESIGN_SYSTEMS_MCP_URL` | Optional remote RAG | Connect to remote design knowledge base |

---

## Optional: Add Books to Knowledge Base

FigmaMCP ships with the **Design Systems Handbook** pre-ingested (7 chapters, 104 chunks).

To add your own PDFs:

```bash
# Drop the PDF in the books folder
cp "YourBook.pdf" "$(npm root -g)/figmamcp/local-content-library/books/"

# Run the ingestion script
python3 "$(npm root -g)/figmamcp/local-content-library/scripts/ingest-pdf.py" \
  "$(npm root -g)/figmamcp/local-content-library/books/YourBook.pdf" \
  --name "Book Title Here"
```

The book is now searchable via `lookup_design_guidance`.

---

## Tool Quick Reference

### Design Creation
```
figma_render_jsx           — JSX string → real Figma nodes
figma_render_jsx_batch     — Multiple JSX frames in one call
generate_ui_from_intent    — "A login screen with email/password" → full design
```

### Token Management
```
figma_create_token_preset  — Install Tailwind/shadcn/Radix/IDS preset
sync_design_tokens         — Pull/push/diff tokens.json ↔ Figma variables
measure_token_adoption     — % of designs using tokens vs hardcoded values
migrate_token_structure    — Batch rename tokens (primary → action/primary)
```

### AI Intelligence
```
analyze_design_quality     — Full component audit (score + grade + findings)
infer_token_candidates     — Find hardcoded values that should be tokens
semantic_layer_naming      — Rename Frame 47 → card-header automatically
figma_autofix_issues       — Apply all found issues automatically
```

### Code Generation
```
synthesize_component_react — Figma frame → React + Tailwind component
extract_computed_styles    — Figma frame → CSS
link_design_to_code        — Generate Code Connect .figma.tsx file
```

### Workflow
```
generate_handoff_documentation  — Full dev spec for selected frames
create_dev_ticket_from_design   — Figma frame → Jira/Linear ticket
summarize_design_feedback       — Open comments → priority digest
generate_design_changelog       — Version history → Markdown changelog
```

### Multi-Tenant (Mondia/Monsooq)
```
apply_theme_context        — Switch tenant theme on selected frames
validate_theme_integrity   — Audit 3-layer token chain (Theme→Brand→Semantic)
render_multi_theme_preview — Same component in all tenant themes side-by-side
```

### Accessibility
```
figma_audit_a11y           — WCAG AA/AAA audit (contrast, touch targets, text)
figma_simulate_colorblind  — Protanopia/deuteranopia/tritanopia preview
audit_design_system_usage  — Find unused components, detached instances
```

### Knowledge
```
lookup_design_guidance     — Search Design Systems Handbook + your references
ingest_design_reference    — Add articles/guidelines to knowledge base
```

---

## Troubleshooting

### "Desktop Bridge not connected"
- Ensure Figma Desktop is running (not browser)
- Check MCP Bridge plugin is running (green dot)
- Try: Plugins → Development → Reload plugin
- Check port 9223 isn't blocked by firewall

### "FIGMA_ACCESS_TOKEN not set"
- REST API tools require this; Desktop Bridge tools don't
- Restart Claude Desktop after adding to config

### "ANTHROPIC_API_KEY not set"
- Only needed for AI-powered tools
- Rule-based mode works without it (less nuanced output)

### Claude doesn't see FigmaMCP tools
- Restart Claude Desktop after config changes
- Run `npx figmamcp` manually to check for errors
- Verify `npx figmamcp` resolves: `which figmamcp` or `npx figmamcp --version`

---

## Architecture Overview

```
Claude (LLM)
    │
    ▼
FigmaMCP MCP Server (stdio)          ← This package
    │
    ├── Layer 1: figma-console-mcp base (65 tools)
    │   └── REST API + Desktop Bridge
    │
    ├── Layer 2: Component Synthesis
    │   └── JSX → Figma nodes
    │
    ├── Layer 3: Token Orchestration
    │   └── Tailwind/shadcn/Radix + bi-directional sync
    │
    ├── Layer 4: Intelligence Engine
    │   └── Ported from figmalint: TokenAnalyzer + ConsistencyEngine + NamingFixer
    │
    ├── Layer 5: Code Bridge
    │   └── React + CSS + Code Connect
    │
    ├── Layer 6: Workflow
    │   └── Handoff + Jira tickets + Changelog
    │
    ├── Layer 7: Theme Runtime
    │   └── Multi-tenant token switching + validation
    │
    ├── Layer 8: Accessibility
    │   └── WCAG audit + colorblind simulation
    │
    └── Layer 9: Knowledge RAG
        └── Local content library + optional remote search
            │
    ┌───────┘
    │
    ▼
MCP Bridge Plugin (Figma Desktop)
    │
    ▼
Figma Design File
```
