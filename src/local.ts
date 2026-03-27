#!/usr/bin/env node
/**
 * FigmaMCP — Figma Design Intelligence System
 * stdio MCP server entrypoint — Claude Desktop, Claude CLI, Cursor
 *
 * Features:
 * - Auto port range 9223–9232 with fallback
 * - Orphaned process cleanup on startup
 * - Port file advertisement (heartbeat every 30s)
 * - WebSocket bridge to MCP Bridge plugin in Figma Desktop
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createChildLogger } from "./core/logger.js";
import { FigmaAPI } from "./core/figma-api.js";
import { FigmaWebSocketServer } from "./core/websocket-server.js";
import { WebSocketConnector } from "./core/websocket-connector.js";
import {
  DEFAULT_WS_PORT,
  getPortRange,
  cleanupStalePortFiles,
  cleanupOrphanedProcesses,
  advertisePort,
  refreshPortAdvertisement,
  unadvertisePort,
} from "./core/port-discovery.js";
import { registerAllTools } from "./tools/index.js";

const logger = createChildLogger({ component: "figmamcp-server" });

const PREFERRED_PORT = parseInt(process.env.FIGMA_WS_PORT ?? String(DEFAULT_WS_PORT), 10);
const WS_HOST = process.env.FIGMA_WS_HOST ?? "localhost";

// ─── WebSocket server ─────────────────────────────────────────────────────────

let _wsServer: FigmaWebSocketServer | null = null;
let _connector: WebSocketConnector | null = null;
let _actualPort: number | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function getDesktopConnector(): Promise<WebSocketConnector> {
  if (_connector) return _connector;
  if (!_wsServer) throw new Error("WebSocket server not started");

  if (!_wsServer.isClientConnected()) {
    throw new Error(
      "MCP Bridge plugin not connected. Open Figma Desktop → Plugins → Development → MCP Bridge, and wait for the green dot."
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
  if (!token) throw new Error("FIGMA_ACCESS_TOKEN not set. Add it to your MCP config env.");
  _figmaApi = new FigmaAPI({ accessToken: token });
  return _figmaApi;
}

function getCurrentUrl(): string | null {
  if (!_wsServer) return null;
  const info = _wsServer.getConnectedFileInfo();
  if (!info?.fileKey) return null;
  return `https://www.figma.com/design/${info.fileKey}`;
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function startWebSocketServer(): Promise<void> {
  // Phase 1: clean up stale port files + zombie processes from previous sessions
  cleanupStalePortFiles();
  cleanupOrphanedProcesses(PREFERRED_PORT);

  // Phase 2: try each port in range 9223–9232
  const ports = getPortRange(PREFERRED_PORT);

  for (const port of ports) {
    try {
      _wsServer = new FigmaWebSocketServer({ port, host: WS_HOST });
      await _wsServer.start();

      const addr = _wsServer.address();
      _actualPort = addr?.port ?? port;

      // Phase 3: advertise this port so other FDIS instances and the plugin can find us
      advertisePort(_actualPort, WS_HOST);

      // Phase 4: heartbeat — refresh port advertisement every 30s
      _heartbeatTimer = setInterval(() => {
        if (_actualPort) refreshPortAdvertisement(_actualPort);
      }, 30_000);

      logger.info({ port: _actualPort }, `FigmaMCP WebSocket bridge listening on ws://${WS_HOST}:${_actualPort}`);
      return;
    } catch {
      _wsServer = null;
    }
  }

  throw new Error(
    `Could not bind WebSocket server on ports ${PREFERRED_PORT}–${PREFERRED_PORT + ports.length - 1}. ` +
    `Try setting a different FIGMA_WS_PORT in your config.`
  );
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(): void {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  if (_actualPort) unadvertisePort(_actualPort);
  _wsServer?.stop?.();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await startWebSocketServer();

  const server = new McpServer({
    name: "figmamcp",
    version: "1.0.0",
    description:
      "FigmaMCP — 97 MCP tools: design creation, token orchestration, AI analysis, " +
      "code generation, multi-tenant theming, accessibility, and design knowledge.",
  });

  logger.info("Registering FigmaMCP tools...");
  registerAllTools(server, getDesktopConnector, getFigmaAPI, getCurrentUrl);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("FigmaMCP running on stdio — ready for Claude ✓");
  logger.info("Open the MCP Bridge plugin in Figma to enable write tools");
}

main().catch((err) => {
  logger.error({ err }, "FigmaMCP startup failed");
  process.exit(1);
});
