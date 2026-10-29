import { NextRequest, NextResponse } from "next/server";
import {
  getSaanProfile,
  buildSaanSystemPrompt,
  sanitizeSaanOutput,
  updateRelationshipFromSentiment,
} from "@/lib/saan/soul";
import {
  getSaanMemories,
  extractMemoriesFromTurn,
  getBondScore,
  bumpBondScore,
} from "@/lib/saan/memory";
import {
  SAAN_TOOLS_SPEC,
  parseDirtyJson,
  executeRollback,
  dispatchSaanAction,
  type SaanActionResult,
  globalAssociativeNetwork,
  globalLeaseManager,
  globalResearchPlanner,
  globalGateManager,
  globalIdempotencyEngine,
  globalLifecycleHookManager,
  globalMetasearchAggregator,
  globalFirecrawlStore,
  globalMarkdownScraper,
  globalWebSecurityFence,
  globalWebSecurityAuditor,
} from "@/lib/saan/controller";
import { checkCrisisSignals } from "@/lib/saan/safety";
import { recordUserReplied } from "@/lib/saan/proactive";
import { pickReaction, splitBurst, calculateReplyDelay } from "@/lib/saan/humanize";
import { getMoodOrgan } from "@/lib/saan/mood-organ";
import { recordSpoken } from "@/lib/saan/familiarity";
import { splitOoc, formatDirectorNotes, forNarrative } from "@/lib/saan/ooc";
import { findOverusedPhrases, formatAntiSlopPrompt } from "@/lib/saan/anti-slop";
import { looksConsequential, loadLedgerFromDb, addDeeds, dueDeeds, mentionsOpenDeed, markAnswered, syncLedgerToDb } from "@/lib/saan/ledger";
import { reinforceMemory } from "@/lib/saan/auto-promote";
import { formatTimePrefix } from "@/lib/saan/airi-datetime";
import { categorizeResponse } from "@/lib/saan/airi-reasoning";
import { parseStreamingControlTokens } from "@/lib/saan/airi-streaming-control";
import {
  evaluateLorebook,
  DEFAULT_SAAN_LOREBOOK,
  getActiveLorebookState,
  setActiveLorebookState,
} from "@/lib/saan/lorebook";
import {
  exportSaanToCardV2,
  serializeCharacterCardV2,
  parseCharacterCardJson,
} from "@/lib/saan/character-card";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";
import { substituteMacros } from "@/lib/saan/macro-engine";
import { insertPromptsAtDepth } from "@/lib/saan/depth-injector";
import { getAuthorsNoteInjection } from "@/lib/saan/authors-note";
import { mergeConsecutiveRoles } from "@/lib/saan/prompt-merger";
import { applyRegexPipeline } from "@/lib/saan/regex-pipeline";
import { pruneContextTurns, clampOutputTokens } from "@/lib/saan/token-budget";
import {
  getGraphMemoryStore,
  searchGlobalGraph,
  DEFAULT_SAAN_GRAPH_NODES,
  type GraphNode,
} from "@/lib/saan/graph-memory";
import { globalChatVariables } from "@/lib/saan/chat-variables";
import { getCoreMemoryManager } from "@/lib/saan/core-memory-blocks";
import { getMem0AuditLog } from "@/lib/saan/mem0-decision-matrix";
import { getTemporalEdgeGraphStore } from "@/lib/saan/temporal-edge-graph";
import { getCognifyPipelineManager } from "@/lib/saan/cognify-pipeline";
import {
  generateKnapsackBudgetReport,
  parseTemporalQueryBounds,
  getCausalMemoryRegistry,
} from "@/lib/saan/temporal-query-engine";
import { reconstructPointInTimeState } from "@/lib/saan/memory-benchmark-bitemporal";
import { getGlobalIncrementalSummaryManager } from "@/lib/saan/incremental-summary";
import { getGlobalMemobaseProfileStore, MemobaseProfileManager } from "@/lib/saan/profile-extractor";
import { getBufferedMemoryQueue, type MemoryPriority } from "@/lib/saan/buffered-memory-queue";
import {
  GnosysMemoryPortabilityEngine,
  type MergeStrategy,
  type GnosysMemoryFact,
  type GnosysMemoryEdge,
} from "@/lib/saan/portable-memory-spec";
import { getWorkingScratchpadManager } from "@/lib/saan/working-scratchpad";
import { getObservableActionStream } from "@/lib/saan/observable-action-stream";
import { DirtyJsonRepairEngine, getDirtyJsonRepairAuditor } from "@/lib/saan/dirty-json-repair";
import { getProactiveTriggerManager } from "@/lib/saan/trigger-recall";
import { getMemoryEvalStore, MemoryEvalJudgeEngine } from "@/lib/saan/memory-eval-judge";
import { requireVault } from "@/server/vault-guard";
import { defaultProvider, createLlmClient } from "@/lib/providers-service";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is a rollback request
    if (body.type === "rollback" && body.snapshotId) {
      const rollbackRes = executeRollback(body.snapshotId);
      return NextResponse.json({ ok: rollbackRes.success, message: rollbackRes.message });
    }

    // Direct Action Dispatch for Saan 50-Repo OS Cockpit
    if (body.type === "action" && body.action) {
      const actionRes = await dispatchSaanAction(body.action, body.params || {});
      return NextResponse.json({ ok: actionRes.success, actionResult: actionRes });
    }

    // SillyTavern CharacterCard V2/V3 Export
    if (body.type === "export_card") {
      const card = exportSaanToCardV2();
      return NextResponse.json({
        ok: true,
        card,
        json: serializeCharacterCardV2(card),
      });
    }

    // SillyTavern CharacterCard V2/V3 Import
    if (body.type === "import_card" && body.cardData) {
      const parsed = parseCharacterCardJson(body.cardData);
      return NextResponse.json({
        ok: true,
        message: `Loaded character card '${parsed.data.name}' successfully!`,
        card: parsed,
      });
    }

    // RisuAI Chat Variables Management
    if (body.type === "get_chat_variables") {
      return NextResponse.json({ ok: true, variables: globalChatVariables.getAll() });
    }
    if (body.type === "set_chat_variable" && body.key) {
      globalChatVariables.set(body.key, body.value);
      return NextResponse.json({ ok: true, variables: globalChatVariables.getAll() });
    }
    if (body.type === "increment_chat_variable" && body.key) {
      const next = globalChatVariables.add(body.key, body.delta ?? 1);
      return NextResponse.json({ ok: true, key: body.key, value: next, variables: globalChatVariables.getAll() });
    }
    if (body.type === "toggle_chat_variable" && body.key) {
      const next = globalChatVariables.toggle(body.key);
      return NextResponse.json({ ok: true, key: body.key, value: next, variables: globalChatVariables.getAll() });
    }

    // RisuAI Graph Associative Memory Management
    if (body.type === "get_graph_nodes") {
      return NextResponse.json({ ok: true, nodes: getGraphMemoryStore().getAllNodes() });
    }
    if (body.type === "query_graph_memory") {
      const searchResult = searchGlobalGraph(body.query || "", body.depth || 1);
      return NextResponse.json({ ok: true, result: searchResult });
    }

    // Letta Core Memory Management
    if (body.type === "get_core_memory") {
      const coreMgr = getCoreMemoryManager();
      return NextResponse.json({
        ok: true,
        coreMemory: {
          human: coreMgr.getBlock("human")?.content || "",
          persona: coreMgr.getBlock("persona")?.content || "",
        },
        summary: coreMgr.getCapacitySummary(),
        history: coreMgr.getHistory(),
      });
    }
    if (body.type === "update_core_memory" && body.coreMemory) {
      const coreMgr = getCoreMemoryManager();
      if (typeof body.coreMemory.human === "string") {
        coreMgr.updateBlock("human", body.coreMemory.human, "user");
      }
      if (typeof body.coreMemory.persona === "string") {
        coreMgr.updateBlock("persona", body.coreMemory.persona, "user");
      }
      return NextResponse.json({
        ok: true,
        message: "Core Memory updated",
        coreMemory: {
          human: coreMgr.getBlock("human")?.content || "",
          persona: coreMgr.getBlock("persona")?.content || "",
        },
        summary: coreMgr.getCapacitySummary(),
        history: coreMgr.getHistory(),
      });
    }

    // Mem0 4-State Memory Audit Log
    if (body.type === "get_mem0_events") {
      return NextResponse.json({ ok: true, events: getMem0AuditLog() });
    }

    // Graphiti Bi-Temporal Knowledge Graph
    if (body.type === "get_temporal_graph") {
      const store = getTemporalEdgeGraphStore();
      const snapshot = store.getSnapshot(body.asOf ? Number(body.asOf) : undefined);
      return NextResponse.json({ ok: true, graph: snapshot });
    }
    if (body.type === "add_temporal_edge" && body.edge) {
      const store = getTemporalEdgeGraphStore();
      const res = store.addEdge(body.edge);
      return NextResponse.json({
        ok: true,
        edge: res.edge,
        supersededEdgeIds: res.supersededEdgeIds,
        graph: store.getSnapshot(),
      });
    }

    // Cognee Cognify Multi-Stage Pipeline
    if (body.type === "get_cognify_status") {
      const manager = getCognifyPipelineManager();
      return NextResponse.json({ ok: true, history: manager.getHistory() });
    }
    if (body.type === "run_cognify_pipeline" && body.text) {
      const manager = getCognifyPipelineManager();
      const report = await manager.cognifyText(body.text, {
        simulateFailureStage: body.simulateFailureStage,
      });
      return NextResponse.json({ ok: true, report, history: manager.getHistory() });
    }

    // Hindsight Knapsack Fact Budget & Temporal Query Engine
    if (body.type === "get_hindsight_budget") {
      const budgetCap = body.budgetCap ? Number(body.budgetCap) : 1200;
      const report = generateKnapsackBudgetReport(budgetCap);
      const causalLinks = getCausalMemoryRegistry().getAllLinks();
      return NextResponse.json({ ok: true, report, causalLinks });
    }
    if (body.type === "parse_temporal_query" && body.query) {
      const bounds = parseTemporalQueryBounds(body.query);
      return NextResponse.json({ ok: true, bounds });
    }
    if (body.type === "add_causal_link" && body.cause && body.effect) {
      const link = getCausalMemoryRegistry().addCausalLink(
        body.cause,
        body.effect,
        body.description || "Conversational causality",
        body.confidence ?? 0.95
      );
      return NextResponse.json({ ok: true, link, causalLinks: getCausalMemoryRegistry().getAllLinks() });
    }

    // Datapace Point-in-Time State Reconstruction & Epistemic Scrubber
    if (body.type === "get_time_travel_state") {
      const asOf = body.asOfTimestamp ? Number(body.asOfTimestamp) : undefined;
      const state = reconstructPointInTimeState(asOf);
      return NextResponse.json({ ok: true, state });
    }

    // Zep / LangMem Incremental Conversation Summarization & Entity Tags
    if (body.type === "get_incremental_summary") {
      const summaryMgr = getGlobalIncrementalSummaryManager();
      const currentTokens = body.currentTokens ? Number(body.currentTokens) : 2400;
      return NextResponse.json({ ok: true, snapshot: summaryMgr.getSnapshot(currentTokens) });
    }
    if (body.type === "trigger_incremental_summary" && body.newText) {
      const summaryMgr = getGlobalIncrementalSummaryManager();
      const newIds = body.messageIds || [`msg_${Date.now()}`];
      summaryMgr.updateRunningSummary(body.newText, newIds);
      return NextResponse.json({ ok: true, snapshot: summaryMgr.getSnapshot() });
    }

    // Memobase User Profile Extraction & 3-State Fact Merger
    if (body.type === "get_user_profile") {
      const store = getGlobalMemobaseProfileStore();
      const attributes = store.getAll();
      const truncated = MemobaseProfileManager.truncateProfiles(attributes, {
        preferTopics: ["basic_info", "companion_preferences", "personalization"],
      });
      return NextResponse.json({ ok: true, attributes: truncated, allAttributes: attributes });
    }
    if (body.type === "update_profile_attribute" && body.attribute) {
      const store = getGlobalMemobaseProfileStore();
      const res = store.setAttribute(body.attribute);
      return NextResponse.json({
        ok: true,
        attribute: res.attribute,
        decision: res.decision,
        allAttributes: store.getAll(),
      });
    }

    // SuperAGI Buffered Memory Queue Endpoints
    if (body.type === "get_buffered_queue_status") {
      const q = getBufferedMemoryQueue();
      const metrics = q.getQueueMetrics("user");
      const items = q.getPendingItems("user");
      return NextResponse.json({ ok: true, metrics, items });
    }
    if (body.type === "enqueue_buffered_memory" && body.candidate) {
      const q = getBufferedMemoryQueue();
      const result = q.enqueue({
        userId: "user",
        text: body.candidate.text,
        axis: body.candidate.axis || "traits",
        priority: (body.candidate.priority as MemoryPriority) || "NORMAL",
        confidence: body.candidate.confidence ?? 0.85,
      });
      return NextResponse.json({ ok: true, result, metrics: q.getQueueMetrics("user") });
    }
    if (body.type === "flush_buffered_memory") {
      const q = getBufferedMemoryQueue();
      const flushResult = q.flush("user");
      return NextResponse.json({ ok: true, flushResult, metrics: q.getQueueMetrics("user") });
    }

    // Gnosys & Dify Portable Memory Interchange Endpoints
    if (body.type === "export_memory_snapshot") {
      const coreMgr = getCoreMemoryManager();
      const personaBlock = coreMgr.getBlock("persona");
      const humanBlock = coreMgr.getBlock("human");
      const rawMemories = getSaanMemories(50);
      const facts: GnosysMemoryFact[] = rawMemories.map((m: any, idx: number) => ({
        id: `fact_${m.id || idx + 1}`,
        category: (m.category || "personal") as any,
        fact: m.fact || m.text || "",
        confidence: m.confidence ?? 0.9,
        validAt: m.valid_since || m.created_at || new Date().toISOString(),
        invalidAt: m.valid_until,
      }));

      const graphStore = getTemporalEdgeGraphStore();
      const edges: GnosysMemoryEdge[] = graphStore.getActiveEdgesAsOf(Date.now()).map((e) => ({
        source: e.sourceNode,
        target: e.targetNode,
        relationship: e.relation,
        weight: 1.0,
        validAt: new Date(e.validAt).toISOString(),
        invalidAt: e.invalidAt ? new Date(e.invalidAt).toISOString() : undefined,
      }));

      const snapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
        agentId: "saan-k7",
        coreMemory: {
          persona: personaBlock?.content || "",
          human: humanBlock?.content || "",
          maxPersonaLength: 2500,
          maxHumanLength: 2500,
        },
        facts,
        edges,
        metadata: {
          environment: "k7-sovereign",
          version: "1.0.0",
        },
      });

      const difyDataset = GnosysMemoryPortabilityEngine.toDifyDataset(snapshot);

      return NextResponse.json({ ok: true, snapshot, difyDataset });
    }

    if (body.type === "validate_memory_snapshot" && body.snapshot) {
      const validation = GnosysMemoryPortabilityEngine.validateAndImport(body.snapshot);
      return NextResponse.json({ ok: true, validation });
    }

    if (body.type === "import_memory_snapshot" && body.snapshot) {
      const validation = GnosysMemoryPortabilityEngine.validateAndImport(body.snapshot);
      if (!validation.valid) {
        return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
      }

      const incoming = typeof body.snapshot === "string" ? JSON.parse(body.snapshot) : body.snapshot;
      const strategy: MergeStrategy = body.strategy || "UNION";

      const coreMgr = getCoreMemoryManager();
      const existingPersona = coreMgr.getBlock("persona")?.content || "";
      const existingHuman = coreMgr.getBlock("human")?.content || "";
      const rawMemories = getSaanMemories(50);
      const existingFacts: GnosysMemoryFact[] = rawMemories.map((m: any, idx: number) => ({
        id: `fact_${m.id || idx + 1}`,
        category: (m.category || "personal") as any,
        fact: m.fact || m.text || "",
        confidence: m.confidence ?? 0.9,
        validAt: m.valid_since || m.created_at || new Date().toISOString(),
      }));

      const graphStore = getTemporalEdgeGraphStore();
      const existingEdges: GnosysMemoryEdge[] = graphStore.getActiveEdgesAsOf(Date.now()).map((e) => ({
        source: e.sourceNode,
        target: e.targetNode,
        relationship: e.relation,
        weight: 1.0,
        validAt: new Date(e.validAt).toISOString(),
      }));

      const mergeResult = GnosysMemoryPortabilityEngine.mergeSnapshot(
        {
          coreMemory: { persona: existingPersona, human: existingHuman },
          facts: existingFacts,
          edges: existingEdges,
        },
        incoming,
        strategy
      );

      // If strategy updated core blocks, save them
      if (strategy === "OVERWRITE" || strategy === "UNION") {
        if (mergeResult.mergedCoreMemory.persona) {
          coreMgr.updateBlock("persona", mergeResult.mergedCoreMemory.persona);
        }
        if (mergeResult.mergedCoreMemory.human) {
          coreMgr.updateBlock("human", mergeResult.mergedCoreMemory.human);
        }
      }

      return NextResponse.json({
        ok: true,
        importResult: mergeResult.result,
        mergedStats: {
          factsCount: mergeResult.mergedFacts.length,
          edgesCount: mergeResult.mergedEdges.length,
          coreMemoryChars: mergeResult.mergedCoreMemory.persona.length + mergeResult.mergedCoreMemory.human.length,
        },
      });
    }

    // MemGPT v2 Working Scratchpad Endpoints
    if (body.type === "get_working_scratchpad") {
      const spMgr = getWorkingScratchpadManager();
      const coreMgr = getCoreMemoryManager();
      const personaBlock = coreMgr.getBlock("persona");
      const humanBlock = coreMgr.getBlock("human");
      const coreChars = (personaBlock?.content?.length || 0) + (humanBlock?.content?.length || 0);
      const archivalCount = getSaanMemories(50).length;

      const current = spMgr.getCurrentSession();
      const recent = spMgr.getRecentSessions(8);
      const metrics = spMgr.getMetrics(coreChars, archivalCount);

      return NextResponse.json({ ok: true, current, recent, metrics });
    }

    if (body.type === "simulate_scratchpad_trace" && body.prompt) {
      const spMgr = getWorkingScratchpadManager();
      const steps = spMgr.simulateReasoningTrace(body.prompt, "Saan");
      return NextResponse.json({ ok: true, steps, current: spMgr.getCurrentSession() });
    }

    // OpenHands Observable Action Stream Endpoints
    if (body.type === "get_action_stream") {
      const stream = getObservableActionStream();
      const events = stream.getEvents();
      const actionsCount = events.filter((e) => e.kind === "action").length;
      const obsCount = events.filter((e) => e.kind === "observation").length;
      const errorCount = events.filter((e) => e.kind === "observation" && (e as any).isError).length;
      const rejectCount = events.filter((e) => e.kind === "user_reject").length;

      return NextResponse.json({
        ok: true,
        events,
        stats: {
          totalEvents: events.length,
          actionsCount,
          obsCount,
          errorCount,
          rejectCount,
        },
      });
    }

    if (body.type === "simulate_action_stream" && body.action) {
      const stream = getObservableActionStream();
      const toolName = body.action.toolName || "system_diagnostic";
      const payload = body.action.payload || { check: "sqlite_vault_integrity" };
      const thought = body.action.thought || ["Inspecting local system state"];
      const output = body.action.output || "Diagnostics PASSED: All local databases and vector models operational.";

      const res = stream.recordToolCall(toolName, payload, output, {
        thought,
        isError: body.action.isError || false,
        securityRisk: body.action.securityRisk || "LOW",
      });

      return NextResponse.json({ ok: true, recorded: res, events: stream.getEvents() });
    }

    if (body.type === "clear_action_stream") {
      const stream = getObservableActionStream();
      stream.clear();
      return NextResponse.json({ ok: true });
    }

    // AutoGPT & Agent-Zero Dirty JSON Repair Endpoints
    if (body.type === "get_dirty_json_audit") {
      const auditor = getDirtyJsonRepairAuditor();
      const events = auditor.getEvents();
      const stats = auditor.getStats();
      return NextResponse.json({ ok: true, events, stats });
    }

    if (body.type === "test_dirty_json_repair" && typeof body.raw === "string") {
      const result = DirtyJsonRepairEngine.repairAndParse(body.raw);
      const auditor = getDirtyJsonRepairAuditor();
      const recorded = auditor.recordRepair(body.raw, result);
      return NextResponse.json({ ok: true, result, recorded, stats: auditor.getStats() });
    }

    if (body.type === "clear_dirty_json_audit") {
      const auditor = getDirtyJsonRepairAuditor();
      auditor.clear();
      return NextResponse.json({ ok: true });
    }

    // TriggerRecall & Proactive Briefing Engine Endpoints
    if (body.type === "get_proactive_config") {
      const mgr = getProactiveTriggerManager();
      return NextResponse.json({ ok: true, config: mgr.getConfig() });
    }

    if (body.type === "update_proactive_config" && body.config) {
      const mgr = getProactiveTriggerManager();
      const updated = mgr.updateConfig(body.config);
      return NextResponse.json({ ok: true, config: updated });
    }

    if (body.type === "preview_proactive_briefing" && body.briefingType) {
      const mgr = getProactiveTriggerManager();
      const briefing = mgr.generateBriefing(
        body.briefingType as "morning_chai" | "evening_unwind",
        body.data,
        body.companionName || "Saan"
      );
      const isActive = mgr.isWindowActive(body.briefingType as "morning_chai" | "evening_unwind");
      return NextResponse.json({ ok: true, briefing, isActive });
    }

    // MemoryEvalJudge (Repo #22) Endpoints
    if (body.type === "get_memory_eval_stats") {
      const store = getMemoryEvalStore();
      return NextResponse.json({
        ok: true,
        stats: store.getAggregateStats(),
        history: store.getHistory(30),
      });
    }

    if (body.type === "evaluate_turn_fidelity" && body.reply) {
      const store = getMemoryEvalStore();
      const record = store.recordEvaluation(
        body.userMessage || "",
        body.reply,
        body.recalledMemories || [],
        body.latencyMs || 8
      );
      return NextResponse.json({
        ok: true,
        record,
        stats: store.getAggregateStats(),
      });
    }

    if (body.type === "clear_memory_eval_history") {
      getMemoryEvalStore().clear();
      return NextResponse.json({ ok: true });
    }

    // AssociativeMemoryNetwork (Repo #23) Endpoints
    if (body.type === "get_associative_network") {
      globalAssociativeNetwork.seedDefaultSaanNetwork();
      return NextResponse.json({
        ok: true,
        notes: globalAssociativeNetwork.getAllNotes(),
      });
    }

    if (body.type === "pulse_associative_concept" && body.seed) {
      globalAssociativeNetwork.seedDefaultSaanNetwork();
      const cascade = globalAssociativeNetwork.pulseSpreadingActivation(
        body.seed,
        body.energy || 1.0,
        body.maxHops || 3
      );
      return NextResponse.json({
        ok: true,
        cascade,
        notes: globalAssociativeNetwork.getAllNotes(),
      });
    }

    if (body.type === "add_associative_note" && body.content) {
      globalAssociativeNetwork.seedDefaultSaanNetwork();
      const note = globalAssociativeNetwork.addNote(body.content, body.options || {});
      return NextResponse.json({
        ok: true,
        note,
        notes: globalAssociativeNetwork.getAllNotes(),
      });
    }

    // CrewAI Resilient State Lease (Repo #24) Endpoints
    if (body.type === "get_state_leases") {
      return NextResponse.json({
        ok: true,
        leases: globalLeaseManager.getAllActiveLeases(),
        metrics: globalLeaseManager.getMetrics(),
      });
    }

    if (body.type === "acquire_state_lease" && body.resource && body.owner) {
      const handle = globalLeaseManager.acquireLease(
        body.resource,
        body.owner,
        body.ttlMs || 10_000
      );
      return NextResponse.json({
        ok: !!handle,
        lease: handle ? {
          resource: handle.resource,
          owner: handle.owner,
          expiresAt: handle.expiresAt,
          fencingToken: handle.fencingToken,
        } : null,
        metrics: globalLeaseManager.getMetrics(),
      });
    }

    if (body.type === "preempt_state_lease" && body.resource) {
      const preempted = globalLeaseManager.forcePreempt(body.resource);
      return NextResponse.json({
        ok: preempted,
        metrics: globalLeaseManager.getMetrics(),
      });
    }

    // LangGraph Cyclic Research Planner (Repo #25) Endpoints
    if (body.type === "get_research_workflows") {
      return NextResponse.json({
        ok: true,
        history: globalResearchPlanner.getWorkflowHistory(),
        latest: globalResearchPlanner.getLatestRun() || null,
      });
    }

    if (body.type === "execute_research_workflow" && body.query) {
      const run = globalResearchPlanner.executeCyclicGraph(body.query, body.options || {});
      return NextResponse.json({
        ok: true,
        run,
        history: globalResearchPlanner.getWorkflowHistory(),
      });
    }

    // Smolagents / OpenInterpreter Interactive Confirmation Gate (Repo #26) Endpoints
    if (body.type === "get_gate_approvals") {
      return NextResponse.json({
        ok: true,
        pending: globalGateManager.getPendingApprovals(),
        auditHistory: globalGateManager.getAuditHistory(),
        sessionAuthorizations: globalGateManager.getSessionAuthorizations(),
      });
    }

    if (body.type === "submit_gate_decision" && body.cardId && body.decision) {
      const resolution = globalGateManager.resolveApproval(body.cardId, body.decision);
      return NextResponse.json({
        ok: true,
        ...resolution,
        pending: globalGateManager.getPendingApprovals(),
        auditHistory: globalGateManager.getAuditHistory(),
        sessionAuthorizations: globalGateManager.getSessionAuthorizations(),
      });
    }

    if (body.type === "create_gate_request" && body.command) {
      const card = globalGateManager.createApprovalCard(body.command, {
        securityTier: body.securityTier || 2,
        sandboxMode: body.sandboxMode || "workspace-write",
        workingDirectory: body.workingDirectory,
        requiredPermissions: body.requiredPermissions,
      });
      return NextResponse.json({
        ok: true,
        card,
        pending: globalGateManager.getPendingApprovals(),
      });
    }

    // AutoGen & n8n Idempotency Backoff & Retry Telemetry (Repo #27) Endpoints
    if (body.type === "get_retry_telemetry") {
      return NextResponse.json({
        ok: true,
        telemetry: globalIdempotencyEngine.getTelemetry(),
        deadLetters: globalIdempotencyEngine.getDeadLetters(),
        records: globalIdempotencyEngine.getAllRecords(),
      });
    }

    if (body.type === "reprocess_dead_letter" && body.id) {
      const success = globalIdempotencyEngine.reprocessDeadLetter(body.id);
      return NextResponse.json({
        ok: success,
        telemetry: globalIdempotencyEngine.getTelemetry(),
        deadLetters: globalIdempotencyEngine.getDeadLetters(),
      });
    }

    if (body.type === "simulate_retry_execution") {
      const sim = globalIdempotencyEngine.simulateExecutionWithRetry(
        body.fnName || "sync_knowledge_vector",
        body.payload || { test: true },
        body.failAttempts ?? 2
      );
      return NextResponse.json({
        ok: true,
        sim,
        telemetry: globalIdempotencyEngine.getTelemetry(),
        deadLetters: globalIdempotencyEngine.getDeadLetters(),
        records: globalIdempotencyEngine.getAllRecords(),
      });
    }

    // Huginn Agent Lifecycle Hooks Registry (Repo #28) Endpoints
    if (body.type === "get_lifecycle_hooks") {
      return NextResponse.json({
        ok: true,
        hooks: globalLifecycleHookManager.getHooks(),
        auditLog: globalLifecycleHookManager.getAuditLog(),
      });
    }

    if (body.type === "toggle_lifecycle_hook" && body.id) {
      const enabled = globalLifecycleHookManager.toggleHook(body.id, body.enabled);
      return NextResponse.json({
        ok: true,
        id: body.id,
        enabled,
        hooks: globalLifecycleHookManager.getHooks(),
      });
    }

    if (body.type === "simulate_hook_lifecycle") {
      const result = globalLifecycleHookManager.simulateLifecycleRun(body.userMessage || "Hello Saan!");
      return NextResponse.json({
        ok: true,
        result,
        auditLog: globalLifecycleHookManager.getAuditLog(),
      });
    }

    // SearXNG & Khoj Metasearch & Query Decomposition (Repos #29 & #30) Endpoints
    if (body.type === "get_metasearch_state") {
      return NextResponse.json({
        ok: true,
        history: globalMetasearchAggregator.getSearchHistory(),
      });
    }

    if (body.type === "execute_metasearch" && body.query) {
      const simulation = globalMetasearchAggregator.simulateMetasearch(body.query, body.options || {});
      return NextResponse.json({
        ok: true,
        ...simulation,
        history: globalMetasearchAggregator.getSearchHistory(),
      });
    }

    // Firecrawl Clean Markdown Scraper (Repo #31) Endpoints
    if (body.type === "get_scraped_articles") {
      return NextResponse.json({
        ok: true,
        articles: globalFirecrawlStore.getArticles(),
      });
    }

    if (body.type === "scrape_webpage_clean") {
      const targetUrl = body.url || "https://example.com/article";
      const sampleHtml = body.html || `
        <html>
          <head><title>${body.title || "Clean Reader Document"}</title><meta name="description" content="Extracted via Firecrawl clean reader"/></head>
          <body>
            <header><nav><a href="/">Home</a></nav></header>
            <div id="onetrust-consent-sdk"><p>Accept Cookies</p></div>
            <main>
              <h1>${body.title || "Clean Reader Document"}</h1>
              <p>This web document was processed by Firecrawl clean reader. All navigation, consent banners, and tracking scripts were eliminated.</p>
              <blockquote>Sovereign privacy guarantees clean, untracked reading.</blockquote>
              <table><tr><th>Feature</th><th>Status</th></tr><tr><td>Boilerplate Scrubbing</td><td>Active</td></tr></table>
            </main>
            <footer><p>© 2026 Example Corp</p></footer>
          </body>
        </html>
      `;

      const cleanResult = globalMarkdownScraper.cleanAndConvert(sampleHtml, {
        baseUrl: targetUrl,
        onlyMainContent: true,
      });

      const record = globalFirecrawlStore.recordArticle(targetUrl, cleanResult);

      return NextResponse.json({
        ok: true,
        article: record,
        articles: globalFirecrawlStore.getArticles(),
      });
    }

    // Crawl4AI Prompt Injection Security Fence (Repo #32) Endpoints
    if (body.type === "get_security_fence_state") {
      return NextResponse.json({
        ok: true,
        stats: globalWebSecurityAuditor.getStats(),
        records: globalWebSecurityAuditor.getRecords(),
      });
    }

    if (body.type === "test_security_fence" && body.content) {
      const sourceUrl = body.url || "https://untrusted-web-source.org/article";
      const fenceResult = globalWebSecurityFence.fenceWebContent(body.content, {
        url: sourceUrl,
        title: body.title,
      });

      const auditRecord = globalWebSecurityAuditor.recordScan(sourceUrl, fenceResult, body.content);

      return NextResponse.json({
        ok: true,
        fence: fenceResult,
        auditRecord,
        stats: globalWebSecurityAuditor.getStats(),
        records: globalWebSecurityAuditor.getRecords(),
      });
    }

    const rawUserMessage = body.message;
    const history: IncomingMessage[] = body.history || [];

    if (!rawUserMessage || typeof rawUserMessage !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Split Out-of-Character (OOC) Directives from spoken dialogue (Chronicler ooc.ts pattern)
    const { spoken, directives } = splitOoc(rawUserMessage);
    const userMessage = spoken || rawUserMessage;
    const spokenNarrative = forNarrative(rawUserMessage);
    const directorNote = formatDirectorNotes(directives);

    // 0. Tier-0 Deterministic Crisis Safety Guardrail (HerAndHim safety.py pattern)
    const crisisCheck = checkCrisisSignals(userMessage);
    if (crisisCheck.isCrisis && crisisCheck.response) {
      return NextResponse.json({
        ok: true,
        reply: crisisCheck.response,
        reaction: "🥺",
        bubbles: [crisisCheck.response],
        delayMs: 300,
        action: null,
        profile: getSaanProfile(getBondScore()),
      });
    }

    // Record user activity to clear unanswered proactive streak
    recordUserReplied();

    // Calculate selective pre-reply emoji reaction (HerAndHim humanize.py pattern)
    const reaction = pickReaction(userMessage);

    // Anti-Slop: detect overused phrases in recent assistant replies (Chronicler anti-slop.ts pattern)
    const assistantReplies = history.filter((h) => h.role === "assistant").map((h) => h.content);
    const overusedPhrases = findOverusedPhrases(assistantReplies);
    const antiSlopPrompt = formatAntiSlopPrompt(overusedPhrases);

    // 1. Extract and store any new memories from the user's message (Mem0 4-State Engine)
    const mem0Decisions = extractMemoriesFromTurn(userMessage);

    // 2. Load context: bond score & active bi-temporal memories (Graphiti / Datapace)
    const bondScore = bumpBondScore(1);
    const rawMemories = getSaanMemories(12);
    const memories = rawMemories.map((m) => m.point);

    // Auto-promote reinforcement for used active memories (Chronicler auto-promote.ts pattern)
    for (const m of rawMemories) {
      reinforceMemory(m.id, "active_session");
    }

    // 3. Construct system prompt with tools and circadian presence
    let systemPrompt = buildSaanSystemPrompt(memories, bondScore, SAAN_TOOLS_SPEC);
    systemPrompt += `\n\n${globalAvatarMapper.getPromptSpec()}`;
    if (antiSlopPrompt) {
      systemPrompt += `\n\n${antiSlopPrompt}`;
    }
    if (directorNote) {
      systemPrompt += `\n\n${directorNote}`;
    }

    // SillyTavern Macro substitution on system prompt (with idle duration support)
    const lastTimestamp = body.lastTimestamp ? Number(body.lastTimestamp) : (Date.now() - 3600_000);
    systemPrompt = substituteMacros(systemPrompt, {
      charName: "Saan",
      userName: "Krishna",
      lastUserMessage: rawUserMessage,
      lastInteractionTimestamp: lastTimestamp,
    });

    // SillyTavern World Info / Lorebook Selective Engine
    const currentTurnState = getActiveLorebookState();
    currentTurnState.currentTurn = history.length;
    const lorebookResult = evaluateLorebook(rawUserMessage, DEFAULT_SAAN_LOREBOOK, currentTurnState);
    setActiveLorebookState(lorebookResult.updatedState);

    // Airi temporal anchor prefix for user turns
    const timeStampedUserMessage = `${formatTimePrefix()}${spokenNarrative}`;

    // RisuAI Chat Variables Auto-Increment & Session Sync
    globalChatVariables.add("turn_count", 1);

    // RisuAI Graph Associative Memory Search (BFS 1-hop traversal)
    const graphResult = searchGlobalGraph(rawUserMessage, 1);

    let messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: timeStampedUserMessage },
    ];

    // SillyTavern Context Depth Injection (Author's Note & Active Lore @ depth 2)
    const depthInjections = [];
    if (lorebookResult.combinedContent) {
      depthInjections.push({
        id: "lorebook_active",
        content: `[ACTIVE WORLD INFO / LOREBOOK ANCHORS]:\n${lorebookResult.combinedContent}`,
        role: "system" as const,
        depth: 2,
        order: 90,
      });
    }

    if (graphResult.matchedNodes.length > 0) {
      const graphSummary = graphResult.matchedNodes
        .map((node) => `• ${node.name}: ${node.summary} (Connected: ${node.connections.join(", ")})`)
        .join("\n");
      depthInjections.push({
        id: "graph_memory_associative",
        content: `[ASSOCIATIVE KNOWLEDGE GRAPH CONTEXT]:\n${graphSummary}`,
        role: "system" as const,
        depth: 1,
        order: 85,
      });
    }

    const anInjection = getAuthorsNoteInjection(history.length);
    if (anInjection) {
      depthInjections.push(anInjection);
    }

    if (depthInjections.length > 0) {
      messages = insertPromptsAtDepth(messages, depthInjections);
    }

    // SillyTavern Consecutive Role Merge Engine (strict turn alternation)
    messages = mergeConsecutiveRoles(messages);

    // RisuAI Dynamic Token Headroom & Context Budget Clamping
    const { prunedMessages, budget: tokenBudget } = pruneContextTurns(messages, 8192, 500);
    messages = prunedMessages;
    const clampedMaxTokens = tokenBudget.outputTokens;

    let reply = "";
    let providerUsed = "Vault Provider";
    let fallbackTriggered = false;

    // A. Custom Vault Provider attempt (if vault is unlocked)
    try {
      const vaultCtx = await requireVault();
      const def = defaultProvider(vaultCtx);
      if (def && !def.name.includes("Free Frontier") && !def.baseUrl.includes("pollinations")) {
        const client = createLlmClient(vaultCtx, def.id, { skipScrubber: true });
        const res = await client.createTurn(
          messages,
          undefined,
          def.models[0] || "gpt-4o-mini",
          undefined,
          { timeoutMs: 25_000, temperature: 0.85 }
        );
        if (res.text && res.text.trim()) {
          reply = res.text.trim();
          providerUsed = def.name || "Vault Provider";
          fallbackTriggered = false;
        }
      }
    } catch {
      // Vault locked or no custom provider
    }

    // B. Public Frontier Gateway Cascade (Pollinations OpenAI)
    if (!reply) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 28_000);

        const resp = await fetch("https://text.pollinations.ai/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer free-tier",
          },
          body: JSON.stringify({
            model: "openai",
            messages,
            temperature: 0.88,
            max_tokens: clampedMaxTokens,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          reply = data.choices?.[0]?.message?.content?.trim() || "";
          if (reply) {
            providerUsed = "Frontier Cascade (OpenAI)";
            fallbackTriggered = true;
          }
        }
      } catch (e) {
        // Fallback to text endpoint
      }
    }

    // C. Direct fast fallback
    if (!reply) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);

        const promptText = `${systemPrompt}\n\nRecent conversation:\n${history
          .slice(-4)
          .map((m) => `${m.role === "user" ? "Friend" : "Saan"}: ${m.content}`)
          .join("\n")}\nFriend: ${userMessage}\nSaan:`;

        const resp = await fetch("https://text.pollinations.ai/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: promptText }],
            model: "openai-fast",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const text = await resp.text();
          if (text && !text.includes("Free limit reached")) {
            reply = text.trim();
            providerUsed = "Fast Frontier Fallback";
            fallbackTriggered = true;
          }
        }
      } catch (e) {}
    }

    // D. Organic sleepy / offline fallback if all network failed
    if (!reply) {
      const p = getSaanProfile(bondScore);
      reply = p.isSleeping
        ? "Hmm... neend me hoon yaar. Kal subah baat karte hain na, so ja!"
        : `Hey... main abhi ${p.activity.toLowerCase()} kar rahi thi aur connection thoda atak gaya. Kya bol rahe the?`;
      providerUsed = "Sovereign Organic Fallback";
      fallbackTriggered = true;
    }

    // 4. Check for Action Blocks (`saan_action`) in the reply using DirtyJson (Agent Zero pattern)
    let actionExecuted: SaanActionResult | null = null;
    const actionMatch = reply.match(/```saan_action\s*([\s\S]*?)\s*```/);
    if (actionMatch) {
      const parsed = parseDirtyJson(actionMatch[1]);
      if (parsed && parsed.action) {
        actionExecuted = await dispatchSaanAction(parsed.action, parsed.params || {});
        // Clean out the raw action block from the chat reply text
        reply = reply.replace(/```saan_action[\s\S]*?```/, "").trim();
      }
    }

    // 4b. Airi Reasoning isolation & Streaming Control token categorization
    const categorized = categorizeResponse(reply);
    const thoughts = categorized.thoughts;
    const plans = categorized.plans;
    const streamingControls = parseStreamingControlTokens(categorized.speech);
    reply = streamingControls.cleanText;

    // 5. Post-Generation Anti-AI Cliché Sanitization (SillyTavern pattern)
    reply = sanitizeSaanOutput(reply);
    reply = applyRegexPipeline(reply, "ai_output");

    // 6. HerAndHim Multi-Bubble Burst & Reply Pacing Toolkit
    const bubbles = splitBurst(reply);
    const delayMs = calculateReplyDelay(reply);

    // 7. Update 4D Relationship Tensor (HerAndHim pattern) & Psycheros Mood Organ
    const sentiment = /(\bgood\b|great|love|happy|awesome|mast|badhai|shandar|thank)/i.test(userMessage)
      ? "positive"
      : /(\bbad\b|terrible|sad|angry|gussa|dukhi|upset|hate)/i.test(userMessage)
      ? "negative"
      : "neutral";
    updateRelationshipFromSentiment(sentiment, 0.5);

    // Psycheros Mood Organ: Ingest external turn modifier
    const valenceDelta = sentiment === "positive" ? 0.25 : sentiment === "negative" ? -0.25 : 0.05;
    const arousalDelta = sentiment !== "neutral" ? 0.2 : -0.05;
    getMoodOrgan().ingest({
      valence: valenceDelta,
      arousal: arousalDelta,
      dominance: 0.1,
      weight: 0.5,
      source: "user_turn",
    });

    // Psycheros Familiarity: record spoken output to prevent future repetition
    recordSpoken(reply);

    // Chronicler Consequence Ledger: Record or resolve commitments
    if (looksConsequential(userMessage, reply)) {
      try {
        let ledger = loadLedgerFromDb();
        if (mentionsOpenDeed(ledger, reply)) {
          const due = dueDeeds(ledger, 10);
          if (due.length > 0) {
            ledger = markAnswered(ledger, [due[0].id], 10);
          }
        } else {
          ledger = addDeeds(ledger, [{ deed: `${userMessage.slice(0, 50)}` }], 10);
        }
        syncLedgerToDb(ledger);
      } catch (err) {
        console.warn("[Chat] Consequence ledger sync error:", err);
      }
    }

    const updatedProfile = getSaanProfile(bondScore);
    const evalRecord = getMemoryEvalStore().recordEvaluation(
      userMessage,
      reply,
      memories,
      5
    );

    return NextResponse.json({
      ok: true,
      reply,
      bubbles,
      delayMs,
      reaction,
      action: actionExecuted,
      profile: updatedProfile,
      thoughts,
      plans,
      controls: streamingControls.controls,
      lorebookActivated: lorebookResult.activatedEntries.map((e) => e.id),
      tokenBudget,
      providerTelemetry: {
        providerUsed,
        fallbackTriggered,
        clampedMaxTokens,
      },
      graphAssociations: graphResult.matchedNodes.map((n) => n.name),
      chatVariables: globalChatVariables.getAll(),
      coreMemorySummary: getCoreMemoryManager().getCapacitySummary(),
      mem0Decisions,
      mem0Events: getMem0AuditLog(),
      memoryEval: evalRecord.metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process turn" }, { status: 500 });
  }
}

export async function GET() {
  const bondScore = getBondScore();
  return NextResponse.json({
    ok: true,
    profile: getSaanProfile(bondScore),
  });
}
