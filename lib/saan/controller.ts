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
 * Fault-Tolerant JSON Parser (Agent Zero pattern)
 * Repairs common LLM JSON syntax errors: trailing commas, single quotes, unescaped newlines
 */
export function parseDirtyJson(raw: string): any {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw.trim();

  // Strip code block fences if present
  cleaned = cleaned.replace(/^```(?:json|saan_action)?\s*/i, "").replace(/\s*```$/i, "");

  // 1. Try standard JSON.parse first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  // 3. Fix unquoted or single-quoted keys
  cleaned = cleaned.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":');
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

  // 4. Fix single-quoted string values
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
    default:
      return { success: false, action, tier: 2, message: `Unknown action: "${action}"` };
  }
}

export const SAAN_TOOLS_SPEC = `
You have native access to execute project control commands. To execute an action, output an action block at the END of your message in this JSON format:
\`\`\`saan_action
{
  "action": "create_task" | "list_tasks" | "complete_task" | "create_event" | "list_events" | "create_goal" | "search_web" | "remember_date" | "list_dates" | "add_wish" | "fulfill_wish" | "list_wishes" | "get_mindfulness" | "consolidate_memories" | "list_deeds" | "resolve_deed" | "get_self_model" | "get_cognitive_state" | "run_huginn_scan" | "add_lesson" | "reframe_memory" | "relive_memory" | "get_memory_graph" | "get_starter_chips" | "transform_speech_text" | "categorize_text" | "parse_streaming_controls" | "map_avatar_expression" | "handle_avatar_tap" | "normalize_speakable_text" | "get_rms_volume_envelope",
  "params": { ... }
}
\`\`\`

Params guide:
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
`;
