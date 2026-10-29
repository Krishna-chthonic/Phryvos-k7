/**
 * @file mcp-jsonrpc-bridge.test.ts
 * @description Comprehensive unit tests for Model Context Protocol (MCP 2.x) JSON-RPC Bridge
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  McpJsonRpcBridge,
  PROTOCOL_VERSION,
  MCP_ERROR_CODES,
  type JsonRpcRequest,
} from '../../lib/saan/mcp-jsonrpc-bridge';

describe('Model Context Protocol (MCP 2.x) Bridge (Repo #35)', () => {
  const bridge = new McpJsonRpcBridge();

  // Register test tools and resources
  bridge.registerTool(
    {
      name: 'add_numbers',
      description: 'Adds two numbers together',
      inputSchema: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
    },
    args => args.a + args.b
  );

  bridge.registerResource(
    {
      uri: 'vault://memories/recent',
      name: 'Recent Memories',
      mimeType: 'text/plain',
    },
    () => 'Memories snapshot: Sovereign local privacy 100% active.'
  );

  bridge.registerPrompt(
    {
      name: 'daily_reflection',
      description: 'Generates daily reflection prompt',
      arguments: [{ name: 'topic', required: true }],
    },
    args => [{ role: 'user', content: `Reflect deeply on topic: ${args.topic}` }]
  );

  test('Handshake - initialize returns protocol version and server capabilities', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    };

    const res = await bridge.handleMessage(req);
    assert.ok(res);
    assert.equal(res.id, 1);
    assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
    assert.equal(res.result.serverInfo.name, 'saan-k7-mcp');
    assert.ok(res.result.capabilities.tools);
    assert.ok(res.result.capabilities.resources);
  });

  test('Notification - notifications/initialized returns null response (no-op ack)', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    const res = await bridge.handleMessage(req);
    assert.equal(res, null);
  });

  test('Tools - tools/list returns registered tools and schema', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'tool-list-1',
      method: 'tools/list',
    };

    const res = await bridge.handleMessage(req);
    assert.ok(res?.result?.tools);
    const tool = res.result.tools.find((t: any) => t.name === 'add_numbers');
    assert.ok(tool);
    assert.equal(tool.description, 'Adds two numbers together');
  });

  test('Tools - tools/call executes tool handler and returns content array', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'call-1',
      method: 'tools/call',
      params: {
        name: 'add_numbers',
        arguments: { a: 40, b: 2 },
      },
    };

    const res = await bridge.handleMessage(req);
    assert.ok(res?.result?.content);
    assert.equal(res.result.isError, false);
    assert.equal(res.result.content[0].text, '42');
  });

  test('Resources - resources/list and resources/read return registered resource URI', async () => {
    const listReq: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'res-list-1',
      method: 'resources/list',
    };
    const listRes = await bridge.handleMessage(listReq);
    assert.ok(listRes?.result?.resources);
    assert.equal(listRes.result.resources[0].uri, 'vault://memories/recent');

    const readReq: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'res-read-1',
      method: 'resources/read',
      params: { uri: 'vault://memories/recent' },
    };
    const readRes = await bridge.handleMessage(readReq);
    assert.ok(readRes?.result?.contents);
    assert.ok(readRes.result.contents[0].text.includes('Sovereign local privacy'));
  });

  test('Prompts - prompts/list and prompts/get evaluate registered template', async () => {
    const getReq: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'prompt-1',
      method: 'prompts/get',
      params: {
        name: 'daily_reflection',
        arguments: { topic: 'Antigravity Autonomous Cognition' },
      },
    };

    const res = await bridge.handleMessage(getReq);
    assert.ok(res?.result?.messages);
    assert.equal(res.result.messages[0].content, 'Reflect deeply on topic: Antigravity Autonomous Cognition');
  });

  test('Error Handling - Invalid method returns METHOD_NOT_FOUND error code', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'bad-1',
      method: 'unknown/method',
    };

    const res = await bridge.handleMessage(req);
    assert.ok(res?.error);
    assert.equal(res.error.code, MCP_ERROR_CODES.METHOD_NOT_FOUND);
  });
});
