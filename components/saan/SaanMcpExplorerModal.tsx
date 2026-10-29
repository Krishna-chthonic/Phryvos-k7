"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Wrench,
  Database,
  MessageSquare,
  Play,
  RefreshCw,
  X,
  Copy,
  Check,
  Code,
  Terminal,
} from "lucide-react";

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

interface SaanMcpExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanMcpExplorerModal({
  isOpen,
  onClose,
}: SaanMcpExplorerModalProps) {
  const [activeTab, setActiveTab] = useState<"tools" | "resources" | "prompts" | "console">("tools");
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [protocolVersion, setProtocolVersion] = useState<string>("2024-11-05");
  const [serverInfo, setServerInfo] = useState<any>({ name: "saan-k7-mcp", version: "1.0.0" });

  // Tool execution
  const [selectedTool, setSelectedTool] = useState<string>("echo");
  const [toolArgs, setToolArgs] = useState<string>('{\n  "message": "Saan MCP Ping 2026"\n}');
  const [toolResult, setToolResult] = useState<any>(null);

  // Resource reader
  const [selectedResource, setSelectedResource] = useState<string>("saan://status");
  const [resourceContent, setResourceContent] = useState<string>("");

  // Raw JSON-RPC Console
  const [rawRpcRequest, setRawRpcRequest] = useState<string>(
    JSON.stringify(
      {
        jsonrpc: "2.0",
        id: "test-rpc-1",
        method: "tools/call",
        params: {
          name: "echo",
          arguments: { message: "Hello from Sovereign MCP Bridge!" },
        },
      },
      null,
      2
    )
  );
  const [rawRpcResponse, setRawRpcResponse] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_mcp_overview" }),
      });
      const data = await res.json();
      if (data.ok) {
        setTools(data.tools || []);
        setResources(data.resources || []);
        setPrompts(data.prompts || []);
        if (data.protocolVersion) setProtocolVersion(data.protocolVersion);
        if (data.serverInfo) setServerInfo(data.serverInfo);
      }
    } catch (e) {
      console.error("Failed to load MCP overview", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOverview();
    }
  }, [isOpen]);

  const handleExecuteTool = async () => {
    try {
      setLoading(true);
      let parsed = {};
      try {
        parsed = JSON.parse(toolArgs);
      } catch (e) {
        alert("Invalid JSON in tool arguments");
        return;
      }

      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dispatch_mcp_jsonrpc",
          request: {
            jsonrpc: "2.0",
            id: `call_${Date.now()}`,
            method: "tools/call",
            params: {
              name: selectedTool,
              arguments: parsed,
            },
          },
        }),
      });
      const data = await res.json();
      setToolResult(data.response);
    } catch (e) {
      console.error("Tool execution error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleReadResource = async (uri: string) => {
    try {
      setLoading(true);
      setSelectedResource(uri);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dispatch_mcp_jsonrpc",
          request: {
            jsonrpc: "2.0",
            id: `read_${Date.now()}`,
            method: "resources/read",
            params: { uri },
          },
        }),
      });
      const data = await res.json();
      const content = data.response?.result?.contents?.[0]?.text || JSON.stringify(data.response, null, 2);
      setResourceContent(content);
    } catch (e) {
      console.error("Resource read error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRawRpc = async () => {
    try {
      setLoading(true);
      let parsed;
      try {
        parsed = JSON.parse(rawRpcRequest);
      } catch (e) {
        alert("Invalid JSON in RPC request");
        return;
      }

      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dispatch_mcp_jsonrpc",
          request: parsed,
        }),
      });
      const data = await res.json();
      setRawRpcResponse(JSON.stringify(data.response, null, 2));
    } catch (e) {
      console.error("JSON-RPC error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-zinc-950 border border-violet-500/30 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Model Context Protocol (MCP 2.x) Bridge
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Repo #35
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 font-mono">
                  v{protocolVersion}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Standardized JSON-RPC 2.0 tool discovery, resource extraction & prompt templates
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchOverview}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Refresh MCP registry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 px-6 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 text-xs">
          <button
            onClick={() => setActiveTab("tools")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "tools"
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Tools ({tools.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "resources"
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Resources ({resources.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("prompts")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "prompts"
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Prompts ({prompts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("console")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "console"
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>JSON-RPC Console</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "tools" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tools.map((t) => (
                  <div
                    key={t.name}
                    onClick={() => {
                      setSelectedTool(t.name);
                      if (t.name === "echo") setToolArgs('{\n  "message": "Ping Saan"\n}');
                      if (t.name === "health_check") setToolArgs('{\n  "verbose": true\n}');
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      selectedTool === t.name
                        ? "bg-violet-950/30 border-violet-500/50"
                        : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-violet-300">{t.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">
                        mcp-tool
                      </span>
                    </div>
                    <p className="text-zinc-400 mb-2">{t.description}</p>
                    <pre className="p-2 rounded bg-zinc-950 border border-zinc-800/60 font-mono text-[11px] text-zinc-400 overflow-x-auto">
                      {JSON.stringify(t.inputSchema.properties || {}, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Execution Drawer */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300">
                    Execute Tool: <span className="text-violet-400 font-mono">{selectedTool}</span>
                  </span>
                  <button
                    onClick={handleExecuteTool}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Call Tool</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={toolArgs}
                  onChange={(e) => setToolArgs(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  placeholder="Tool arguments in JSON format..."
                />
                {toolResult && (
                  <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-violet-300 overflow-x-auto">
                    {JSON.stringify(toolResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {activeTab === "resources" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resources.map((r) => (
                  <div
                    key={r.uri}
                    className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-white block">{r.name}</span>
                      <span className="font-mono text-violet-400 text-[11px]">{r.uri}</span>
                      <span className="text-zinc-500 text-[10px] block mt-0.5">
                        {r.mimeType || "text/plain"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleReadResource(r.uri)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                    >
                      Read
                    </button>
                  </div>
                ))}
              </div>

              {resourceContent && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-300 font-mono">{selectedResource}</span>
                    <button
                      onClick={() => handleCopy(resourceContent)}
                      className="flex items-center space-x-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                    >
                      {copied ? <Check className="w-3 h-3 text-violet-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? "Copied" : "Copy Content"}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-violet-300 whitespace-pre-wrap overflow-x-auto">
                    {resourceContent}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === "prompts" && (
            <div className="space-y-3 text-xs">
              {prompts.map((p) => (
                <div key={p.name} className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-mono text-sm">{p.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      MCP Prompt Template
                    </span>
                  </div>
                  <p className="text-zinc-400">{p.description}</p>
                  {p.arguments && p.arguments.length > 0 && (
                    <div className="mt-2 text-[11px] font-mono text-zinc-400">
                      Arguments: {p.arguments.map((a) => `${a.name}${a.required ? " (required)" : ""}`).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "console" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Raw JSON-RPC 2.0 Request</label>
                <textarea
                  rows={6}
                  value={rawRpcRequest}
                  onChange={(e) => setRawRpcRequest(e.target.value)}
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-zinc-200 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleExecuteRawRpc}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition"
                >
                  <Play className="w-4 h-4" />
                  <span>Send JSON-RPC Request</span>
                </button>
              </div>

              {rawRpcResponse && (
                <div>
                  <label className="block text-zinc-400 mb-1">JSON-RPC Response</label>
                  <pre className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-violet-300 overflow-x-auto">
                    {rawRpcResponse}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span>Anthropic Model Context Protocol 2.x JSON-RPC Bridge Running</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
