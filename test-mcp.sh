#!/bin/bash

echo "Testing MCP Server..."
echo ""

echo "1. Health Check:"
curl -s http://localhost:3000/health | jq
echo ""

echo "2. Initializing MCP Session (GET):"
SESSION_ID=$(curl -s -X GET http://localhost:3000/mcp \
  -H "Accept: text/event-stream" \
  --max-time 1 2>&1 | grep -oP 'mcp-session-id: \K[^\r]+' | head -1)

echo "Session ID: $SESSION_ID"
echo ""

if [ -z "$SESSION_ID" ]; then
  echo "Failed to get session ID, trying direct POST..."
  echo ""
  
  echo "3. Listing Tools (POST without session):"
  curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq
else
  echo "3. Listing Tools (POST with session):"
  curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq
fi
