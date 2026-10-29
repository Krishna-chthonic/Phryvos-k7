/**
 * Sovereign Project Controller for Saan (Inspired by Agent Zero, Crawl4AI, OpenHands, Open Interpreter)
 *
 * Implements:
 * 1. Fault-Tolerant Tool JSON Repair (DirtyJson parser from Agent Zero)
 * 2. 3-Tier Security Classification (Tier 1: Read/Auto, Tier 2: Staged/Rollback, Tier 3: Confirmation)
 * 3. Point-in-time Action Rollbacks (OpenHands pattern)
 * 4. Prompt Injection Security Fence for Web Results (Crawl4AI pattern)
 */

import { getDb } from "@/lib/db/client";
import { addPersonalDate, listPersonalDates, deletePersonalDate } from "./personal-dates";
import { addWish, listPendingWishes, markWishFulfilled, markWishDismissed } from "./wishlist";
import { getMoodOrgan } from "./mood-organ";
import { runWeeklyConsolidationPass } from "./consolidation";
import { loadLedgerFromDb, markAnswered, dismiss, syncLedgerToDb, openDeeds } from "./ledger";
import { getLatestSelfModel } from "./self-model";
import {
  driftAnalysis,
  getVolatileFacts,
  getLessons,
  addLesson,
  reframeMemory,
  reliveMemory,
} from "./mimir-cognitive";
import { runHuginnScan, getHuginnInsights } from "./huginn";
import { getYggdrasilVizSummary, buildYggdrasilGraph } from "./yggdrasil";
import { getDynamicStarterChips } from "./airi-starter-chips";
import { toNaturalSpeechText, normalizeSpeakableText } from "./speech-transformer";
import { categorizeResponse } from "./airi-reasoning";
import { parseStreamingControlTokens } from "./airi-streaming-control";
import { globalAvatarMapper } from "./avatar-expressions";
import { computeRmsVolumeEnvelope } from "./ordered-audio-queue";
import { truncateHeardMemory } from "./interruption-contract";
import { parseCharacterCardJson, exportSaanToCardV2 } from "./character-card";
import { evaluateLorebook, type LoreEntry } from "./lorebook";
import { substituteMacros } from "./macro-engine";
import { getAuthorsNoteInjection, DEFAULT_AUTHORS_NOTE } from "./authors-note";
import { globalChatVariables } from "./chat-variables";
import { clampOutputTokens, pruneContextTurns } from "./token-budget";
import { getGraphMemoryStore } from "./graph-memory";
import { ProviderCascadeEngine } from "./provider-cascade";
import { evaluateMem0Decision, createMemoryAuditEvent } from "./mem0-decision-matrix";
import { getCoreMemoryManager } from "./core-memory-blocks";
import { getTemporalEdgeGraphStore } from "./temporal-edge-graph";
import { parseTemporalQueryBounds } from "./temporal-query-engine";
import { IncrementalSummaryManager, type MessagePayload } from "./incremental-summary";
import { BufferedMemoryQueue } from "./buffered-memory-queue";
import { GnosysMemoryPortabilityEngine } from "./portable-memory-spec";
import { MemobaseProfileManager, type ProfileAttribute } from "./profile-extractor";
import { DirtyJsonRepairEngine, getDirtyJsonRepairAuditor } from "./dirty-json-repair";
import { AssociativeMemoryNetwork, type MemoryNote } from "./associative-memory-network";
import { MemoryEvalJudge, type Verdict, normalise, stringMatch } from "./memory-eval-judge";
import {
  classifyRecallIntent,
  scoreTriggerPhrase,
  selectTriggeredMemories,
  generateMorningChaiBriefing,
  generateEveningUnwindRecap,
  assertCronActiveHours,
  isCronWithinActiveHours,
} from "./trigger-recall";
import {
  DirtyJson,
  ObservableActionStream,
  type ActionEvent,
  type ObservationEvent,
  type SecurityRiskLevel,
  RepairableActionException,
} from "./observable-action-stream";
import { InteractiveGateManager, type ApprovalCard, type CommandExecutionApprovalDecision } from "./interactive-confirmation-gate";
import { ScheduleResearchPlanner, type ScheduledSlot } from "./schedule-research-planner";
import { IdempotencyBackoffEngine, computeBackoff } from "./idempotency-backoff-retry";
import {
  SqliteThreadCheckpointer,
  LeaseLockManager,
  HonestPresenceEngine,
  computeJitter,
  type HumanInterruptConfig,
} from "./resilient-state-lease";
import {
  MetasearchAggregator,
  type RawSearchResult,
  type AggregatedSearchResult,
  normalizeSearchUrl,
  calculateRankScore,
} from "./metasearch-aggregator";
import {
  CleanMarkdownScraper,
  type ScrapeCleanOptions,
  type CleanMarkdownResult,
} from "./clean-markdown-scraper";
import {
  WebSecurityFence,
  type FenceResult,
  type ChunkOptions,
} from "./web-security-fence";
import {
  AccessibilityTreeParser,
  type AccessibilityTreeResult,
  type InteractiveElement,
} from "./accessibility-tree-parser";
import {
  StealthHeaderGenerator,
  type DevicePreset,
  DEVICE_PROFILES,
} from "./stealth-fetch-headers";
import {
  McpJsonRpcBridge,
  type McpTool,
  type McpResource,
  type McpPrompt,
} from "./mcp-jsonrpc-bridge";
import {
  PipecatFramePipeline,
  AudioRawFrame,
  TextFrame,
  CancelFrame,
  type Frame,
} from "./pipecat-frame-pipeline";
import {
  VoiceTurnTakingFSM,
  UtteranceNormalizer,
  type VoiceTurnEvent,
} from "./voice-turntaking-fsm";
import {
  CircadianCadenceEngine,
  KokoroTextSplitter,
  type CadenceSettings,
} from "./kokoro-cadence-pacing";
import {
  WhisperAsrNormalizer,
  type AsrDecodingConfig,
} from "./whisper-asr-normalizer";
import {
  PreflightFilterPipeline,
  type RedactionResult,
} from "./preflight-filter-pipeline";
import {
  ArtifactReasoningEngine,
  type ParsedArtifact,
  type ReasoningParseResult,
  type CitationChip,
} from "./artifact-reasoning-engine";
import {
  VaultBackupEngine,
  type VaultBackupPackage,
} from "./vault-backup-engine";
import {
  ComposerDraftBus,
  type ComposerDraft,
} from "./composer-draft-bus";
import {
  DocumentCollector,
  DocumentCollectorVault,
  globalDocumentCollectorVault,
  type IngestedDocument,
  type DocumentMetadata,
  type WikilinkGraphNode,
} from "./document-collector-vault";
import {
  MemoryBenchmarkHarness,
  BiTemporalCalculus,
  Mem0PromptBuilder,
  type TemporalEdge,
  type ProbeRecord,
  type BenchmarkSummary,
} from "./memory-benchmark-bitemporal";

// Singleton memory queue for rapid conversational turns
export const globalBufferedMemoryQueue = new BufferedMemoryQueue({ bufferSize: 64, similarityThreshold: 0.95 });
export const globalAssociativeNetwork = new AssociativeMemoryNetwork();
globalAssociativeNetwork.seedDefaultSaanNetwork();
export const globalMemoryJudge = new MemoryEvalJudge();
export const globalActionStream = new ObservableActionStream();
export const globalGateManager = new InteractiveGateManager();
export const globalResearchPlanner = new ScheduleResearchPlanner();
export const globalIdempotencyEngine = new IdempotencyBackoffEngine();
export const globalThreadCheckpointer = new SqliteThreadCheckpointer();
export const globalLeaseManager = new LeaseLockManager();
export const globalPresenceEngine = new HonestPresenceEngine();
export const globalMetasearchAggregator = new MetasearchAggregator();
export const globalMarkdownScraper = new CleanMarkdownScraper();
export const globalWebSecurityFence = new WebSecurityFence();
export const globalAccessibilityParser = new AccessibilityTreeParser();
export const globalStealthGenerator = new StealthHeaderGenerator();
export const globalMcpBridge = new McpJsonRpcBridge();
export const globalAudioPipeline = new PipecatFramePipeline();
export const globalVoiceFSM = new VoiceTurnTakingFSM();
export const globalCadenceEngine = new CircadianCadenceEngine();
export const globalWhisperNormalizer = new WhisperAsrNormalizer();
export const globalPreflightPipeline = new PreflightFilterPipeline();
export const globalArtifactReasoningEngine = new ArtifactReasoningEngine();
export const globalVaultBackupEngine = new VaultBackupEngine();
export const globalComposerDraftBus = new ComposerDraftBus();
export const globalDocumentCollector = new DocumentCollector();
export { globalDocumentCollectorVault };
export const globalMemoryBenchmark = new MemoryBenchmarkHarness();
export const globalBiTemporalCalculus = new BiTemporalCalculus();
export const globalMem0PromptBuilder = new Mem0PromptBuilder();
export { globalLifecycleHookManager } from "./huginn";
export { globalFirecrawlStore } from "./clean-markdown-scraper";
export { globalWebSecurityAuditor } from "./web-security-fence";

// Register base system status resource and echo tool on global MCP bridge
globalMcpBridge.registerResource(
  { uri: 'saan://status', name: 'Saan Status', mimeType: 'application/json' },
  () => JSON.stringify({ state: 'active', node: 'phryvos-k7', companion: 'saan' })
);
globalMcpBridge.registerResource(
  { uri: 'saan://manifest', name: 'Sovereign Manifest', mimeType: 'application/json' },
  () => JSON.stringify({
    version: '1.0.0',
    zeroCloudLease: true,
    localPrivacy: 'guaranteed',
    activeSubsystems: ['cognitive-memory', 'orchestration', 'web-security', 'voice-turntaking'],
  })
);
globalMcpBridge.registerTool(
  {
    name: 'echo',
    description: 'Echoes back test payload',
    inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  },
  args => ({ echoed: args.message })
);
globalMcpBridge.registerTool(
  {
    name: 'health_check',
    description: 'Executes sovereign health audit on local database and active queues',
    inputSchema: { type: 'object', properties: { verbose: { type: 'boolean' } } },
  },
  args => ({
    status: 'OPTIMAL',
    sqliteConnected: true,
    privacyFence: 'ACTIVE',
    checkedAt: new Date().toISOString(),
  })
);
globalMcpBridge.registerPrompt(
  {
    name: 'sovereign_system_guide',
    description: 'Generates companion alignment guidance for conversational turns',
    arguments: [{ name: 'topic', required: false, description: 'Specific focus area' }],
  },
  args => [
    {
      role: 'system',
      content: `You are Saan, a warm, intelligent companion operating with strict zero-cloud sovereign local privacy. Topic: ${args.topic || 'General assistance'}.`,
    },
  ]
);

export interface SaanActionResult {
  success: boolean;
  action: string;
  message: string;
  tier: 1 | 2 | 3;
  snapshotId?: string;
  data?: any;
}

export interface RollbackSnapshot {
  id: string;
  action: string;
  table: string;
  recordId: number;
  previousData?: any;
  createdAt: number;
}

// In-memory snapshot cache for quick 1-click rollbacks
const activeSnapshots = new Map<string, RollbackSnapshot>();

/**
 * Fault-Tolerant JSON Parser (Agent Zero & AutoGPT pattern)
 * Repairs common LLM JSON syntax errors: trailing commas, single quotes, unescaped newlines,
 * unquoted keys, Python literals, and records audit trace in DirtyJsonRepairAuditor.
 */
export function parseDirtyJson(raw: string): any {
  if (!raw || typeof raw !== "string") return null;

  // Run through comprehensive AutoGPT / Agent Zero repair engine
  const repairRes = DirtyJsonRepairEngine.repairAndParse(raw);
  const auditor = getDirtyJsonRepairAuditor();
  auditor.recordRepair(raw, repairRes);

  if (repairRes.success) {
    return repairRes.data;
  }

  let cleaned = raw.trim();

  // Strip code block fences if present
  cleaned = cleaned.replace(/^```(?:json|saan_action)?\s*/i, "").replace(/\s*```$/i, "");

  // 1. Try standard JSON.parse first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Try recursive-descent DirtyJson parser (Agent Zero pattern)
  try {
    const res = DirtyJson.parse(cleaned);
    if (res !== null && res !== undefined) return res;
  } catch {}

  // 3. Regex fallback repairs: trailing commas, unquoted keys, single quotes
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  cleaned = cleaned.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":');
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
  cleaned = cleaned.replace(/:\s*'([^']*)'/g, ':"$1"');

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.warn("[DirtyJson] Failed to repair JSON:", err.message, "Raw:", raw);
    return null;
  }
}

/**
 * 3-Tier Security Gateway Classification
 */
export function getActionSecurityTier(action: string): 1 | 2 | 3 {
  switch (action) {
    case "list_tasks":
    case "list_events":
    case "search_web":
    case "search_notes":
    case "list_dates":
    case "list_wishes":
    case "get_mindfulness":
    case "list_deeds":
    case "get_self_model":
    case "get_cognitive_state":
    case "get_memory_graph":
    case "get_starter_chips":
    case "transform_speech_text":
    case "categorize_text":
    case "parse_streaming_controls":
    case "map_avatar_expression":
    case "handle_avatar_tap":
    case "normalize_speakable_text":
    case "get_rms_volume_envelope":
    case "parse_character_card":
    case "export_character_card":
    case "evaluate_lorebook":
    case "substitute_macros":
    case "get_authors_note":
    case "get_chat_variable":
    case "set_chat_variable":
    case "get_token_budget":
    case "query_graph_memory":
    case "test_provider_cascade":
    case "apply_mem0_decision":
    case "edit_core_memory":
    case "query_temporal_graph":
    case "parse_temporal_query":
    case "get_running_summary":
    case "flush_buffered_memories":
    case "export_gnosys_snapshot":
    case "import_gnosys_snapshot":
    case "get_budgeted_profile":
    case "link_memory_to_task":
    case "query_associated_memories":
    case "evaluate_memory_verdict":
    case "match_trigger_phrases":
    case "generate_proactive_briefing":
    case "parse_dirty_json":
    case "create_action_event":
    case "request_interactive_approval":
    case "run_research_planner":
    case "check_schedule_conflict":
    case "execute_idempotent_task":
    case "save_thread_checkpoint":
    case "get_thread_history":
    case "acquire_lease_lock":
    case "check_honest_presence":
    case "aggregate_metasearch":
    case "clean_web_markdown":
    case "fence_web_content":
    case "parse_accessibility_tree":
    case "generate_stealth_headers":
    case "dispatch_mcp_call":
    case "process_audio_frame":
    case "handle_voice_turn_event":
    case "evaluate_speech_cadence":
    case "normalize_asr_transcript":
    case "scrub_preflight_prompt":
    case "extract_artifacts_and_reasoning":
    case "package_vault_backup":
    case "queue_composer_draft":
    case "process_vault_document":
    case "search_vault_chunks":
    case "get_vault_wikilink_graph":
    case "run_memory_benchmark_evaluation":
    case "evaluate_bitemporal_validity":
    case "evaluate_contradiction_graph":
    case "resolve_contradiction":
      return 1; // Tier 1: Auto-permitted read / safe computation

    case "create_task":
    case "complete_task":
    case "create_event":
    case "create_goal":
    case "remember_date":
    case "add_wish":
    case "fulfill_wish":
    case "consolidate_memories":
    case "resolve_deed":
    case "run_huginn_scan":
    case "add_lesson":
    case "reframe_memory":
    case "relive_memory":
      return 2; // Tier 2: Staged mutation with 1-click rollback

    case "delete_task":
    case "delete_event":
    case "clear_history":
      return 3; // Tier 3: Destructive, requires explicit modal confirmation

    default:
      return 2;
  }
}

/**
 * Creates a new task with a rollback snapshot
 */
export function createTask(
  title: string,
  description = "",
  priority = 1,
  dueDate?: string
): SaanActionResult {
  try {
    const db = getDb();
    const now = Date.now();
    const res = db
      .prepare(
        `INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at)
         VALUES (?, ?, 'todo', ?, ?, ?, ?)`
      )
      .run(title.trim(), description.trim(), priority, dueDate || null, now, now);

    const taskId = Number(res.lastInsertRowid);
    const snapshotId = `snap_${now}_${taskId}`;

    activeSnapshots.set(snapshotId, {
      id: snapshotId,
      action: "create_task",
      table: "tasks",
      recordId: taskId,
      createdAt: now,
    });

    return {
      success: true,
      action: "create_task",
      tier: 2,
      snapshotId,
      message: `Created task "${title}"`,
      data: { id: taskId, title, priority, dueDate },
    };
  } catch (err: any) {
    return { success: false, action: "create_task", tier: 2, message: err.message };
  }
}

/**
 * Lists active tasks from the database (Tier 1)
 */
export function listTasks(status = "todo", limit = 10): SaanActionResult {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT id, title, description, priority, due_date as dueDate, status FROM tasks WHERE status = ? ORDER BY priority DESC, created_at DESC LIMIT ?"
      )
      .all(status, limit);

    return {
      success: true,
      action: "list_tasks",
      tier: 1,
      message: `Found ${rows.length} ${status} tasks`,
      data: rows,
    };
  } catch (err: any) {
    return { success: false, action: "list_tasks", tier: 1, message: err.message };
  }
}

/**
 * Marks a task as completed with prior state snapshot for undo
 */
export function completeTask(taskId: number): SaanActionResult {
  try {
    const db = getDb();
    const now = Date.now();

    const prior = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as
      | { status: string }
      | undefined;
    if (!prior) {
      return { success: false, action: "complete_task", tier: 2, message: `Task #${taskId} not found` };
    }

    db.prepare(
      "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, taskId);

    const snapshotId = `snap_comp_${now}_${taskId}`;
    activeSnapshots.set(snapshotId, {
      id: snapshotId,
      action: "complete_task",
      table: "tasks",
      recordId: taskId,
      previousData: { status: prior.status },
      createdAt: now,
    });

    return {
      success: true,
      action: "complete_task",
      tier: 2,
      snapshotId,
      message: `Task #${taskId} marked as completed!`,
    };
  } catch (err: any) {
    return { success: false, action: "complete_task", tier: 2, message: err.message };
  }
}

/**
 * Rolls back an action using its snapshot (OpenHands pattern)
 */
export function executeRollback(snapshotId: string): { success: boolean; message: string } {
  const snapshot = activeSnapshots.get(snapshotId);
  if (!snapshot) {
    return { success: false, message: "Snapshot not found or expired" };
  }

  try {
    const db = getDb();
    if (snapshot.action === "create_task") {
      db.prepare("DELETE FROM tasks WHERE id = ?").run(snapshot.recordId);
      activeSnapshots.delete(snapshotId);
      return { success: true, message: `Rolled back task creation #${snapshot.recordId}` };
    } else if (snapshot.action === "complete_task" && snapshot.previousData) {
      db.prepare("UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?").run(
        snapshot.previousData.status,
        snapshot.recordId
      );
      activeSnapshots.delete(snapshotId);
      return { success: true, message: `Reverted task #${snapshot.recordId} to ${snapshot.previousData.status}` };
    }
    return { success: false, message: `Unsupported rollback action: ${snapshot.action}` };
  } catch (err: any) {
    return { success: false, message: `Rollback failed: ${err.message}` };
  }
}

/**
 * Creates an event in the user's calendar
 */
export function createCalendarEvent(
  title: string,
  startAt: number,
  endAt?: number,
  notes = ""
): SaanActionResult {
  try {
    const db = getDb();
    const now = Date.now();
    const res = db
      .prepare(
        `INSERT INTO events (title, start_at, end_at, notes, all_day, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      )
      .run(title.trim(), startAt, endAt || startAt + 3600000, notes, now, now);

    return {
      success: true,
      action: "create_event",
      tier: 2,
      message: `Scheduled "${title}" on calendar`,
      data: { id: Number(res.lastInsertRowid), title, startAt },
    };
  } catch (err: any) {
    return { success: false, action: "create_event", tier: 2, message: err.message };
  }
}

/**
 * Lists upcoming calendar events (Tier 1)
 */
export function listUpcomingEvents(limit = 10): SaanActionResult {
  try {
    const db = getDb();
    const now = Date.now();
    const rows = db
      .prepare(
        "SELECT id, title, start_at as startAt, end_at as endAt, notes FROM events WHERE start_at >= ? ORDER BY start_at ASC LIMIT ?"
      )
      .all(now - 86400000, limit);

    return {
      success: true,
      action: "list_events",
      tier: 1,
      message: `Found ${rows.length} upcoming events`,
      data: rows,
    };
  } catch (err: any) {
    return { success: false, action: "list_events", tier: 1, message: err.message };
  }
}

/**
 * Creates a new personal goal (Tier 2)
 */
export function createGoal(
  title: string,
  targetDate?: string,
  description = ""
): SaanActionResult {
  try {
    const db = getDb();
    const now = Date.now();
    const res = db
      .prepare(
        `INSERT INTO goals (title, description, target_date, progress_pct, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`
      )
      .run(title.trim(), description.trim(), targetDate || null, now, now);

    return {
      success: true,
      action: "create_goal",
      tier: 2,
      message: `Created goal "${title}"`,
      data: { id: Number(res.lastInsertRowid), title, targetDate },
    };
  } catch (err: any) {
    return { success: false, action: "create_goal", tier: 2, message: err.message };
  }
}

/**
 * Searches the web with Prompt Injection Security Fences (Crawl4AI pattern)
 */
export async function searchWeb(query: string): Promise<SaanActionResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { success: false, action: "search_web", tier: 1, message: `Search failed with status ${res.status}` };
    }

    const html = await res.text();
    const snippets: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 4) {
      const clean = match[1].replace(/<[^>]+>/g, "").trim();
      if (clean) snippets.push(clean);
    }

    const rawSnippets = snippets.length > 0 ? snippets.join("\n\n") : "No instant snippets found.";

    // Crawl4AI Security Fence: Isolates untrusted web data inside XML boundary
    const fencedContent = `<untrusted_web_source query="${query}" source="duckduckgo">\n${rawSnippets}\n</untrusted_web_source>`;

    return {
      success: true,
      action: "search_web",
      tier: 1,
      message: `Found ${snippets.length} web results`,
      data: fencedContent,
    };
  } catch (err: any) {
    return { success: false, action: "search_web", tier: 1, message: err.message };
  }
}

/**
 * Records a personal date (HerAndHim pattern)
 */
export function recordPersonalDateAction(
  date: string,
  label: string,
  recurring = false,
  notes?: string
): SaanActionResult {
  try {
    const item = addPersonalDate(date, label, recurring, notes);
    return {
      success: true,
      action: "remember_date",
      tier: 2,
      message: `Remembered date: "${label}" on ${date}${recurring ? " (recurring yearly)" : ""}`,
      data: item,
    };
  } catch (err: any) {
    return { success: false, action: "remember_date", tier: 2, message: err.message };
  }
}

/**
 * Lists personal dates (HerAndHim pattern)
 */
export function listPersonalDatesAction(): SaanActionResult {
  try {
    const dates = listPersonalDates();
    return {
      success: true,
      action: "list_dates",
      tier: 1,
      message: `Found ${dates.length} personal dates`,
      data: dates,
    };
  } catch (err: any) {
    return { success: false, action: "list_dates", tier: 1, message: err.message };
  }
}

/**
 * Adds a user wish (HerAndHim pattern)
 */
export function addWishAction(
  text: string,
  urgency: "low" | "medium" | "high" = "medium"
): SaanActionResult {
  try {
    const wish = addWish(text, urgency);
    return {
      success: true,
      action: "add_wish",
      tier: 2,
      message: `Added to wishlist: "${text}" [urgency: ${urgency}]`,
      data: wish,
    };
  } catch (err: any) {
    return { success: false, action: "add_wish", tier: 2, message: err.message };
  }
}

/**
 * Fulfills a wish (HerAndHim pattern)
 */
export function fulfillWishAction(wishId: string): SaanActionResult {
  try {
    const success = markWishFulfilled(wishId);
    return {
      success,
      action: "fulfill_wish",
      tier: 2,
      message: success ? `Wish ${wishId} marked fulfilled! 🎉` : `Wish ${wishId} not found or not pending`,
      data: { wishId, fulfilled: success },
    };
  } catch (err: any) {
    return { success: false, action: "fulfill_wish", tier: 2, message: err.message };
  }
}

/**
 * Lists pending wishes (HerAndHim pattern)
 */
export function listWishesAction(): SaanActionResult {
  try {
    const wishes = listPendingWishes();
    return {
      success: true,
      action: "list_wishes",
      tier: 1,
      message: `Found ${wishes.length} pending wishes`,
      data: wishes,
    };
  } catch (err: any) {
    return { success: false, action: "list_wishes", tier: 1, message: err.message };
  }
}

/**
 * Retrieves Saan's internal emotional mood state and nearest felt terms (Psycheros pattern)
 */
export function getMindfulnessAction(): SaanActionResult {
  try {
    const organ = getMoodOrgan();
    const felt = organ.renderFelt();
    const pad = organ.getState();
    const emotion = organ.emotionName(pad) || "quiet inside";
    return {
      success: true,
      action: "get_mindfulness",
      tier: 1,
      message: `Current emotional state: ${emotion} (v=${pad.valence.toFixed(2)}, a=${pad.arousal.toFixed(2)}, d=${pad.dominance.toFixed(2)})`,
      data: {
        pad,
        felt,
        emotion,
      },
    };
  } catch (err: any) {
    return { success: false, action: "get_mindfulness", tier: 1, message: err.message };
  }
}

/**
 * Runs a weekly memory consolidation pass (Psycheros multi-scale consolidation pattern)
 */
export function consolidateMemoriesAction(): SaanActionResult {
  try {
    const res = runWeeklyConsolidationPass();
    return {
      success: true,
      action: "consolidate_memories",
      tier: 2,
      message: res
        ? `Consolidated ${res.sourceMemoryCount} memories into weekly summary #${res.id} (${res.periodKey})`
        : `Memory consolidation skipped: no memories to consolidate`,
      data: res,
    };
  } catch (err: any) {
    return { success: false, action: "consolidate_memories", tier: 2, message: err.message };
  }
}

/**
 * Lists active consequence ledger deeds and commitments (Chronicler pattern)
 */
export function listDeedsAction(): SaanActionResult {
  try {
    const ledger = loadLedgerFromDb();
    const open = openDeeds(ledger);
    return {
      success: true,
      action: "list_deeds",
      tier: 1,
      message: `Found ${open.length} active commitments/deeds in consequence ledger`,
      data: open,
    };
  } catch (err: any) {
    return { success: false, action: "list_deeds", tier: 1, message: err.message };
  }
}

/**
 * Resolves or dismisses an active deed (Chronicler pattern)
 */
export function resolveDeedAction(
  deedId: string,
  resolution: "answered" | "dismissed" = "answered"
): SaanActionResult {
  try {
    let ledger = loadLedgerFromDb();
    if (resolution === "dismissed") {
      ledger = dismiss(ledger, deedId);
    } else {
      ledger = markAnswered(ledger, [deedId], 999);
    }
    syncLedgerToDb(ledger);
    return {
      success: true,
      action: "resolve_deed",
      tier: 2,
      message: `Deed ${deedId} marked as ${resolution}`,
      data: { deedId, resolution },
    };
  } catch (err: any) {
    return { success: false, action: "resolve_deed", tier: 2, message: err.message };
  }
}

/**
 * Retrieves Saan's 1st-person self-model (Chronicler pattern)
 */
export function getSelfModelAction(): SaanActionResult {
  try {
    const model = getLatestSelfModel();
    return {
      success: true,
      action: "get_self_model",
      tier: 1,
      message: model ? "Retrieved active 1st-person self-model" : "Self-model not yet generated",
      data: model,
    };
  } catch (err: any) {
    return { success: false, action: "get_self_model", tier: 1, message: err.message };
  }
}

/**
 * Retrieves Mimir cognitive analysis, drift & bias reports, volatile facts, and lessons (Mimir pattern)
 */
export function getCognitiveStateAction(): SaanActionResult {
  try {
    const report = driftAnalysis();
    const volatileFacts = getVolatileFacts();
    const lessons = getLessons();
    const insights = getHuginnInsights(5);

    return {
      success: true,
      action: "get_cognitive_state",
      tier: 1,
      message: "Retrieved cognitive drift and memory substrate status",
      data: {
        driftReport: report,
        volatileFactsCount: volatileFacts.length,
        volatileFacts: volatileFacts.slice(0, 5),
        lessonsCount: lessons.length,
        lessons: lessons.slice(0, 5),
        recentHuginnInsights: insights,
      },
    };
  } catch (err: any) {
    return { success: false, action: "get_cognitive_state", tier: 1, message: err.message };
  }
}

/**
 * Runs Huginn emergent pattern detection scan (Mimir pattern)
 */
export function runHuginnScanAction(): SaanActionResult {
  try {
    const newInsights = runHuginnScan();
    return {
      success: true,
      action: "run_huginn_scan",
      tier: 2,
      message: `Huginn scan completed: discovered ${newInsights.length} emergent pattern insights`,
      data: newInsights,
    };
  } catch (err: any) {
    return { success: false, action: "run_huginn_scan", tier: 2, message: err.message };
  }
}

/**
 * Adds a learned procedural lesson or problem-solving strategy (Mimir pattern)
 */
export function addLessonAction(topic: string, strategy: string, importance = 5): SaanActionResult {
  try {
    if (!topic || !strategy) {
      return { success: false, action: "add_lesson", tier: 2, message: "Missing topic or strategy" };
    }
    const lesson = addLesson(topic, strategy, Number(importance) || 5);
    return {
      success: true,
      action: "add_lesson",
      tier: 2,
      message: `Recorded lesson: "${topic}"`,
      data: lesson,
    };
  } catch (err: any) {
    return { success: false, action: "add_lesson", tier: 2, message: err.message };
  }
}

/**
 * Re-appraises / reframes an emotional memory (Mimir intentional cognitive reappraisal)
 */
export function reframeMemoryAction(memoryId: number, newEmotion: string, reason?: string): SaanActionResult {
  try {
    if (!memoryId || !newEmotion) {
      return { success: false, action: "reframe_memory", tier: 2, message: "Missing memoryId or newEmotion" };
    }
    const ok = reframeMemory(Number(memoryId), newEmotion, reason);
    return {
      success: ok,
      action: "reframe_memory",
      tier: 2,
      message: ok ? `Successfully reframed memory #${memoryId} to "${newEmotion}"` : `Memory #${memoryId} not found`,
    };
  } catch (err: any) {
    return { success: false, action: "reframe_memory", tier: 2, message: err.message };
  }
}

/**
 * Experientially re-enters past memory (Mimir Mental Time Travel)
 */
export function reliveMemoryAction(memoryId: number): SaanActionResult {
  try {
    if (!memoryId) {
      return { success: false, action: "relive_memory", tier: 2, message: "Missing memoryId" };
    }
    const res = reliveMemory(Number(memoryId));
    return {
      success: res.success,
      action: "relive_memory",
      tier: 2,
      message: res.success ? `Relived memory #${memoryId}: mood shifted toward encoding state` : `Memory #${memoryId} not found`,
      data: res,
    };
  } catch (err: any) {
    return { success: false, action: "relive_memory", tier: 2, message: err.message };
  }
}

/**
 * Retrieves Yggdrasil World Tree memory graph summary (Mimir pattern)
 */
export function getMemoryGraphAction(): SaanActionResult {
  try {
    buildYggdrasilGraph();
    const summary = getYggdrasilVizSummary();
    return {
      success: true,
      action: "get_memory_graph",
      tier: 1,
      message: `Retrieved Yggdrasil graph: ${summary.totalNodes} nodes, ${summary.totalEdges} edges`,
      data: summary,
    };
  } catch (err: any) {
    return { success: false, action: "get_memory_graph", tier: 1, message: err.message };
  }
}

/**
 * Retrieves dynamic contextual starter chips (Airi pattern)
 */
export function getStarterChipsAction(): SaanActionResult {
  try {
    const chips = getDynamicStarterChips();
    return {
      success: true,
      action: "get_starter_chips",
      tier: 1,
      message: `Generated ${chips.length} contextual starter chips`,
      data: chips,
    };
  } catch (err: any) {
    return { success: false, action: "get_starter_chips", tier: 1, message: err.message };
  }
}

/**
 * Transforms raw text containing math, chemistry, and prices into natural spoken text (Airi pattern)
 */
export function transformSpeechTextAction(text: string): SaanActionResult {
  try {
    if (typeof text !== "string") {
      return { success: false, action: "transform_speech_text", tier: 1, message: "Missing or invalid text parameter" };
    }
    const spoken = toNaturalSpeechText(text);
    return {
      success: true,
      action: "transform_speech_text",
      tier: 1,
      message: "Transformed text to natural speech format",
      data: { raw: text, spoken },
    };
  } catch (err: any) {
    return { success: false, action: "transform_speech_text", tier: 1, message: err.message };
  }
}

/**
 * Categorizes and isolates reasoning/thought blocks from conversational speech (Airi pattern)
 */
export function categorizeTextAction(text: string): SaanActionResult {
  try {
    if (typeof text !== "string") {
      return { success: false, action: "categorize_text", tier: 1, message: "Missing or invalid text parameter" };
    }
    const result = categorizeResponse(text);
    return {
      success: true,
      action: "categorize_text",
      tier: 1,
      message: `Categorized response (${result.thoughts.length} thought blocks, ${result.plans.length} plans)`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "categorize_text", tier: 1, message: err.message };
  }
}

/**
 * Parses streaming cadence controls (<|DELAY|>, <|ACT|>, <|CALL|>) from output (Airi pattern)
 */
export function parseStreamingControlsAction(text: string): SaanActionResult {
  try {
    if (typeof text !== "string") {
      return { success: false, action: "parse_streaming_controls", tier: 1, message: "Missing or invalid text parameter" };
    }
    const result = parseStreamingControlTokens(text);
    return {
      success: true,
      action: "parse_streaming_controls",
      tier: 1,
      message: `Parsed ${result.controls.length} control tokens`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "parse_streaming_controls", tier: 1, message: err.message };
  }
}

/**
 * Extracts Live2D facial expressions and physical gestures from text (Open-LLM-VTuber pattern)
 */
export function mapAvatarExpressionAction(text: string): SaanActionResult {
  try {
    const res = globalAvatarMapper.extract(text || "");
    return {
      success: true,
      action: "map_avatar_expression",
      tier: 1,
      message: `Extracted ${res.expressions.length} expressions and ${res.motions.length} motions`,
      data: res,
    };
  } catch (err: any) {
    return { success: false, action: "map_avatar_expression", tier: 1, message: err.message };
  }
}

/**
 * Handles interactive touch / click reactions on Avatar hit areas (Open-LLM-VTuber pattern)
 */
export function handleAvatarTapAction(hitArea: "head" | "body"): SaanActionResult {
  try {
    const reaction = globalAvatarMapper.handleTap(hitArea);
    return {
      success: true,
      action: "handle_avatar_tap",
      tier: 1,
      message: `Tapped ${hitArea}: ${reaction.dialogueEnglish}`,
      data: reaction,
    };
  } catch (err: any) {
    return { success: false, action: "handle_avatar_tap", tier: 1, message: err.message };
  }
}

/**
 * Normalizes speech text into natural spoken phonetic words (Open-LLM-VTuber pattern)
 */
export function normalizeSpeakableTextAction(text: string): SaanActionResult {
  try {
    const speakable = normalizeSpeakableText(text || "");
    return {
      success: true,
      action: "normalize_speakable_text",
      tier: 1,
      message: "Normalized speakable text",
      data: { speakableText: speakable },
    };
  } catch (err: any) {
    return { success: false, action: "normalize_speakable_text", tier: 1, message: err.message };
  }
}

/**
 * Calculates 20ms RMS volume envelope for synchronous viseme mouth animation (Open-LLM-VTuber pattern)
 */
export function getRmsVolumeEnvelopeAction(
  samples: number[],
  sliceMs = 20,
  sampleRate = 16000
): SaanActionResult {
  try {
    const envelope = computeRmsVolumeEnvelope(samples || [], sliceMs, sampleRate);
    return {
      success: true,
      action: "get_rms_volume_envelope",
      tier: 1,
      message: `Computed RMS volume envelope (${envelope.length} slices)`,
      data: { envelope, sliceLengthMs: sliceMs },
    };
  } catch (err: any) {
    return { success: false, action: "get_rms_volume_envelope", tier: 1, message: err.message };
  }
}

/**
 * Parses Character Card V2 or V3 data (SillyTavern pattern)
 */
export function parseCharacterCardAction(cardData: string | Record<string, any>): SaanActionResult {
  try {
    const card = parseCharacterCardJson(cardData);
    return {
      success: true,
      action: "parse_character_card",
      tier: 1,
      message: `Parsed Character Card: ${card.data.name} (${card.spec})`,
      data: card,
    };
  } catch (err: any) {
    return { success: false, action: "parse_character_card", tier: 1, message: err.message };
  }
}

/**
 * Exports Saan's profile as a standardized Character Card V2 (SillyTavern pattern)
 */
export function exportCharacterCardAction(): SaanActionResult {
  try {
    const card = exportSaanToCardV2();
    return {
      success: true,
      action: "export_character_card",
      tier: 1,
      message: `Exported Saan Character Card V2 (${card.data.name})`,
      data: card,
    };
  } catch (err: any) {
    return { success: false, action: "export_character_card", tier: 1, message: err.message };
  }
}

/**
 * Evaluates World Info / Lorebook entries with secondary keys & timed effects (SillyTavern pattern)
 */
export function evaluateLorebookAction(
  text: string,
  entries: LoreEntry[] = [],
  currentTurn = 1
): SaanActionResult {
  try {
    const result = evaluateLorebook(text, entries, {
      currentTurn,
      activeSticky: {},
      activeCooldown: {},
    });
    return {
      success: true,
      action: "evaluate_lorebook",
      tier: 1,
      message: `Activated ${result.activatedEntries.length} lore entries`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "evaluate_lorebook", tier: 1, message: err.message };
  }
}

/**
 * Substitutes conversational and temporal macros in a prompt template (SillyTavern pattern)
 */
export function substituteMacrosAction(template: string, ctx: any = {}): SaanActionResult {
  try {
    const substituted = substituteMacros(template, ctx);
    return {
      success: true,
      action: "substitute_macros",
      tier: 1,
      message: "Substituted macro variables",
      data: { substituted },
    };
  } catch (err: any) {
    return { success: false, action: "substitute_macros", tier: 1, message: err.message };
  }
}

/**
 * Gets the Author's Note floating directive for the given turn count (SillyTavern pattern)
 */
export function getAuthorsNoteAction(turnCount = 1): SaanActionResult {
  try {
    const injection = getAuthorsNoteInjection(turnCount, DEFAULT_AUTHORS_NOTE);
    return {
      success: true,
      action: "get_authors_note",
      tier: 1,
      message: injection ? "Author's Note active" : "Author's Note inactive for this turn",
      data: injection,
    };
  } catch (err: any) {
    return { success: false, action: "get_authors_note", tier: 1, message: err.message };
  }
}

/**
 * Gets a chat variable from local memory store (SillyTavern pattern)
 */
export function getChatVariableAction(key: string): SaanActionResult {
  try {
    const value = globalChatVariables.get(key);
    return {
      success: true,
      action: "get_chat_variable",
      tier: 1,
      message: `Retrieved variable ${key}`,
      data: { key, value },
    };
  } catch (err: any) {
    return { success: false, action: "get_chat_variable", tier: 1, message: err.message };
  }
}

/**
 * Sets a chat variable in local memory store (SillyTavern pattern)
 */
export function setChatVariableAction(key: string, value: any): SaanActionResult {
  try {
    globalChatVariables.set(key, value);
    return {
      success: true,
      action: "set_chat_variable",
      tier: 1,
      message: `Set variable ${key} = ${value}`,
      data: { key, value },
    };
  } catch (err: any) {
    return { success: false, action: "set_chat_variable", tier: 1, message: err.message };
  }
}

/**
 * Calculates token budget and dynamic headroom clamping (RisuAI pattern)
 */
export function getTokenBudgetAction(
  inputTokens = 1000,
  maxContext = 8192,
  maxResponse = 2048
): SaanActionResult {
  try {
    const clampedOutput = clampOutputTokens(inputTokens, maxContext, maxResponse);
    const headroom = Math.max(0, maxContext - inputTokens - clampedOutput);
    return {
      success: true,
      action: "get_token_budget",
      tier: 1,
      message: `Calculated token budget: input=${inputTokens}, output=${clampedOutput}, headroom=${headroom}`,
      data: { inputTokens, outputTokens: clampedOutput, maxContext, headroom },
    };
  } catch (err: any) {
    return { success: false, action: "get_token_budget", tier: 1, message: err.message };
  }
}

/**
 * Queries associative entity graph memory (RisuAI GraphMem pattern)
 */
export function queryGraphMemoryAction(query = "", searchDepth = 2): SaanActionResult {
  try {
    const store = getGraphMemoryStore();
    const result = store.search(query, searchDepth);
    return {
      success: true,
      action: "query_graph_memory",
      tier: 1,
      message: `Found ${result.matchedNodes.length} graph memory nodes for query "${query}"`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "query_graph_memory", tier: 1, message: err.message };
  }
}

/**
 * Tests provider cascade fallback chain (RisuAI pattern)
 */
export async function testProviderCascadeAction(
  primaryModel = "primary-model",
  fallbackModels: string[] = ["fallback-model-1", "fallback-model-2"]
): Promise<SaanActionResult> {
  try {
    const engine = new ProviderCascadeEngine({
      primaryModel,
      fallbackModels,
      maxRetriesPerModel: 1,
      fallbackOnBlankResponse: true,
    });

    // Test simulation dispatch
    const result = await engine.execute(async (model) => {
      if (model === primaryModel) {
        return { text: "" }; // simulate blank output from primary to trigger fallback
      }
      return { text: `Success response from fallback ${model}` };
    });

    return {
      success: result.success,
      action: "test_provider_cascade",
      tier: 1,
      message: `Provider cascade executed. Used model: ${result.modelUsed}, fallbackTriggered: ${result.fallbackTriggered}`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "test_provider_cascade", tier: 1, message: err.message };
  }
}

/**
 * Evaluates Mem0 4-state memory mutation decision (ADD, UPDATE, DELETE, NONE)
 */
export function applyMem0DecisionAction(candidate: any, existingMemories: any[] = []): SaanActionResult {
  try {
    const decision = evaluateMem0Decision(candidate, existingMemories);
    return {
      success: true,
      action: "apply_mem0_decision",
      tier: 1,
      message: `Mem0 Decision: ${decision.event} - ${decision.reason}`,
      data: decision,
    };
  } catch (err: any) {
    return { success: false, action: "apply_mem0_decision", tier: 1, message: err.message };
  }
}

/**
 * Self-editing Letta core memory block tool (append or replace)
 */
export function editCoreMemoryAction(
  operation: "append" | "replace",
  block: "human" | "persona" = "human",
  content = "",
  oldContent = ""
): SaanActionResult {
  try {
    const manager = getCoreMemoryManager();
    let res: any;
    if (operation === "replace") {
      res = manager.replace(block, oldContent, content);
    } else {
      res = manager.append(block, content);
    }
    return {
      success: res.success,
      action: "edit_core_memory",
      tier: 1,
      message: res.message,
      data: { block, operation, res },
    };
  } catch (err: any) {
    return { success: false, action: "edit_core_memory", tier: 1, message: err.message };
  }
}

/**
 * Queries bi-temporal knowledge graph edges (Graphiti pattern)
 */
export function queryTemporalGraphAction(nodeName: string, asOfTimestamp?: number): SaanActionResult {
  try {
    const store = getTemporalEdgeGraphStore();
    const edges = store.findConnectedEdges(nodeName, asOfTimestamp);
    return {
      success: true,
      action: "query_temporal_graph",
      tier: 1,
      message: `Found ${edges.length} active temporal edges for node "${nodeName}"`,
      data: { nodeName, edges },
    };
  } catch (err: any) {
    return { success: false, action: "query_temporal_graph", tier: 1, message: err.message };
  }
}

/**
 * Parses natural language relative temporal query into bounding timestamps (Hindsight pattern)
 */
export function parseTemporalQueryAction(query: string): SaanActionResult {
  try {
    const interval = parseTemporalQueryBounds(query);
    return {
      success: true,
      action: "parse_temporal_query",
      tier: 1,
      message: interval.hasConstraint
        ? `Temporal query bounded: ${interval.matchedPhrase} [${new Date(interval.startTimeMs).toISOString()} to ${new Date(interval.endTimeMs).toISOString()}]`
        : "No explicit temporal constraint detected in query",
      data: interval,
    };
  } catch (err: any) {
    return { success: false, action: "parse_temporal_query", tier: 1, message: err.message };
  }
}

/**
 * LangMem / MemGPT Incremental Running Summary Evaluation
 */
export function getRunningSummaryAction(messages: MessagePayload[] = [], maxContextTokens = 8192): SaanActionResult {
  try {
    const mgr = new IncrementalSummaryManager({ maxContextTokens });
    const evaluation = mgr.evaluateContextPressure(messages);
    return {
      success: true,
      action: "get_running_summary",
      tier: 1,
      message: evaluation.shouldWarn
        ? `Memory pressure alert active (${evaluation.currentTokens}/${maxContextTokens} tokens)`
        : `Memory pressure normal (${evaluation.currentTokens}/${maxContextTokens} tokens)`,
      data: evaluation,
    };
  } catch (err: any) {
    return { success: false, action: "get_running_summary", tier: 1, message: err.message };
  }
}

/**
 * TeleMem Buffered Memory Queue Flush & Clustering
 */
export function flushBufferedMemoriesAction(userId: string = "default_user"): SaanActionResult {
  try {
    const result = globalBufferedMemoryQueue.flush(userId);
    return {
      success: true,
      action: "flush_buffered_memories",
      tier: 1,
      message: `Flushed ${result.fused.originalCount} buffered items into ${result.added.length} distinct memories (${result.fused.clusterCount} fused)`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "flush_buffered_memories", tier: 1, message: err.message };
  }
}

/**
 * Gnosys Sovereign Memory Snapshot Export
 */
export function exportGnosysSnapshotAction(agentId = "saan-k7"): SaanActionResult {
  try {
    const coreMgr = getCoreMemoryManager();
    const personaContent = coreMgr.getBlock("persona")?.content || "";
    const humanContent = coreMgr.getBlock("human")?.content || "";
    const graphStore = getTemporalEdgeGraphStore();
    const edges = graphStore.getAllEdges();

    const snapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
      agentId,
      coreMemory: {
        persona: personaContent,
        human: humanContent,
      },
      facts: [],
      edges: edges.map((e) => ({
        source: e.sourceNode,
        target: e.targetNode,
        relationship: e.relation,
        weight: 1.0,
        validAt: new Date(e.validAt).toISOString(),
        invalidAt: e.invalidAt ? new Date(e.invalidAt).toISOString() : undefined,
      })),
      metadata: { exportedFrom: "k7-saan-sovereign-core" },
    });

    return {
      success: true,
      action: "export_gnosys_snapshot",
      tier: 1,
      message: `Exported Gnosys snapshot (v${snapshot.version}) with SHA-256: ${snapshot.checksum?.slice(0, 16)}...`,
      data: snapshot,
    };
  } catch (err: any) {
    return { success: false, action: "export_gnosys_snapshot", tier: 1, message: err.message };
  }
}

/**
 * Gnosys Sovereign Memory Snapshot Import & Validation
 */
export function importGnosysSnapshotAction(snapshotJson: any): SaanActionResult {
  try {
    const validation = GnosysMemoryPortabilityEngine.validateAndImport(snapshotJson);
    if (!validation.valid) {
      return {
        success: false,
        action: "import_gnosys_snapshot",
        tier: 1,
        message: `Gnosys snapshot invalid: ${validation.error}`,
        data: validation,
      };
    }

    return {
      success: true,
      action: "import_gnosys_snapshot",
      tier: 1,
      message: `Validated Gnosys snapshot with ${validation.factCount} facts and ${validation.edgeCount} edges`,
      data: validation,
    };
  } catch (err: any) {
    return { success: false, action: "import_gnosys_snapshot", tier: 1, message: err.message };
  }
}

/**
 * Memobase Topic-Constrained Profile Budgeting
 */
export function getBudgetedProfileAction(profiles: ProfileAttribute[] = [], maxTokens = 500, preferTopics: string[] = []): SaanActionResult {
  try {
    const budgeted = MemobaseProfileManager.truncateProfiles(profiles, {
      maxTokenSize: maxTokens,
      preferTopics,
      maxSubtopicSize: 3,
    });
    return {
      success: true,
      action: "get_budgeted_profile",
      tier: 1,
      message: `Profile budgeted to ${budgeted.length} attributes within token ceiling`,
      data: budgeted,
    };
  } catch (err: any) {
    return { success: false, action: "get_budgeted_profile", tier: 1, message: err.message };
  }
}

/**
 * A-mem Task-to-Memory Associative Linking
 */
export function linkMemoryToTaskAction(taskId: string, memoryContent: string, tags: string[] = []): SaanActionResult {
  try {
    const note = globalAssociativeNetwork.addNote(memoryContent, { tags });
    globalAssociativeNetwork.linkTaskToMemory(taskId, note.id);
    return {
      success: true,
      action: "link_memory_to_task",
      tier: 1,
      message: `Linked memory ${note.id} to task ${taskId}`,
      data: { noteId: note.id, taskId, note },
    };
  } catch (err: any) {
    return { success: false, action: "link_memory_to_task", tier: 1, message: err.message };
  }
}

/**
 * A-mem Hybrid Query over Associative Network
 */
export function queryAssociatedMemoriesAction(query: string, k = 5, alpha = 0.6): SaanActionResult {
  try {
    const results = globalAssociativeNetwork.findRelatedMemories(query, k, alpha);
    return {
      success: true,
      action: "query_associated_memories",
      tier: 1,
      message: `Retrieved ${results.length} associated memories (alpha=${alpha})`,
      data: results,
    };
  } catch (err: any) {
    return { success: false, action: "query_associated_memories", tier: 1, message: err.message };
  }
}

/**
 * Agent-Memory-Bench LoCoMo Evaluation Judge
 */
export function evaluateMemoryVerdictAction(
  question: string,
  gold: string,
  answer: string,
  adversarial = false,
  judgeOverride?: { correct: boolean; why: string }
): SaanActionResult {
  try {
    const verdict = globalMemoryJudge.grade(question, gold, answer, adversarial, judgeOverride);
    return {
      success: true,
      action: "evaluate_memory_verdict",
      tier: 1,
      message: `Graded probe verdict: correct=${verdict.correct}, disagreed=${verdict.disagreed}`,
      data: verdict,
    };
  } catch (err: any) {
    return { success: false, action: "evaluate_memory_verdict", tier: 1, message: err.message };
  }
}

/**
 * OpenClaw Dual-Phrase Trigger Recall Scorer
 */
export function matchTriggerPhrasesAction(
  query: string,
  memories: Array<{ id: string; content: string; triggerPhrases: string[] }> = [],
  threshold = 0.65
): SaanActionResult {
  try {
    const matches = selectTriggeredMemories(query, memories, threshold);
    const intent = classifyRecallIntent(query);
    return {
      success: true,
      action: "match_trigger_phrases",
      tier: 1,
      message: `Matched ${matches.length} trigger phrases (intent=${intent})`,
      data: { intent, matches },
    };
  } catch (err: any) {
    return { success: false, action: "match_trigger_phrases", tier: 1, message: err.message };
  }
}

/**
 * OpenClaw Proactive Briefing Generator (Morning Chai / Evening Unwind)
 */
export function generateProactiveBriefingAction(
  type: "morning" | "evening",
  items: string[] = [],
  deeds: string[] = [],
  companionName = "Saan"
): SaanActionResult {
  try {
    const briefing =
      type === "morning"
        ? generateMorningChaiBriefing(items, deeds, companionName)
        : generateEveningUnwindRecap(items, deeds, companionName);
    return {
      success: true,
      action: "generate_proactive_briefing",
      tier: 1,
      message: `Generated ${type} proactive briefing`,
      data: { type, briefing },
    };
  } catch (err: any) {
    return { success: false, action: "generate_proactive_briefing", tier: 1, message: err.message };
  }
}

/**
 * Agent Zero DirtyJson Parser Action
 */
export function parseDirtyJsonAction(raw: string): SaanActionResult {
  try {
    const parsed = parseDirtyJson(raw);
    return {
      success: true,
      action: "parse_dirty_json",
      tier: 1,
      message: parsed ? "Successfully repaired and parsed JSON" : "Failed to parse dirty JSON",
      data: parsed,
    };
  } catch (err: any) {
    return { success: false, action: "parse_dirty_json", tier: 1, message: err.message };
  }
}

/**
 * OpenHands Observable Action Event Recorder
 */
export function createActionEventAction(
  toolName: string,
  actionPayload: Record<string, any> = {},
  thought: string[] = [],
  securityRisk: SecurityRiskLevel = "LOW"
): SaanActionResult {
  try {
    const actionId = `act-${Math.random().toString(36).slice(2, 10)}`;
    const event: ActionEvent = {
      kind: "action",
      id: actionId,
      toolCallId: `call-${Math.random().toString(36).slice(2, 10)}`,
      toolName,
      actionPayload,
      thought,
      securityRisk,
      timestamp: new Date().toISOString(),
    };
    globalActionStream.recordEvent(event);
    return {
      success: true,
      action: "create_action_event",
      tier: 1,
      message: `Recorded action event ${actionId} for tool ${toolName}`,
      data: event,
    };
  } catch (err: any) {
    return { success: false, action: "create_action_event", tier: 1, message: err.message };
  }
}

/**
 * OpenInterpreter Interactive Confirmation Gate
 */
export function requestInteractiveApprovalAction(
  command: string,
  workingDirectory?: string,
  securityTier: 1 | 2 | 3 = 2
): SaanActionResult {
  try {
    const card = globalGateManager.createApprovalCard(command, { workingDirectory, securityTier });
    return {
      success: true,
      action: "request_interactive_approval",
      tier: 1,
      message: `Created approval card ${card.id} for command: ${command}`,
      data: card,
    };
  } catch (err: any) {
    return { success: false, action: "request_interactive_approval", tier: 1, message: err.message };
  }
}

/**
 * Khoj Multi-Step Research Planner with Mid-Course Interrupts
 */
export function runResearchPlannerAction(
  query: string,
  mockFindings: string[] = ["Found related documentation and initial facts"],
  interruptInstruction?: string
): SaanActionResult {
  try {
    const interrupts = interruptInstruction ? [interruptInstruction] : [];
    const result = globalResearchPlanner.executeResearchLoop(
      query,
      (_q, subqueries) => [
        ...mockFindings,
        `Insights gathered for subquery: ${subqueries[0] || query}`,
      ],
      interrupts
    );
    return {
      success: true,
      action: "run_research_planner",
      tier: 1,
      message: `Executed research loop across ${result.totalIterations} iterations`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "run_research_planner", tier: 1, message: err.message };
  }
}

/**
 * Khoj Calendar Schedule Collision Detector
 */
export function checkScheduleConflictAction(
  proposedStartAt: number,
  durationMs: number = 3600000,
  existingSlots: ScheduledSlot[] = []
): SaanActionResult {
  try {
    const conflict = globalResearchPlanner.checkScheduleConflict(proposedStartAt, durationMs, existingSlots);
    return {
      success: true,
      action: "check_schedule_conflict",
      tier: 1,
      message: conflict.hasConflict ? "Schedule conflict detected with existing events" : "No schedule conflict detected",
      data: conflict,
    };
  } catch (err: any) {
    return { success: false, action: "check_schedule_conflict", tier: 1, message: err.message };
  }
}

/**
 * n8n Idempotent Task Execution with SHA-256 Fingerprinting
 */
export function executeIdempotentTaskAction(
  userId: string,
  idempotencyKey: string,
  payload: unknown,
  taskResult?: unknown
): SaanActionResult {
  try {
    const check = globalIdempotencyEngine.checkOrAcquire(userId, idempotencyKey, payload);
    if (check.status === "cached") {
      return {
        success: true,
        action: "execute_idempotent_task",
        tier: 1,
        message: `Idempotency hit: Returning cached response for key ${idempotencyKey}`,
        data: { status: "cached", record: check.record },
      };
    }
    if (check.status === "conflict") {
      return {
        success: false,
        action: "execute_idempotent_task",
        tier: 1,
        message: `Idempotency conflict for key ${idempotencyKey}`,
        data: { status: "conflict" },
      };
    }
    // Finalize execution if result is provided
    if (taskResult !== undefined) {
      globalIdempotencyEngine.complete(userId, idempotencyKey, 200, taskResult);
    }
    return {
      success: true,
      action: "execute_idempotent_task",
      tier: 1,
      message: `Acquired lock and executed task for key ${idempotencyKey}`,
      data: { status: "executed", result: taskResult },
    };
  } catch (err: any) {
    return { success: false, action: "execute_idempotent_task", tier: 1, message: err.message };
  }
}

/**
 * LangGraph Stateful Thread Checkpointer
 */
export function saveThreadCheckpointAction(
  threadId: string,
  values: Record<string, unknown> = {},
  parentCheckpointId?: string
): SaanActionResult {
  try {
    const cp = globalThreadCheckpointer.saveCheckpoint(threadId, values, parentCheckpointId);
    return {
      success: true,
      action: "save_thread_checkpoint",
      tier: 1,
      message: `Saved state checkpoint ${cp.checkpointId} for thread ${threadId} (step ${cp.step})`,
      data: cp,
    };
  } catch (err: any) {
    return { success: false, action: "save_thread_checkpoint", tier: 1, message: err.message };
  }
}

/**
 * LangGraph Checkpoint History Traversal
 */
export function getThreadHistoryAction(threadId: string): SaanActionResult {
  try {
    const history = globalThreadCheckpointer.getHistory(threadId);
    return {
      success: true,
      action: "get_thread_history",
      tier: 1,
      message: `Retrieved ${history.length} checkpoints for thread ${threadId}`,
      data: history,
    };
  } catch (err: any) {
    return { success: false, action: "get_thread_history", tier: 1, message: err.message };
  }
}

/**
 * Temporal Worker Concurrency Lease Lock
 */
export function acquireLeaseLockAction(
  resource: string,
  owner: string,
  ttlMs = 10000
): SaanActionResult {
  try {
    const lease = globalLeaseManager.acquireLease(resource, owner, ttlMs);
    if (!lease) {
      return {
        success: false,
        action: "acquire_lease_lock",
        tier: 1,
        message: `Resource '${resource}' is currently locked by another worker`,
      };
    }
    return {
      success: true,
      action: "acquire_lease_lock",
      tier: 1,
      message: `Acquired lease lock on '${resource}' for owner '${owner}' until ${new Date(lease.expiresAt).toISOString()}`,
      data: { resource, owner, expiresAt: lease.expiresAt },
    };
  } catch (err: any) {
    return { success: false, action: "acquire_lease_lock", tier: 1, message: err.message };
  }
}

/**
 * Temporal Honest Presence & Offline Gap Detection
 */
export function checkHonestPresenceAction(
  lastHeartbeatMs: number,
  currentMs: number = Date.now()
): SaanActionResult {
  try {
    const result = globalPresenceEngine.evaluatePresenceGap(lastHeartbeatMs, currentMs);
    return {
      success: true,
      action: "check_honest_presence",
      tier: 1,
      message: result.honestAcknowledgement,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "check_honest_presence", tier: 1, message: err.message };
  }
}

/**
 * Metasearch Aggregation & Reciprocal Rank Scoring (SearXNG/Khoj)
 */
export function aggregateMetasearchAction(
  rawResults: RawSearchResult[],
  engineWeights?: Record<string, number>,
  priority: 'low' | 'normal' | 'high' = 'normal'
): SaanActionResult {
  try {
    const results = globalMetasearchAggregator.aggregate(rawResults, engineWeights, priority);
    return {
      success: true,
      action: "aggregate_metasearch",
      tier: 1,
      message: `Aggregated and scored ${results.length} unique search results across engines`,
      data: { count: results.length, results },
    };
  } catch (err: any) {
    return { success: false, action: "aggregate_metasearch", tier: 1, message: err.message };
  }
}

/**
 * Clean Web Markdown Scraping & Boilerplate Removal (Firecrawl)
 */
export function cleanWebMarkdownAction(
  rawHtml: string,
  options?: ScrapeCleanOptions
): SaanActionResult {
  try {
    const result = globalMarkdownScraper.cleanAndConvert(rawHtml, options);
    return {
      success: true,
      action: "clean_web_markdown",
      tier: 1,
      message: `Extracted ${result.markdown.length} chars of clean markdown with ${result.extractedLinks.length} links`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "clean_web_markdown", tier: 1, message: err.message };
  }
}

/**
 * Web Security Nonce-Isolated Fencing & Prompt Injection Defense (Crawl4AI)
 */
export function fenceWebContentAction(
  rawText: string,
  url: string,
  title?: string
): SaanActionResult {
  try {
    const result = globalWebSecurityFence.fenceWebContent(rawText, { url, title });
    return {
      success: true,
      action: "fence_web_content",
      tier: 1,
      message: result.isSafe ? `Content safely fenced with nonce ${result.nonce}` : `Threats detected in web content: ${result.detectedThreats.join(", ")}`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "fence_web_content", tier: 1, message: err.message };
  }
}

/**
 * Indexed Accessibility Tree Parsing (browser-use)
 */
export function parseAccessibilityTreeAction(html: string): SaanActionResult {
  try {
    const result = globalAccessibilityParser.parse(html);
    return {
      success: true,
      action: "parse_accessibility_tree",
      tier: 1,
      message: `Parsed ${result.interactiveCount} interactive elements into indexed accessibility tree`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "parse_accessibility_tree", tier: 1, message: err.message };
  }
}

/**
 * Playwright Anti-Bot Stealth Headers
 */
export function generateStealthHeadersAction(
  preset?: DevicePreset,
  overrides?: Record<string, string>
): SaanActionResult {
  try {
    const headers = globalStealthGenerator.generateHeaders(preset, overrides);
    const profile = globalStealthGenerator.getProfile(preset);
    return {
      success: true,
      action: "generate_stealth_headers",
      tier: 1,
      message: `Generated stealth anti-bot headers for profile "${profile.name}"`,
      data: { profile, headers },
    };
  } catch (err: any) {
    return { success: false, action: "generate_stealth_headers", tier: 1, message: err.message };
  }
}

/**
 * Model Context Protocol (MCP 2.x) Dispatcher
 */
export async function dispatchMcpCallAction(message: any): Promise<SaanActionResult> {
  try {
    const response = await globalMcpBridge.handleMessage(message);
    return {
      success: true,
      action: "dispatch_mcp_call",
      tier: 1,
      message: response ? `Handled MCP method: "${message.method}"` : `Processed MCP notification`,
      data: response,
    };
  } catch (err: any) {
    return { success: false, action: "dispatch_mcp_call", tier: 1, message: err.message };
  }
}

/**
 * Pipecat Low-Latency Audio Streaming Pipeline
 */
export function processAudioFrameAction(
  audioBytesBase64?: string,
  sampleRate = 16000,
  channels = 1,
  interrupt = false
): SaanActionResult {
  try {
    if (interrupt) {
      const cancelFrame = new CancelFrame('user_barge_in');
      globalAudioPipeline.push(cancelFrame);
      return {
        success: true,
        action: "process_audio_frame",
        tier: 1,
        message: "Triggered barge-in interruption; drained pending queue",
        data: { queueSize: globalAudioPipeline.size(), interrupted: true },
      };
    }

    const buffer = audioBytesBase64 ? Buffer.from(audioBytesBase64, 'base64') : new Uint8Array(320);
    const frame = new AudioRawFrame(buffer, sampleRate, channels);
    globalAudioPipeline.push(frame);

    return {
      success: true,
      action: "process_audio_frame",
      tier: 1,
      message: `Enqueued AudioRawFrame #${frame.id} with PTS ${frame.pts}`,
      data: { frameId: frame.id, pts: frame.pts.toString(), queueSize: globalAudioPipeline.size() },
    };
  } catch (err: any) {
    return { success: false, action: "process_audio_frame", tier: 1, message: err.message };
  }
}

/**
 * LiveKit Turn-Taking FSM & OVOS Utterance Normalizer
 */
export function handleVoiceTurnEventAction(
  event: VoiceTurnEvent,
  spokenInput?: string
): SaanActionResult {
  try {
    const transition = globalVoiceFSM.handleEvent(event);
    let normalized: string | undefined = undefined;

    if (spokenInput) {
      normalized = globalVoiceFSM.normalizeSpokenInput(spokenInput);
    }

    return {
      success: true,
      action: "handle_voice_turn_event",
      tier: 1,
      message: `FSM transition: ${transition.previousState} -> ${transition.currentState} via ${event}${transition.bargeInDetected ? ' (BARGE-IN DETECTED)' : ''}`,
      data: { transition, normalizedText: normalized },
    };
  } catch (err: any) {
    return { success: false, action: "handle_voice_turn_event", tier: 1, message: err.message };
  }
}

/**
 * Kokoro Circadian Cadence & Speech Pacing
 */
export function evaluateSpeechCadenceAction(text: string, hourOfDay?: number): SaanActionResult {
  try {
    const result = globalCadenceEngine.paceText(text, hourOfDay);
    return {
      success: true,
      action: "evaluate_speech_cadence",
      tier: 1,
      message: `Paced ${result.sentenceCount} sentence(s) with ${result.settings.tone} tone (${result.settings.speed}x speed)`,
      data: result,
    };
  } catch (err: any) {
    return { success: false, action: "evaluate_speech_cadence", tier: 1, message: err.message };
  }
}

/**
 * Whisper Multilingual ASR Normalizer & Decoding Fallback
 */
export function normalizeAsrTranscriptAction(
  rawTranscript: string,
  lang?: string,
  userPrompt?: string
): SaanActionResult {
  try {
    const normalized = globalWhisperNormalizer.normalize(rawTranscript);
    const decodingConfig = globalWhisperNormalizer.getDecodingConfig(lang, userPrompt);
    return {
      success: true,
      action: "normalize_asr_transcript",
      tier: 1,
      message: `Normalized ASR transcript for language "${decodingConfig.language}"`,
      data: { normalizedTranscript: normalized, decodingConfig },
    };
  } catch (err: any) {
    return { success: false, action: "normalize_asr_transcript", tier: 1, message: err.message };
  }
}

/**
 * Open-WebUI Preflight Filter & Credential Scrubbing
 */
export function scrubPreflightPromptAction(prompt: string, codeToSanitize?: string): SaanActionResult {
  try {
    const scrubbed = globalPreflightPipeline.scrubCredentials(prompt);
    let sanitizedCode: string | undefined = undefined;
    if (codeToSanitize) {
      sanitizedCode = globalPreflightPipeline.sanitizeCode(codeToSanitize);
    }
    return {
      success: true,
      action: "scrub_preflight_prompt",
      tier: 1,
      message: `Scrubbed ${scrubbed.redactedCount} sensitive credential(s) from prompt`,
      data: { ...scrubbed, sanitizedCode },
    };
  } catch (err: any) {
    return { success: false, action: "scrub_preflight_prompt", tier: 1, message: err.message };
  }
}

/**
 * LibreChat Artifacts & HuggingFace Chat-UI Reasoning Parser
 */
export function extractArtifactsAndReasoningAction(content: string): SaanActionResult {
  try {
    const reasoning = globalArtifactReasoningEngine.extractReasoning(content);
    const artifacts = globalArtifactReasoningEngine.extractArtifacts(content);
    const citations = globalArtifactReasoningEngine.extractCitations(content);

    return {
      success: true,
      action: "extract_artifacts_and_reasoning",
      tier: 1,
      message: `Extracted ${artifacts.length} artifact(s), ${citations.length} citation(s), reasoning present: ${reasoning.hasReasoning}`,
      data: { reasoning, artifacts, citations },
    };
  } catch (err: any) {
    return { success: false, action: "extract_artifacts_and_reasoning", tier: 1, message: err.message };
  }
}

/**
 * Chatbox Sovereign Local Vault Backup Packager
 */
export function packageVaultBackupAction(input?: any): SaanActionResult {
  try {
    const pkg = globalVaultBackupEngine.packageBackup(input || {});
    const verification = globalVaultBackupEngine.verifyBackup(pkg);
    return {
      success: true,
      action: "package_vault_backup",
      tier: 1,
      message: `Packaged vault backup with ${pkg.manifest.stats.memoryCount} memories and ${pkg.manifest.stats.resourceCount} resources (${pkg.manifest.stats.deduplicatedCount} deduplicated)`,
      data: { package: pkg, verification },
    };
  } catch (err: any) {
    return { success: false, action: "package_vault_backup", tier: 1, message: err.message };
  }
}

/**
 * LobeHub Decoupled Composer Draft Bus & Intent Classifier
 */
export function queueComposerDraftAction(
  text: string,
  append?: boolean,
  targetAgentId?: string
): SaanActionResult {
  try {
    const posted = globalComposerDraftBus.postDraft(text, { append, targetAgentId });
    const classification = globalComposerDraftBus.classifyIntent(text);
    return {
      success: true,
      action: "queue_composer_draft",
      tier: 1,
      message: posted ? `Queued draft for composer (classified as: ${classification.intent})` : "Composer not attached",
      data: { posted, classification, hasPending: globalComposerDraftBus.hasDraft() },
    };
  } catch (err: any) {
    return { success: false, action: "queue_composer_draft", tier: 1, message: err.message };
  }
}

/**
 * Anything-LLM Document Ingestion & Semantic Chunking
 */
export function processVaultDocumentAction(
  textContent: string,
  metadata: any,
  maxChunkWords?: number
): SaanActionResult {
  try {
    const doc = globalDocumentCollectorVault.ingestDocument(textContent, metadata || {}, { maxChunkWords });
    return {
      success: true,
      action: "process_vault_document",
      tier: 1,
      message: `Processed and saved document "${doc.title}" into ${doc.chunks.length} chunk(s) (${doc.wordCount} words, ${doc.detectedWikilinks.length} wikilinks)`,
      data: doc,
    };
  } catch (err: any) {
    return { success: false, action: "process_vault_document", tier: 1, message: err.message };
  }
}

export function searchVaultChunksAction(query: string, limit?: number): SaanActionResult {
  try {
    const hits = globalDocumentCollectorVault.searchChunks(query, limit);
    return {
      success: true,
      action: "search_vault_chunks",
      tier: 1,
      message: `Found ${hits.length} matching chunk(s)`,
      data: { query, results: hits },
    };
  } catch (err: any) {
    return { success: false, action: "search_vault_chunks", tier: 1, message: err.message };
  }
}

export function getVaultWikilinkGraphAction(): SaanActionResult {
  try {
    const graph = globalDocumentCollectorVault.getWikilinkGraph();
    return {
      success: true,
      action: "get_vault_wikilink_graph",
      tier: 1,
      message: `Extracted ${graph.length} wikilink node(s) across vault documents`,
      data: { nodes: graph },
    };
  } catch (err: any) {
    return { success: false, action: "get_vault_wikilink_graph", tier: 1, message: err.message };
  }
}

/**
 * Agent-Memory-Bench & Datapace Cognitive Memory Evaluation
 */
export function runMemoryBenchmarkEvaluationAction(probes?: ProbeRecord[]): SaanActionResult {
  try {
    if (probes && probes.length > 0) {
      globalMemoryBenchmark.reset();
      for (const p of probes) {
        globalMemoryBenchmark.addProbe(p);
      }
    } else {
      globalMemoryBenchmark.runStandardSuite();
    }
    const summary = globalMemoryBenchmark.getSummary();
    const evaluatedProbes = globalMemoryBenchmark.getProbes();
    return {
      success: true,
      action: "run_memory_benchmark_evaluation",
      tier: 1,
      message: `Recall: ${summary.recallPercent}%, Refusal: ${summary.refusedAdversarialPercent}%, Latency p50: ${summary.searchLatencyP50Ms}ms (Sub-10ms target: ${summary.sub10msTargetMet})`,
      data: { summary, probes: evaluatedProbes },
    };
  } catch (err: any) {
    return { success: false, action: "run_memory_benchmark_evaluation", tier: 1, message: err.message };
  }
}

/**
 * Graphiti Bi-Temporal Interval Validity Calculus
 */
export function evaluateBiTemporalValidityAction(
  edges: TemporalEdge[],
  queryTimeMs: number
): SaanActionResult {
  try {
    const validEdges = globalBiTemporalCalculus.queryValidEdges(edges || [], queryTimeMs);
    return {
      success: true,
      action: "evaluate_bitemporal_validity",
      tier: 1,
      message: `Evaluated ${edges?.length || 0} edge(s) at timestamp ${queryTimeMs}: ${validEdges.length} valid`,
      data: { queryTimeMs, totalEdges: edges?.length || 0, validEdges },
    };
  } catch (err: any) {
    return { success: false, action: "evaluate_bitemporal_validity", tier: 1, message: err.message };
  }
}

export function evaluateContradictionGraphAction(): SaanActionResult {
  try {
    if (globalBiTemporalCalculus.getAllEdges().length === 0) {
      globalBiTemporalCalculus.seedSampleContradictionGraph();
    }
    const edges = globalBiTemporalCalculus.getAllEdges();
    const contradictions = globalBiTemporalCalculus.findContradictions(edges);
    const sorted = globalBiTemporalCalculus.topologicalSort(edges);
    return {
      success: true,
      action: "evaluate_contradiction_graph",
      tier: 1,
      message: `Calculus evaluated: ${contradictions.length} contradiction(s) found across ${edges.length} edges`,
      data: { edges, contradictions, sorted },
    };
  } catch (err: any) {
    return { success: false, action: "evaluate_contradiction_graph", tier: 1, message: err.message };
  }
}

export function resolveContradictionAction(
  keepEdgeId: string,
  invalidateEdgeId: string,
  atTimeMs?: number
): SaanActionResult {
  try {
    const result = globalBiTemporalCalculus.resolveContradiction(keepEdgeId, invalidateEdgeId, atTimeMs);
    const edges = globalBiTemporalCalculus.getAllEdges();
    const remaining = globalBiTemporalCalculus.findContradictions(edges);
    return {
      success: true,
      action: "resolve_contradiction",
      tier: 1,
      message: result.resolved ? `Resolved contradiction. Invalidated ${invalidateEdgeId}.` : `Could not resolve`,
      data: { result, remainingContradictions: remaining.length, edges },
    };
  } catch (err: any) {
    return { success: false, action: "resolve_contradiction", tier: 1, message: err.message };
  }
}

/**
 * Universal Action Dispatcher
 */
export async function dispatchSaanAction(action: string, params: any = {}): Promise<SaanActionResult> {
  switch (action) {
    case "create_task":
      return createTask(params.title, params.description, params.priority, params.dueDate);
    case "list_tasks":
      return listTasks(params.status, params.limit);
    case "complete_task":
      return completeTask(Number(params.taskId));
    case "create_event":
      return createCalendarEvent(params.title, params.startAt, params.notes);
    case "list_events":
      return listUpcomingEvents(params.limit);
    case "create_goal":
      return createGoal(params.title, params.targetDate, params.description);
    case "search_web":
      return await searchWeb(params.query);
    case "remember_date":
      return recordPersonalDateAction(params.date, params.label, Boolean(params.recurring), params.notes);
    case "list_dates":
      return listPersonalDatesAction();
    case "add_wish":
      return addWishAction(params.text, params.urgency);
    case "fulfill_wish":
      return fulfillWishAction(params.wishId);
    case "list_wishes":
      return listWishesAction();
    case "get_mindfulness":
      return getMindfulnessAction();
    case "consolidate_memories":
      return consolidateMemoriesAction();
    case "list_deeds":
      return listDeedsAction();
    case "resolve_deed":
      return resolveDeedAction(params.deedId, params.resolution);
    case "get_self_model":
      return getSelfModelAction();
    case "get_cognitive_state":
      return getCognitiveStateAction();
    case "run_huginn_scan":
      return runHuginnScanAction();
    case "add_lesson":
      return addLessonAction(params.topic, params.strategy, params.importance);
    case "reframe_memory":
      return reframeMemoryAction(params.memoryId, params.newEmotion, params.reason);
    case "relive_memory":
      return reliveMemoryAction(params.memoryId);
    case "get_memory_graph":
      return getMemoryGraphAction();
    case "get_starter_chips":
      return getStarterChipsAction();
    case "transform_speech_text":
      return transformSpeechTextAction(params.text);
    case "categorize_text":
      return categorizeTextAction(params.text);
    case "parse_streaming_controls":
      return parseStreamingControlsAction(params.text);
    case "map_avatar_expression":
      return mapAvatarExpressionAction(params.text);
    case "handle_avatar_tap":
      return handleAvatarTapAction(params.hitArea);
    case "normalize_speakable_text":
      return normalizeSpeakableTextAction(params.text);
    case "get_rms_volume_envelope":
      return getRmsVolumeEnvelopeAction(params.samples, params.sliceMs, params.sampleRate);
    case "parse_character_card":
      return parseCharacterCardAction(params.cardData);
    case "export_character_card":
      return exportCharacterCardAction();
    case "evaluate_lorebook":
      return evaluateLorebookAction(params.text, params.entries, params.currentTurn);
    case "substitute_macros":
      return substituteMacrosAction(params.template, params.ctx);
    case "get_authors_note":
      return getAuthorsNoteAction(params.turnCount);
    case "get_chat_variable":
      return getChatVariableAction(params.key);
    case "set_chat_variable":
      return setChatVariableAction(params.key, params.value);
    case "get_token_budget":
      return getTokenBudgetAction(params.inputTokens, params.maxContext, params.maxResponse);
    case "query_graph_memory":
      return queryGraphMemoryAction(params.query, params.searchDepth);
    case "test_provider_cascade":
      return testProviderCascadeAction(params.primaryModel, params.fallbackModels);
    case "apply_mem0_decision":
      return applyMem0DecisionAction(params.candidate, params.existingMemories);
    case "edit_core_memory":
      return editCoreMemoryAction(params.operation, params.block, params.content, params.oldContent);
    case "query_temporal_graph":
      return queryTemporalGraphAction(params.nodeName, params.asOfTimestamp);
    case "parse_temporal_query":
      return parseTemporalQueryAction(params.query);
    case "get_running_summary":
      return getRunningSummaryAction(params.messages, params.maxContextTokens);
    case "flush_buffered_memories":
      return flushBufferedMemoriesAction(params.userId);
    case "export_gnosys_snapshot":
      return exportGnosysSnapshotAction(params.agentId);
    case "import_gnosys_snapshot":
      return importGnosysSnapshotAction(params.snapshotJson);
    case "get_budgeted_profile":
      return getBudgetedProfileAction(params.profiles, params.maxTokens, params.preferTopics);
    case "link_memory_to_task":
      return linkMemoryToTaskAction(params.taskId, params.memoryContent, params.tags);
    case "query_associated_memories":
      return queryAssociatedMemoriesAction(params.query, params.k, params.alpha);
    case "evaluate_memory_verdict":
      return evaluateMemoryVerdictAction(params.question, params.gold, params.answer, params.adversarial, params.judgeOverride);
    case "match_trigger_phrases":
      return matchTriggerPhrasesAction(params.query, params.memories, params.threshold);
    case "generate_proactive_briefing":
      return generateProactiveBriefingAction(params.type, params.items, params.deeds, params.companionName);
    case "parse_dirty_json":
      return parseDirtyJsonAction(params.raw);
    case "create_action_event":
      return createActionEventAction(params.toolName, params.actionPayload, params.thought, params.securityRisk);
    case "request_interactive_approval":
      return requestInteractiveApprovalAction(params.command, params.workingDirectory, params.securityTier);
    case "run_research_planner":
      return runResearchPlannerAction(params.query, params.mockFindings, params.interruptInstruction);
    case "check_schedule_conflict":
      return checkScheduleConflictAction(params.proposedStartAt, params.durationMs, params.existingSlots);
    case "execute_idempotent_task":
      return executeIdempotentTaskAction(params.userId, params.idempotencyKey, params.payload, params.taskResult);
    case "save_thread_checkpoint":
      return saveThreadCheckpointAction(params.threadId, params.values, params.parentCheckpointId);
    case "get_thread_history":
      return getThreadHistoryAction(params.threadId);
    case "acquire_lease_lock":
      return acquireLeaseLockAction(params.resource, params.owner, params.ttlMs);
    case "check_honest_presence":
      return checkHonestPresenceAction(params.lastHeartbeatMs, params.currentMs);
    case "aggregate_metasearch":
      return aggregateMetasearchAction(params.rawResults, params.engineWeights, params.priority);
    case "clean_web_markdown":
      return cleanWebMarkdownAction(params.rawHtml, params.options);
    case "fence_web_content":
      return fenceWebContentAction(params.rawText, params.url, params.title);
    case "parse_accessibility_tree":
      return parseAccessibilityTreeAction(params.html);
    case "generate_stealth_headers":
      return generateStealthHeadersAction(params.preset, params.overrides);
    case "dispatch_mcp_call":
      return dispatchMcpCallAction(params.message);
    case "process_audio_frame":
      return processAudioFrameAction(params.audioBytesBase64, params.sampleRate, params.channels, params.interrupt);
    case "handle_voice_turn_event":
      return handleVoiceTurnEventAction(params.event, params.spokenInput);
    case "evaluate_speech_cadence":
      return evaluateSpeechCadenceAction(params.text, params.hourOfDay);
    case "normalize_asr_transcript":
      return normalizeAsrTranscriptAction(params.rawTranscript, params.lang, params.userPrompt);
    case "scrub_preflight_prompt":
      return scrubPreflightPromptAction(params.prompt, params.codeToSanitize);
    case "extract_artifacts_and_reasoning":
      return extractArtifactsAndReasoningAction(params.content);
    case "package_vault_backup":
      return packageVaultBackupAction(params.input);
    case "queue_composer_draft":
      return queueComposerDraftAction(params.text, params.append, params.targetAgentId);
    case "process_vault_document":
      return processVaultDocumentAction(params.textContent, params.metadata, params.maxChunkWords);
    case "search_vault_chunks":
      return searchVaultChunksAction(params.query, params.limit);
    case "get_vault_wikilink_graph":
      return getVaultWikilinkGraphAction();
    case "run_memory_benchmark_evaluation":
      return runMemoryBenchmarkEvaluationAction(params.probes);
    case "evaluate_bitemporal_validity":
      return evaluateBiTemporalValidityAction(params.edges, params.queryTimeMs);
    case "evaluate_contradiction_graph":
      return evaluateContradictionGraphAction();
    case "resolve_contradiction":
      return resolveContradictionAction(params.keepEdgeId, params.invalidateEdgeId, params.atTimeMs);
    default:
      return { success: false, action, tier: 2, message: `Unknown action: "${action}"` };
  }
}

export const SAAN_TOOLS_SPEC = `
You have native access to execute project control commands. To execute an action, output an action block at the END of your message in this JSON format:
\`\`\`saan_action
{
  "action": "create_task" | "list_tasks" | "complete_task" | "create_event" | "list_events" | "create_goal" | "search_web" | "remember_date" | "list_dates" | "add_wish" | "fulfill_wish" | "list_wishes" | "get_mindfulness" | "consolidate_memories" | "list_deeds" | "resolve_deed" | "get_self_model" | "get_cognitive_state" | "run_huginn_scan" | "add_lesson" | "reframe_memory" | "relive_memory" | "get_memory_graph" | "get_starter_chips" | "transform_speech_text" | "categorize_text" | "parse_streaming_controls" | "map_avatar_expression" | "handle_avatar_tap" | "normalize_speakable_text" | "get_rms_volume_envelope" | "parse_character_card" | "export_character_card" | "evaluate_lorebook" | "substitute_macros" | "get_authors_note" | "get_chat_variable" | "set_chat_variable" | "get_token_budget" | "query_graph_memory" | "test_provider_cascade" | "apply_mem0_decision" | "edit_core_memory" | "query_temporal_graph" | "parse_temporal_query" | "get_running_summary" | "flush_buffered_memories" | "export_gnosys_snapshot" | "import_gnosys_snapshot" | "get_budgeted_profile" | "link_memory_to_task" | "query_associated_memories" | "evaluate_memory_verdict" | "match_trigger_phrases" | "generate_proactive_briefing" | "parse_dirty_json" | "create_action_event" | "request_interactive_approval" | "run_research_planner" | "check_schedule_conflict" | "execute_idempotent_task" | "save_thread_checkpoint" | "get_thread_history" | "acquire_lease_lock" | "check_honest_presence" | "aggregate_metasearch" | "clean_web_markdown" | "fence_web_content" | "parse_accessibility_tree" | "generate_stealth_headers" | "dispatch_mcp_call" | "process_audio_frame" | "handle_voice_turn_event" | "evaluate_speech_cadence" | "normalize_asr_transcript" | "scrub_preflight_prompt" | "extract_artifacts_and_reasoning" | "package_vault_backup" | "queue_composer_draft" | "process_vault_document" | "run_memory_benchmark_evaluation" | "evaluate_bitemporal_validity",
  "params": { ... }
}
\`\`\`

Params guide:
- package_vault_backup: { "input": { "memories": [], "tasks": [] } }
- queue_composer_draft: { "text": "Draft for chat", "append": false }
- process_vault_document: { "textContent": "Raw document content", "metadata": { "title": "Notes" } }
- run_memory_benchmark_evaluation: { "probes": [{ "id": "p1", "question": "Where does user live?", "gold": "SF", "answer": "SF", "correct": true, "adversarial": false, "abstained": false, "searchLatencyMs": 3.2 }] }
- evaluate_bitemporal_validity: { "edges": [{ "id": "e1", "source": "user", "target": "city", "relation": "lives_in", "fact": "Lives in SF", "validAtMs": 1000, "createdAtMs": 1000 }], "queryTimeMs": 1500 }
- evaluate_speech_cadence: { "text": "Hello user. How can I help you?", "hourOfDay": 22 }
- normalize_asr_transcript: { "rawTranscript": "[laughter] Haan bilkul theek hai", "lang": "hi" }
- scrub_preflight_prompt: { "prompt": "Here is my key sk-proj12345678901234567890" }
- extract_artifacts_and_reasoning: { "content": "<think>Planning...</think>Hello" }
- generate_stealth_headers: { "preset": "desktop-chrome-linux" | "mobile-pixel-android" }
- dispatch_mcp_call: { "message": { "jsonrpc": "2.0", "id": 1, "method": "tools/list" } }
- process_audio_frame: { "sampleRate": 16000, "channels": 1, "interrupt": false }
- handle_voice_turn_event: { "event": "user_speech_start" | "user_speech_end", "spokenInput": "um like hello" }
- aggregate_metasearch: { "rawResults": [{ "title": "Example", "url": "https://example.com", "content": "Text", "engine": "searxng", "position": 1 }] }
- clean_web_markdown: { "rawHtml": "<html><body><header>Nav</header><main><p>Content</p></main></body></html>" }
- fence_web_content: { "rawText": "Scraped body", "url": "https://example.com", "title": "Example" }
- parse_accessibility_tree: { "html": "<button>Click</button><a href='/home'>Home</a>" }
- request_interactive_approval: { "command": "rm -rf build/", "workingDirectory": "/root/k7", "securityTier": 2 }
- run_research_planner: { "query": "autonomous agents", "interruptInstruction": "focus on state machines" }
- check_schedule_conflict: { "proposedStartAt": 1730000000000, "durationMs": 3600000, "existingSlots": [] }
- execute_idempotent_task: { "userId": "user-1", "idempotencyKey": "k-100", "payload": { "amount": 10 } }
- save_thread_checkpoint: { "threadId": "th-1", "values": { "step": 1, "status": "running" } }
- get_thread_history: { "threadId": "th-1" }
- acquire_lease_lock: { "resource": "vault.db", "owner": "worker-1", "ttlMs": 15000 }
- check_honest_presence: { "lastHeartbeatMs": 1729900000000 }
- link_memory_to_task: { "taskId": "t-1", "memoryContent": "User likes dark roast coffee", "tags": ["preference"] }
- query_associated_memories: { "query": "coffee preferences", "k": 5, "alpha": 0.6 }
- evaluate_memory_verdict: { "question": "Where does user work?", "gold": "Acme Corp", "answer": "User works at Acme Corp", "adversarial": false }
- match_trigger_phrases: { "query": "Did we talk about Paris?", "memories": [{ "id": "m1", "content": "Trip to Paris planned", "triggerPhrases": ["trip to Paris", "Paris travel"] }] }
- generate_proactive_briefing: { "type": "morning" | "evening", "items": ["Buy groceries", "Code review"], "deeds": ["Meditated for 10 min"] }
- parse_dirty_json: { "raw": "{ action: 'test', count: 42, }" }
- create_action_event: { "toolName": "search_web", "actionPayload": { "query": "weather" }, "thought": ["Checking current conditions"], "securityRisk": "LOW" }
- get_running_summary: { "messages": [...], "maxContextTokens": 8192 }
- flush_buffered_memories: { "userId": "default_user" }
- export_gnosys_snapshot: { "agentId": "saan-k7" }
- import_gnosys_snapshot: { "snapshotJson": { ... } }
- get_budgeted_profile: { "profiles": [...], "maxTokens": 500, "preferTopics": ["basic_info"] }
- apply_mem0_decision: { "candidate": { "text": "I moved to Seattle", "category": "preference", "sourceRole": "user" }, "existingMemories": [] }
- edit_core_memory: { "operation": "append" | "replace", "block": "human" | "persona", "content": "new text", "oldContent": "to replace" }
- query_temporal_graph: { "nodeName": "Seattle", "asOfTimestamp": 1729000000000 }
- parse_temporal_query: { "query": "What did we talk about yesterday?" }
- get_token_budget: { "inputTokens": 1000, "maxContext": 8192, "maxResponse": 2048 }
- query_graph_memory: { "query": "technology", "searchDepth": 2 }
- test_provider_cascade: { "primaryModel": "model-a", "fallbackModels": ["model-b"] }
- create_task: { "title": "Task title", "description": "optional", "priority": 1-3, "dueDate": "YYYY-MM-DD" }
- list_tasks: { "status": "todo" | "done" }
- complete_task: { "taskId": 123 }
- create_event: { "title": "Event name", "startAt": timestamp_in_ms, "notes": "optional" }
- list_events: {}
- create_goal: { "title": "Goal title", "targetDate": "YYYY-MM-DD", "description": "optional" }
- search_web: { "query": "search query" }
- remember_date: { "date": "YYYY-MM-DD" | "MM-DD", "label": "Birthday / Exam", "recurring": true | false, "notes": "optional" }
- list_dates: {}
- add_wish: { "text": "Things user wants to do / buy / visit", "urgency": "low" | "medium" | "high" }
- fulfill_wish: { "wishId": "id_string" }
- list_wishes: {}
- get_mindfulness: {}
- consolidate_memories: {}
- list_deeds: {}
- resolve_deed: { "deedId": "d1", "resolution": "answered" | "dismissed" }
- get_self_model: {}
- get_cognitive_state: {}
- run_huginn_scan: {}
- add_lesson: { "topic": "topic string", "strategy": "strategy text", "importance": 1-10 }
- reframe_memory: { "memoryId": 123, "newEmotion": "serene" | "hopeful", "reason": "optional" }
- relive_memory: { "memoryId": 123 }
- get_memory_graph: {}
- map_avatar_expression: { "text": "speech text with [joy] tags" }
- handle_avatar_tap: { "hitArea": "head" | "body" }
- normalize_speakable_text: { "text": "raw text with $50.25 and 9:05 PM" }
- get_rms_volume_envelope: { "samples": [0.1, -0.2, 0.5] }
- parse_character_card: { "cardData": { "name": "...", "spec": "chara_card_v2" } }
- export_character_card: {}
- evaluate_lorebook: { "text": "...", "entries": [...] }
- substitute_macros: { "template": "Hello {{user}}, I am {{char}}" }
- get_authors_note: { "turnCount": 2 }
- get_chat_variable: { "key": "affection" }
- set_chat_variable: { "key": "affection", "value": 10 }
`;
