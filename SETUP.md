# MCP Thermal Print Server - Setup Documentation

## Project Structure

```
.
├── src/
│   ├── components/     # Business logic components
│   ├── types/          # TypeScript type definitions
│   └── index.ts        # Main entry point
├── tests/              # Test files
├── dist/               # Compiled TypeScript output
├── tsconfig.json       # TypeScript configuration
├── vitest.config.ts    # Vitest test configuration
└── package.json        # Project dependencies and scripts
```

## Dependencies Installed

### Production Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - HTTP server framework
- `socket.io` - WebSocket communication
- `zod` - Schema validation
- `uuid` - Unique ID generation

### Development Dependencies
- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@types/express` - Express type definitions
- `@types/uuid` - UUID type definitions
- `ts-node` - TypeScript execution for development
- `vitest` - Testing framework
- `@vitest/ui` - Vitest UI for test visualization
- `fast-check` - Property-based testing library

## TypeScript Configuration

The project uses strict TypeScript configuration with:
- Strict mode enabled
- ES2020 target
- CommonJS modules
- Source maps for debugging
- Declaration files generation

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled server
- `npm run dev` - Run the server in development mode with ts-node
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Next Steps

The project is now ready for implementation. Follow the tasks in `.kiro/specs/mcp-thermal-print-server/tasks.md` to continue development.
