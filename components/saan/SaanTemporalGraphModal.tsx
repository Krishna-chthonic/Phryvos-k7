"use client";

import React, { useState, useEffect, useMemo } from "react";
import { TemporalEntityEdge, TemporalGraphNode, TemporalGraphSnapshot } from "@/lib/saan/temporal-edge-graph";

interface SaanTemporalGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanTemporalGraphModal({ isOpen, onClose }: SaanTemporalGraphModalProps) {
  const [graphData, setGraphData] = useState<TemporalGraphSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuperseded, setShowSuperseded] = useState(true);
  const [asOfOffsetDays, setAsOfOffsetDays] = useState(0); // 0 = now, -7 = 7 days ago
  const [selectedEdge, setSelectedEdge] = useState<TemporalEntityEdge | null>(null);

  // New Edge Form
  const [newSource, setNewSource] = useState("User");
  const [newRelation, setNewRelation] = useState("LIVES_IN");
  const [newTarget, setNewTarget] = useState("");
  const [newFact, setNewFact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);

  const fetchGraph = async (asOfTimestamp?: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "get_temporal_graph",
          asOf: asOfTimestamp,
        }),
      });
      const data = await res.json();
      if (data.ok && data.graph) {
        setGraphData(data.graph);
      }
    } catch (err) {
      console.error("Failed to load temporal graph:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const asOf = asOfOffsetDays === 0 ? undefined : Date.now() + asOfOffsetDays * 86400000;
      fetchGraph(asOf);
    }
  }, [isOpen, asOfOffsetDays]);

  const handleAddEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource || !newRelation || !newTarget || !newFact) return;

    setIsSubmitting(true);
    setMutationMessage(null);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add_temporal_edge",
          edge: {
            sourceNode: newSource,
            targetNode: newTarget,
            relation: newRelation,
            fact: newFact,
            validAt: Date.now(),
            referenceTime: Date.now(),
            episodes: [`manual_${Date.now()}`],
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.supersededEdgeIds && data.supersededEdgeIds.length > 0) {
          setMutationMessage(`⚡ Edge added! Contradiction resolved: Superseded ${data.supersededEdgeIds.length} edge(s)`);
        } else {
          setMutationMessage(`✅ Edge added successfully`);
        }
        setGraphData(data.graph);
        setNewTarget("");
        setNewFact("");
      }
    } catch (err) {
      console.error("Failed to add edge:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Node coordinate positions in circular layout
  const { nodePositions, filteredEdges } = useMemo(() => {
    if (!graphData) return { nodePositions: new Map<string, { x: number; y: number }>(), filteredEdges: [] };

    const nodes = graphData.nodes;
    const center = { x: 340, y: 220 };
    const radius = 170;
    const pos = new Map<string, { x: number; y: number }>();

    nodes.forEach((node, idx) => {
      // Place Saan in center-left, User in center-right if they exist
      if (node.label.toLowerCase() === "saan") {
        pos.set(node.label, { x: center.x - 70, y: center.y });
      } else if (node.label.toLowerCase() === "user") {
        pos.set(node.label, { x: center.x + 70, y: center.y });
      } else {
        const angle = (idx / (nodes.length || 1)) * 2 * Math.PI;
        pos.set(node.label, {
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
        });
      }
    });

    const targetTime = asOfOffsetDays === 0 ? Date.now() : Date.now() + asOfOffsetDays * 86400000;

    const edges = graphData.edges.filter((e) => {
      const queryMatch =
        !searchQuery ||
        e.sourceNode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.targetNode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.relation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.fact.toLowerCase().includes(searchQuery.toLowerCase());

      const isActive = e.validAt <= targetTime && (!e.invalidAt || e.invalidAt > targetTime);

      if (!showSuperseded && !isActive) return false;
      return queryMatch;
    });

    return { nodePositions: pos, filteredEdges: edges };
  }, [graphData, searchQuery, showSuperseded, asOfOffsetDays]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🕸️</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Bi-Temporal Knowledge Graph</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Graphiti Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Non-destructive bi-temporal edges (<code className="text-cyan-300">valid_at</code>,{" "}
                <code className="text-rose-300">invalid_at</code>) with point-in-time state reconstruction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Toolbar & Time Travel Scrubber */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/30 flex flex-wrap items-center justify-between gap-4">
          {/* Stats Badges */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300">
              Nodes: <span className="text-white font-bold">{graphData?.stats.totalNodes ?? 0}</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-emerald-300">
              Active Edges: <span className="font-bold">{graphData?.stats.activeEdges ?? 0}</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-rose-950/40 border border-rose-800/50 text-rose-300">
              Superseded (Contradictions):{" "}
              <span className="font-bold">{graphData?.stats.supersededEdges ?? 0}</span>
            </div>
          </div>

          {/* Time Scrubber */}
          <div className="flex items-center gap-3 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-xs text-cyan-300 font-mono font-medium">⏳ Time-Travel Scrubber:</span>
            <input
              type="range"
              min="-14"
              max="0"
              step="1"
              value={asOfOffsetDays}
              onChange={(e) => setAsOfOffsetDays(Number(e.target.value))}
              className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-xs font-mono text-slate-300 w-24 text-right">
              {asOfOffsetDays === 0 ? "Present (Now)" : `${asOfOffsetDays}d past`}
            </span>
          </div>

          {/* Search & Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSuperseded}
                onChange={(e) => setShowSuperseded(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
              />
              <span>Show Contradictions</span>
            </label>
            <input
              type="text"
              placeholder="Search entity/relation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main SVG Graph Visualizer */}
          <div className="flex-1 relative bg-slate-950/90 overflow-hidden flex items-center justify-center border-r border-slate-800">
            {loading ? (
              <div className="text-sm font-mono text-slate-400 animate-pulse">Loading Bi-Temporal Graph...</div>
            ) : (
              <svg viewBox="0 0 680 440" className="w-full h-full select-none">
                <defs>
                  <marker id="arrow-active" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                  </marker>
                  <marker id="arrow-superseded" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                </defs>

                {/* Edges */}
                {filteredEdges.map((edge) => {
                  const s = nodePositions.get(edge.sourceNode) || { x: 340, y: 220 };
                  const t = nodePositions.get(edge.targetNode) || { x: 340, y: 220 };
                  const isSuperseded = Boolean(edge.invalidAt);
                  const isSelected = selectedEdge?.id === edge.id;

                  const midX = (s.x + t.x) / 2;
                  const midY = (s.y + t.y) / 2;

                  return (
                    <g key={edge.id} className="cursor-pointer group" onClick={() => setSelectedEdge(edge)}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={isSuperseded ? "#f43f5e" : isSelected ? "#38bdf8" : "#06b6d4"}
                        strokeWidth={isSelected ? 3 : isSuperseded ? 1.5 : 2}
                        strokeDasharray={isSuperseded ? "4 3" : undefined}
                        strokeOpacity={isSuperseded ? 0.6 : 0.8}
                        markerEnd={isSuperseded ? "url(#arrow-superseded)" : "url(#arrow-active)"}
                        className="transition-all duration-200"
                      />
                      {/* Relation Label Pill */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-edge.relation.length * 3.5 - 6}
                          y="-9"
                          width={edge.relation.length * 7 + 12}
                          height="18"
                          rx="4"
                          fill="#090d16"
                          stroke={isSuperseded ? "#f43f5e" : "#0891b2"}
                          strokeWidth="1"
                          strokeOpacity={isSuperseded ? 0.7 : 0.9}
                        />
                        <text
                          textAnchor="middle"
                          y="3"
                          fontSize="9"
                          fontFamily="monospace"
                          fill={isSuperseded ? "#fda4af" : "#a5f3fc"}
                          fontWeight="bold"
                        >
                          {edge.relation}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Nodes */}
                {graphData?.nodes.map((node) => {
                  const p = nodePositions.get(node.label) || { x: 340, y: 220 };
                  const isCompanion = node.label.toLowerCase() === "saan";
                  const isUser = node.label.toLowerCase() === "user";

                  let fill = "#1e293b";
                  let stroke = "#475569";
                  let textColor = "#f1f5f9";

                  if (isCompanion) {
                    fill = "#4c1d95";
                    stroke = "#a855f7";
                  } else if (isUser) {
                    fill = "#0e7490";
                    stroke = "#22d3ee";
                  } else if (node.type === "preference") {
                    fill = "#064e3b";
                    stroke = "#34d399";
                  } else if (node.type === "place") {
                    fill = "#78350f";
                    stroke = "#fbbf24";
                  }

                  return (
                    <g key={node.id} transform={`translate(${p.x}, ${p.y})`} className="cursor-pointer">
                      <circle
                        r={isCompanion || isUser ? 24 : 18}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="2"
                        className="transition-all duration-200 hover:scale-110 filter drop-shadow"
                      />
                      <text
                        textAnchor="middle"
                        y="4"
                        fontSize={isCompanion || isUser ? "10" : "9"}
                        fontWeight="bold"
                        fill={textColor}
                        fontFamily="sans-serif"
                      >
                        {node.label.length > 8 ? node.label.slice(0, 7) + "…" : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Right Sidebar: Details Drawer & Add Edge Form */}
          <div className="w-80 flex flex-col bg-slate-900/50 border-slate-800 p-4 overflow-y-auto gap-4">
            {/* Selected Edge Inspector */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-slate-300">Bi-Temporal Edge Details</span>
                {selectedEdge && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      selectedEdge.invalidAt
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    }`}
                  >
                    {selectedEdge.invalidAt ? "SUPERSEDED" : "ACTIVE"}
                  </span>
                )}
              </div>

              {selectedEdge ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Assertion:</span>
                    <p className="font-semibold text-slate-200 mt-0.5">{selectedEdge.fact}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500">Source:</span> {selectedEdge.sourceNode}
                    </div>
                    <div>
                      <span className="text-slate-500">Target:</span> {selectedEdge.targetNode}
                    </div>
                  </div>
                  <div className="space-y-1 font-mono text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-cyan-400">valid_at:</span> {new Date(selectedEdge.validAt).toLocaleDateString()}
                    </div>
                    {selectedEdge.invalidAt && (
                      <div>
                        <span className="text-rose-400">invalid_at:</span> {new Date(selectedEdge.invalidAt).toLocaleDateString()}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">episodes:</span> {selectedEdge.episodes.join(", ") || "none"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Click any graph edge or relationship to inspect its temporal bounds.</p>
              )}
            </div>

            {/* Manual Edge Injector Form */}
            <form onSubmit={handleAddEdge} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-cyan-400">+ Add Temporal Edge</span>
              </div>

              {mutationMessage && (
                <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/50 p-2 rounded border border-cyan-800/60">
                  {mutationMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400">Source Node</label>
                  <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400">Relation</label>
                  <input
                    type="text"
                    value={newRelation}
                    onChange={(e) => setNewRelation(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Target Node</label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru, Green Tea"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Fact Assertion</label>
                <textarea
                  rows={2}
                  placeholder="e.g. User moved to Bengaluru"
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Resolving Contradictions..." : "Assert Relationship Edge"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
