#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from 'express';
import crypto from 'crypto';

const app = express();
const server = new McpServer({ name: "minimal-server", version: "1.0.0" });
const transports = new Map();

// Tool de exemplo
server.tool(
    "hello",
    "Retorna uma saudação",
    { nome: z.string().describe("Nome da pessoa") },
    async ({ nome }) => ({
        content: [{ type: "text" as const, text: `Olá, ${nome}!` }]
    })
);

// Endpoint MCP
app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = transports.get(sessionId);
    
    if (!transport && (req.method === 'POST' || req.method === 'GET')) {
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => {
                console.log(`[MCP] Session initialized: ${id}`);
                transports.set(id, transport);
            }
        });
        await server.connect(transport);
        console.log(`[MCP] Transport created and connected`);
    }
    
    if (transport) {
        await transport.handleRequest(req, res);
    } else {
        res.status(400).json({ error: 'No session' });
    }
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', transport: 'streamable-http' });
});

app.listen(3001, () => console.log('Minimal MCP Server running on port 3001'));
