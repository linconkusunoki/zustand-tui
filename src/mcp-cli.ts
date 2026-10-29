#!/usr/bin/env node
import http from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createZustandMcpServer } from './mcp-server.js';

const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : NaN;
const port =
  !isNaN(cliPort) && cliPort > 0
    ? cliPort
    : Number(process.env.ZUSTAND_MCP_PORT) || Number(process.env.PORT) || 8080;

function checkExistingTuiHealth(targetPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${targetPort}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function run() {
  const isExistingTuiRunning = await checkExistingTuiHealth(port);

  if (isExistingTuiRunning) {
    console.error(
      `[zustand-mcp] Detected existing Zustand TUI server on port ${port}. Bridging stdio to SSE...`
    );

    const bridgeServer = new Server(
      { name: 'zustand-mcp-bridge', version: '0.1.0' },
      { capabilities: { tools: {}, resources: {} } }
    );

    const sseTransport = new SSEClientTransport(
      new URL(`http://localhost:${port}/sse`)
    );
    const sseClient = new Client(
      { name: 'zustand-mcp-stdio-client', version: '0.1.0' },
      { capabilities: {} }
    );

    await sseClient.connect(sseTransport);

    bridgeServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return (await sseClient.listTools()) as any;
    });

    bridgeServer.setRequestHandler(CallToolRequestSchema, async (req) => {
      return (await sseClient.callTool(req.params)) as any;
    });

    bridgeServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      return (await sseClient.listResources()) as any;
    });

    bridgeServer.setRequestHandler(ReadResourceRequestSchema, async (req) => {
      return (await sseClient.readResource(req.params)) as any;
    });

    const stdioTransport = new StdioServerTransport();
    await bridgeServer.connect(stdioTransport);
    console.error(`[zustand-mcp] Bridge connected. AI agent ready on stdio.`);

    const shutdown = async () => {
      console.error(`[zustand-mcp] Closing bridge...`);
      await sseClient.close();
      await bridgeServer.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  // Standalone mode: Start background telemetry & MCP server
  const serverInstance = createZustandMcpServer({ port });

  try {
    await serverInstance.start();
    console.error(`[zustand-mcp] WebSocket telemetry server listening on ws://localhost:${port}`);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      console.error(
        `[zustand-mcp] ERROR: Port ${port} is in use by an unrecognized process.\n` +
          `Specify a different port with --port <number> or set ZUSTAND_MCP_PORT=<number>.`
      );
    } else {
      console.error(`[zustand-mcp] Failed to start WebSocket telemetry server:`, err);
    }
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await serverInstance.connect(transport);
  console.error(`[zustand-mcp] Standalone MCP server running on stdio transport.`);

  const shutdown = async () => {
    console.error(`[zustand-mcp] Shutting down...`);
    await serverInstance.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch((err) => {
  console.error('[zustand-mcp] Fatal error:', err);
  process.exit(1);
});
