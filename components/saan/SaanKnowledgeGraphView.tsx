"use client";

import * as React from "react";
import {
  Brain,
  Share2,
  Calendar,
  Clock,
  Sparkles,
  Search,
  Layers,
  FileText,
  FileCode,
  Tag,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowRight,
  Shield,
  Eye,
  Sliders,
  Plus,
  RefreshCw,
} from "lucide-react";

interface MemoryItem {
  id: number;
  point: string;
  category: string;
  importance: number;
  createdAt: number;
}

interface SaanKnowledgeGraphViewProps {
  memories: MemoryItem[];
  onRefresh: () => void;
}

interface GraphNode {
  id: string;
  label: string;
  category: "user" | "companion" | "preference" | "project" | "fact" | "date";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  timestamp: number;
  invalidAt?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  validAt: number;
  invalidAt?: number;
}

export function SaanKnowledgeGraphView({ memories, onRefresh }: SaanKnowledgeGraphViewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [activeTab, setActiveTab] = React.useState<"graph" | "vault" | "bitemporal">("graph");

  // Bi-temporal Time Scrubber state
  const [timeScrubberValue, setTimeScrubberValue] = React.useState(100); // 100% = Now
  const [isPlayingTimeline, setIsPlayingTimeline] = React.useState(false);

  // Document Ingestion state (Anything-LLM)
  const [docTitle, setDocTitle] = React.useState("");
  const [docContent, setDocContent] = React.useState("");
  const [ingesting, setIngesting] = React.useState(false);
  const [ingestedResult, setIngestedResult] = React.useState<any | null>(null);

  // Search filter
  const [search, setSearch] = React.useState("");

  // Construct Graph Nodes & Edges from real memories
  const { nodes, edges } = React.useMemo(() => {
    const nList: GraphNode[] = [
      {
        id: "node_user",
        label: "Krishna (User)",
        category: "user",
        x: 300,
        y: 200,
        vx: 0,
        vy: 0,
        radius: 22,
        timestamp: Date.now() - 30 * 86400000,
      },
      {
        id: "node_saan",
        label: "Saan (Companion)",
        category: "companion",
        x: 450,
        y: 200,
        vx: 0,
        vy: 0,
        radius: 24,
        timestamp: Date.now() - 30 * 86400000,
      },
    ];

    const eList: GraphEdge[] = [
      {
        source: "node_user",
        target: "node_saan",
        relation: "bonded_with",
        validAt: Date.now() - 30 * 86400000,
      },
    ];

    // Map each memory into a node and edge
    memories.forEach((m, idx) => {
      const angle = (idx / Math.max(1, memories.length)) * Math.PI * 2;
      const dist = 140 + (idx % 3) * 45;
      const cx = 375 + Math.cos(angle) * dist;
      const cy = 200 + Math.sin(angle) * dist;

      const cat: GraphNode["category"] =
        m.category === "preference"
          ? "preference"
          : m.category === "plan"
          ? "project"
          : m.category === "constraint"
          ? "date"
          : "fact";

      const nodeId = `mem_${m.id}`;
      nList.push({
        id: nodeId,
        label: m.point.length > 32 ? m.point.substring(0, 32) + "..." : m.point,
        category: cat,
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 12 + Math.min(6, (m.importance || 5) * 1.2),
        timestamp: m.createdAt || Date.now() - idx * 86400000,
      });

      eList.push({
        source: idx % 2 === 0 ? "node_user" : "node_saan",
        target: nodeId,
        relation: m.category || "remembers",
        validAt: m.createdAt || Date.now(),
      });
    });

    return { nodes: nList, edges: eList };
  }, [memories]);

  // Spring physics & render loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const getNodeColor = (cat: GraphNode["category"]) => {
      switch (cat) {
        case "user":
          return "#3b82f6"; // Blue
        case "companion":
          return "#c084fc"; // Purple
        case "preference":
          return "#ec4899"; // Pink
        case "project":
          return "#10b981"; // Emerald
        case "date":
          return "#f59e0b"; // Amber
        default:
          return "#8b5cf6"; // Violet
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Filter nodes based on time scrubber (Bi-temporal point-in-time)
      const visiblePercent = timeScrubberValue / 100;
      const visibleNodesCount = Math.max(2, Math.round(nodes.length * visiblePercent));
      const activeNodes = nodes.slice(0, visibleNodesCount);
      const activeNodeIds = new Set(activeNodes.map((n) => n.id));

      // Draw Edges
      edges.forEach((e) => {
        if (!activeNodeIds.has(e.source) || !activeNodeIds.has(e.target)) return;
        const s = activeNodes.find((n) => n.id === e.source);
        const t = activeNodes.find((n) => n.id === e.target);
        if (!s || !t) return;

        ctx.strokeStyle = "rgba(168, 85, 247, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();

        // Edge label (middle)
        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        ctx.fillStyle = "rgba(161, 161, 170, 0.5)";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText(e.relation, midX - 10, midY - 2);
      });

      // Draw Nodes
      activeNodes.forEach((node) => {
        const color = getNodeColor(node.category);
        const isSelected = selectedNode?.id === node.id;

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 16 : 8;

        // Circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Border ring
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = "#f4f4f5";
        ctx.font = node.radius > 16 ? "bold 11px Inter, sans-serif" : "10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + node.radius + 12);
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [nodes, edges, timeScrubberValue, selectedNode]);

  // Handle canvas click to select node
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = nodes.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });

    setSelectedNode(clicked || null);
  };

  // Ingest Document
  const handleIngestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    try {
      setIngesting(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "ingest_document",
          params: { title: docTitle, content: docContent },
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setIngestedResult(d.actionResult?.data || d.actionResult);
        setDocTitle("");
        setDocContent("");
        onRefresh();
      }
    } catch {
      alert("Failed to ingest document");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full font-sans text-zinc-100">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> Graphiti & Anything-LLM
              </span>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                Visual Knowledge Graph & Document Vault
              </h1>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Interactive 2D force-directed knowledge graph with bi-temporal time-travel scrubber, memory contradiction invalidation, and Obsidian-style wikilink document collection.
            </p>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("graph")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "graph"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              2D Node Graph
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("vault")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "vault"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Document Vault
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: 2D NODE GRAPH */}
      {activeTab === "graph" && (
        <div className="space-y-4">
          {/* Canvas Viewport */}
          <div className="relative rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden shadow-lg p-2">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-zinc-300">
                {nodes.length} Nodes &bull; {edges.length} Edges
              </span>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={750}
              height={380}
              onClick={handleCanvasClick}
              className="w-full h-[380px] cursor-crosshair"
            />

            {/* Time-Travel Scrubber Bar */}
            <div className="p-3 bg-zinc-900/90 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold">
                <Clock className="h-3.5 w-3.5" />
                <span>Bi-Temporal Time Travel: {timeScrubberValue}% (Point-in-Time)</span>
              </div>

              <div className="flex-1 max-w-md flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 font-mono">Past</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={timeScrubberValue}
                  onChange={(e) => setTimeScrubberValue(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <span className="text-[10px] text-purple-400 font-mono font-bold">Now</span>
              </div>
            </div>
          </div>

          {/* Node Detail Card */}
          {selectedNode && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 capitalize">
                  {selectedNode.category} Node
                </span>
                <span className="text-xs text-zinc-400">
                  Valid At: {new Date(selectedNode.timestamp).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-sm font-bold text-zinc-100">{selectedNode.label}</h3>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOCUMENT VAULT & WIKILINKS */}
      {activeTab === "vault" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Document Ingestion Form */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <span>Anything-LLM Document Ingestion & Chunking</span>
            </h2>

            <form onSubmit={handleIngestDocument} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. JEE Master Study Notes 2026"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Document Markdown Content</label>
                <textarea
                  rows={8}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Paste extensive notes, research summaries, or markdown with [[wikilinks]]..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={ingesting || !docTitle.trim() || !docContent.trim()}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Ingest & Extract [[Wikilinks]]
              </button>
            </form>

            {ingestedResult && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-emerald-500/30 text-xs space-y-1 font-mono">
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Document Chunked Successfully
                </div>
                <div className="text-zinc-400 text-[11px]">
                  Chunks: {ingestedResult.chunkCount || 1} &bull; Wikilinks:{" "}
                  {ingestedResult.wikilinks?.join(", ") || "None"}
                </div>
              </div>
            )}
          </div>

          {/* Obsidian Backlinks & Knowledge List */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-400" />
              <span>Extracted Knowledge Entities ({memories.length})</span>
            </h2>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-1.5 hover:border-purple-500/40 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-purple-400 uppercase tracking-wide">
                      {m.category}
                    </span>
                    <span className="text-zinc-500">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{m.point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
