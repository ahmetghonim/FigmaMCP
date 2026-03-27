#!/usr/bin/env node
/**
 * FDIS — Figma Design Intelligence System
 * stdio MCP server entrypoint — Claude Desktop & Claude CLI
 *
 * Transport: WebSocket to FDIS Bridge plugin in Figma Desktop
 * Run: node dist/local.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createChildLogger } from "./core/logger.js";
import { FigmaAPI } from "./core/figma-api.js";
import { FigmaWebSocketServer } from "./core/websocket-server.js";
import { WebSocketConnector } from "./core/websocket-connector.js";
import { registerAllTools } from "./tools/index.js";

const logger = createChildLogger({ component: "fdis-server" });

const DEFAULT_PORT = parseInt(process.env.FIGMA_WS_PORT ?? "9223", 10);
const WS_HOST = process.env.FIGMA_WS_HOST ?? "localhost";

// ─── WebSocket server (connects to FDIS Bridge plugin) ────────────────────────

let _wsServer: FigmaWebSocketServer | null = null;
let _connector: WebSocketConnector | null = null;

async function getDesktopConnector(): Promise<WebSocketConnector> {
  if (_connector) return _connector;
  if (!_wsServer) throw new Error("WebSocket server not started yet");

  if (!_wsServer.isClientConnected()) {
    throw new Error(
      "FDIS Bridge plugin not connected. Open Figma Desktop, run Plugins → Development → FDIS Bridge, and wait for the green dot."
    );
  }

  _connector = new WebSocketConnector(_wsServer);
  await _connector.initialize();
  return _connector;
}

// ─── Figma REST API ───────────────────────────────────────────────────────────

let _figmaApi: FigmaAPI | null = null;

async function getFigmaAPI(): Promise<FigmaAPI> {
  if (_figmaApi) return _figmaApi;
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN not set. Add it to your MCP server env config."
    );
  }
  _figmaApi = new FigmaAPI({ accessToken: token });
  return _figmaApi;
}

function getCurrentUrl(): string | null {
  const info = _wsServer?.getConnectedFileInfo();
  if (!info?.fileKey) return null;
  return `https://www.figma.com/design/${info.fileKey}`;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function startWebSocketServer(): Promise<void> {
  const portsToTry = Array.from({ length: 10 }, (_, i) => DEFAULT_PORT + i);

  for (const port of portsToTry) {
    try {
      _wsServer = new FigmaWebSocketServer({ port, host: WS_HOST });
      await _wsServer.start();
      logger.info({ port }, `FDIS WebSocket bridge listening on ws://${WS_HOST}:${port}`);
      return;
    } catch {
      _wsServer = null;
    }
  }

  throw new Error(`Could not bind WebSocket server on ports ${DEFAULT_PORT}–${DEFAULT_PORT + 9}`);
}

async function main(): Promise<void> {
  await startWebSocketServer();

  const server = new McpServer({
    name: "fdis",
    version: "1.0.0",
    description:
      "Figma Design Intelligence System — 97 MCP tools: design creation, tokens, AI analysis, code generation, multi-tenant theming, accessibility, and design knowledge.",
  });

  logger.info("Registering FDIS tools...");
  registerAllTools(server, getDesktopConnector, getFigmaAPI, getCurrentUrl);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("FDIS running on stdio — ready for Claude ✓");
  logger.info("Open the FDIS Bridge plugin in Figma to enable write tools");
}

main().catch((err) => {
  logger.error({ err }, "FDIS startup failed");
  process.exit(1);
});
