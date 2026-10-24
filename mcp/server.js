#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolSchemas, toolDescriptions } from './schemas.js';
import { handleTool } from './handlers.js';

// Factory is import-safe: no transport, stdin listener, child or connection.
export function createServer() {
  const server=new McpServer({name:'destiny-telling',version:'0.1.0'});
  for (const [name,inputSchema] of Object.entries(toolSchemas)) {
    server.registerTool(name,{
      description:toolDescriptions[name],inputSchema,
      annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    },input=>handleTool(name,input));
  }
  return server;
}

// Node >=25.9 identifies the entry module even when invoked through a bin symlink.
if (import.meta.main) {
  const server=createServer();
  process.stdin.once('end',()=>{void server.close();});
  try {
    await server.connect(new StdioServerTransport());
  } catch {
    // Fail closed without protocol-corrupting stdout or sensitive exception text.
    await server.close();
    process.exitCode=1;
  }
}
