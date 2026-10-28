/**
 * @file mcp-jsonrpc-bridge.ts
 * @description Clean-room TypeScript implementation of Model Context Protocol (MCP 2.x)
 * JSON-RPC 2.0 protocol handler. Provides standardized tool definitions, input schemas,
 * resource reading, dynamic prompt resolution, and capability negotiation handshakes.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

export const PROTOCOL_VERSION = '2024-11-05';

export class McpJsonRpcBridge {
  private tools = new Map<string, { tool: McpTool; handler: (args: any) => Promise<any> | any }>();
  private resources = new Map<string, { resource: McpResource; reader: (uri: string) => Promise<string> | string }>();
  private prompts = new Map<string, { prompt: McpPrompt; resolver: (args: Record<string, string>) => any[] }>();

  /**
   * Registers a tool conforming to the MCP specification.
   */
  public registerTool(tool: McpTool, handler: (args: any) => Promise<any> | any): void {
    this.tools.set(tool.name, { tool, handler });
  }

  /**
   * Registers an inspectable read-only resource URI.
   */
  public registerResource(resource: McpResource, reader: (uri: string) => Promise<string> | string): void {
    this.resources.set(resource.uri, { resource, reader });
  }

  /**
   * Registers a reusable prompt template.
   */
  public registerPrompt(
    prompt: McpPrompt,
    resolver: (args: Record<string, string>) => any[]
  ): void {
    this.prompts.set(prompt.name, { prompt, resolver });
  }

  /**
   * Dispatches an incoming JSON-RPC request and returns the compliant MCP response.
   */
  public async handleMessage(rawMessage: string | JsonRpcRequest): Promise<JsonRpcResponse | null> {
    let req: JsonRpcRequest;

    if (typeof rawMessage === 'string') {
      try {
        req = JSON.parse(rawMessage);
      } catch {
        return {
          jsonrpc: '2.0',
          id: null,
          error: { code: MCP_ERROR_CODES.PARSE_ERROR, message: 'Parse error' },
        };
      }
    } else {
      req = rawMessage;
    }

    if (!req || req.jsonrpc !== '2.0' || !req.method) {
      return {
        jsonrpc: '2.0',
        id: req?.id ?? null,
        error: { code: MCP_ERROR_CODES.INVALID_REQUEST, message: 'Invalid Request' },
      };
    }

    const id = req.id ?? null;

    try {
      switch (req.method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
              },
              serverInfo: {
                name: 'saan-k7-mcp',
                version: '1.0.0',
              },
            },
          };
        }

        case 'notifications/initialized': {
          // Notifications do not return a response in JSON-RPC
          return null;
        }

        case 'tools/list': {
          const toolList = Array.from(this.tools.values()).map(t => t.tool);
          return {
            jsonrpc: '2.0',
            id,
            result: { tools: toolList },
          };
        }

        case 'tools/call': {
          const { name, arguments: args } = req.params || {};
          const registered = this.tools.get(name);
          if (!registered) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: MCP_ERROR_CODES.INVALID_PARAMS, message: `Tool not found: "${name}"` },
            };
          }

          try {
            const output = await registered.handler(args || {});
            const textContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: textContent }],
                isError: false,
              },
            };
          } catch (toolErr: any) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `Error: ${toolErr.message}` }],
                isError: true,
              },
            };
          }
        }

        case 'resources/list': {
          const resourceList = Array.from(this.resources.values()).map(r => r.resource);
          return {
            jsonrpc: '2.0',
            id,
            result: { resources: resourceList },
          };
        }

        case 'resources/read': {
          const { uri } = req.params || {};
          const registered = this.resources.get(uri);
          if (!registered) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: MCP_ERROR_CODES.INVALID_PARAMS, message: `Resource not found: "${uri}"` },
            };
          }

          const text = await registered.reader(uri);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: registered.resource.mimeType || 'text/plain',
                  text,
                },
              ],
            },
          };
        }

        case 'prompts/list': {
          const promptList = Array.from(this.prompts.values()).map(p => p.prompt);
          return {
            jsonrpc: '2.0',
            id,
            result: { prompts: promptList },
          };
        }

        case 'prompts/get': {
          const { name, arguments: args } = req.params || {};
          const registered = this.prompts.get(name);
          if (!registered) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: MCP_ERROR_CODES.INVALID_PARAMS, message: `Prompt not found: "${name}"` },
            };
          }

          const messages = registered.resolver(args || {});
          return {
            jsonrpc: '2.0',
            id,
            result: {
              description: registered.prompt.description,
              messages,
            },
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: MCP_ERROR_CODES.METHOD_NOT_FOUND, message: `Method not found: ${req.method}` },
          };
      }
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: MCP_ERROR_CODES.INTERNAL_ERROR, message: err.message },
      };
    }
  }
}
