#!/usr/bin/env node
/**
 * Script para verificar se o schema está compatível com Gemini
 */

const { MCPThermalPrintServer } = require('./dist/server.js');
const { WebSocketManager } = require('./dist/components/websocket.js');
const { createServer } = require('http');

const httpServer = createServer();
const wsManager = new WebSocketManager(httpServer);
wsManager.initialize();

const server = new MCPThermalPrintServer({
  name: 'mcp-thermal-print-server',
  version: '1.0.0',
  idStore: 1,
  idUser: 1
});

server.setWebSocketManager(wsManager);

server.initialize().then(() => {
  const tools = server.getToolDefinitions();
  const tool = tools[0];
  
  console.log('\n📋 Ferramenta MCP: ' + tool.name);
  console.log('━'.repeat(60));
  
  const json = JSON.stringify(tool.inputSchema);
  
  // Verificar campos não suportados pelo Gemini
  const hasExclusiveMin = json.includes('exclusiveMinimum');
  const hasExclusiveMax = json.includes('exclusiveMaximum');
  
  if (hasExclusiveMin || hasExclusiveMax) {
    console.log('❌ ERRO: Schema contém campos não suportados pelo Gemini!');
    if (hasExclusiveMin) console.log('   - Encontrado: exclusiveMinimum');
    if (hasExclusiveMax) console.log('   - Encontrado: exclusiveMaximum');
    console.log('\n⚠️  Execute: npm run build');
    process.exit(1);
  } else {
    console.log('✅ Schema compatível com Gemini');
    console.log('✅ Sem exclusiveMinimum ou exclusiveMaximum');
  }
  
  // Mostrar propriedades
  console.log('\n📝 Propriedades:');
  Object.keys(tool.inputSchema.properties).forEach(prop => {
    const isRequired = tool.inputSchema.required.includes(prop);
    const mark = isRequired ? '✓' : '○';
    console.log(`   ${mark} ${prop}`);
  });
  
  console.log('\n📄 Schema completo:');
  console.log(JSON.stringify(tool.inputSchema, null, 2));
  
  console.log('\n━'.repeat(60));
  console.log('✅ Verificação concluída com sucesso!');
  console.log('\n💡 Próximos passos:');
  console.log('   1. Reinicie o servidor MCP: npm start');
  console.log('   2. Reinicie o cliente que usa o MCP');
  console.log('   3. Limpe o cache do cliente se necessário');
  
  wsManager.close();
  httpServer.close();
}).catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
