# FigmaMCP Setup Guide

> Step-by-step setup for Claude Desktop, Claude CLI, and Cursor.

---

## ✅ Prerequisites

| Requirement | Where to get it |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) → check with `node --version` |
| Figma Desktop | [figma.com/downloads](https://www.figma.com/downloads/) — must be desktop, not browser |
| Claude Desktop or Claude CLI | [claude.ai/download](https://claude.ai/download) |
| Git | Usually pre-installed on Mac — check with `git --version` |

---

## 📦 Installation

### 1. Clone and build

```bash
git clone https://github.com/ahmetghonim/FigmaMCP.git
cd FigmaMCP
npm install
npm run build:local
```

You should see:
```
> figmamcp@1.0.0 build:local
> tsc -p tsconfig.local.json
```
No errors = ✅ ready.

### 2. Test the server

```bash
node dist/local.js
```

Expected output:
```
INFO: FDIS WebSocket bridge listening on ws://localhost:9223
INFO: FigmaMCP running on stdio — ready for Claude ✓
```

Press `Ctrl+C` to stop (Claude Desktop will start it automatically).

---

## 🔌 Install the MCP Bridge Plugin in Figma

This plugin is the bridge between Claude and your Figma file. One-time setup.

1. Open **Figma Desktop** (not the browser)
2. Menu bar → **Plugins** → **Development** → **Import plugin from manifest...**
3. Navigate to and select:
   ```
   /Users/YOUR_USERNAME/FigmaMCP/MCP-Bridge-Plugin/manifest.json
   ```
4. The plugin now appears under **Plugins → Development → MCP Bridge**
5. Click it to run — you'll see a small panel with a connection indicator

> 💡 **Tip:** Right-click the plugin → "Pin to toolbar" so it's always one click away.

---

## ⚙️ Configure Your AI Client

### Claude Desktop

**Where is the config file?**

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Open the file in any text editor and add:

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

> ⚠️ Replace `/Users/YOUR_USERNAME` with your actual path.
> To find it: open Terminal and type `echo $HOME`

**Restart Claude Desktop** after saving the file.

---

### Claude CLI (Claude Code)

```bash
claude mcp add figmamcp -s user \
  -e FIGMA_ACCESS_TOKEN=figd_your_token \
  -e ANTHROPIC_API_KEY=sk-ant-your_key \
  -- node /Users/YOUR_USERNAME/FigmaMCP/dist/local.js
```

Or add manually to `~/.claude/settings.json`:

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

---

### Cursor

Add to Cursor Settings → MCP:

```json
{
  "figmamcp": {
    "command": "node",
    "args": ["/Users/YOUR_USERNAME/FigmaMCP/dist/local.js"],
    "env": {
      "FIGMA_ACCESS_TOKEN": "figd_your_token_here"
    }
  }
}
```

---

## 🔑 Getting Your API Keys

### Figma Personal Access Token

Required for: reading files, components, styles, comments, version history.

1. Go to **figma.com** → click your profile photo → **Settings**
2. Scroll to **Security** → **Personal access tokens**
3. Click **Generate new token**
4. Name it `FigmaMCP`
5. Set permissions: ✅ **File content** (read) + ✅ **Variables** (read/write)
6. Copy the token — it starts with `figd_`

> ⚠️ Save it immediately — Figma only shows it once.

### Anthropic API Key

Required for: `analyze_design_quality`, `generate_ui_from_intent`, `semantic_layer_naming` (AI mode), `infer_token_candidates` (AI mode).

> All tools work without this key — AI just provides more nuanced output when present.

1. Go to **console.anthropic.com**
2. Sign in → **API Keys** → **Create Key**
3. Copy the key — it starts with `sk-ant-`

---

## ✅ Verify Everything Works

1. Open Figma Desktop with any design file
2. Run **Plugins → Development → MCP Bridge**
3. Wait for the green dot ✅
4. Open Claude Desktop (restart if you just added the config)
5. Ask Claude:

> *"What's the status of my Figma connection?"*

Claude will call `figma_get_status` and confirm the bridge is live. From there all 97 tools are available.

---

## 📚 Add Books to the Knowledge Base

FigmaMCP ships with the **Design Systems Handbook** pre-loaded (7 chapters, 104 searchable chunks).

To add your own PDF books:

```bash
cd ~/FigmaMCP

# Example: Add "Atomic Design" by Brad Frost
python3 local-content-library/scripts/ingest-pdf.py \
  path/to/atomic-design.pdf \
  --name "Atomic Design by Brad Frost"
```

The book is immediately searchable via `lookup_design_guidance`.

---

## 🌍 Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `FIGMA_ACCESS_TOKEN` | — | Figma Personal Access Token (`figd_...`) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key for AI-powered tools |
| `FIGMA_WS_PORT` | `9223` | WebSocket server port |
| `FIGMA_WS_HOST` | `localhost` | WebSocket bind address (use `0.0.0.0` for Docker) |
| `FIGMA_FILE_KEY` | — | Default Figma file key for REST API calls |
| `OPENAI_API_KEY` | — | OpenAI fallback (if Anthropic unavailable) |
| `GOOGLE_API_KEY` | — | Google Gemini fallback |

---

## 🐛 Troubleshooting

### "MCP Bridge plugin not connected"
```
✗ FDIS Bridge plugin not connected
```
- Make sure **Figma Desktop** is open (not Figma in browser)
- Check the **MCP Bridge** plugin panel is visible and showing green
- Try: **Plugins → Development → Reload plugin**
- Verify port 9223 isn't blocked: `lsof -i :9223`

### "FIGMA_ACCESS_TOKEN not set"
- Desktop Bridge tools (write, create, edit) work without this token
- REST API tools (read file data, comments) need it
- Double-check the path in your config is absolute (not `~/`)
- Restart Claude Desktop after any config change

### "ANTHROPIC_API_KEY not set"
- This only affects AI-enhanced tools
- All 97 tools still work — AI tools use rule-based analysis as fallback
- The fallback is clearly marked in tool responses

### Claude doesn't see FigmaMCP tools
- Check the config file has valid JSON (no trailing commas)
- Verify the path: `ls /Users/YOUR_USERNAME/FigmaMCP/dist/local.js`
- Restart Claude Desktop completely (quit from menu bar, not just close window)
- Run `node /Users/YOUR_USERNAME/FigmaMCP/dist/local.js` manually to check for errors

### Port conflict
```
Error: Could not bind WebSocket server on ports 9223–9232
```
Set a custom port in your config:
```json
"env": {
  "FIGMA_WS_PORT": "9240"
}
```

---

## 🔄 Updating FigmaMCP

```bash
cd ~/FigmaMCP
git pull
npm install
npm run build:local
```

Then restart Claude Desktop.

---

## 🏗 How It Works

```
You (in Claude)
    │  "Design a login screen"
    ▼
Claude (LLM)
    │  calls figma_render_jsx tool
    ▼
FigmaMCP Server (running locally)
    │  generates Figma Plugin API code from JSX
    ▼
MCP Bridge Plugin (in Figma Desktop)
    │  executes the code via postMessage
    ▼
Figma API
    │  creates real nodes in your file
    ▼
Your Figma file ✨
```

The server starts automatically when Claude needs it — you don't need to run it manually.
