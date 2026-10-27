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
      return 1; // Tier 1: Auto-permitted read

    case "create_task":
    case "complete_task":
    case "create_event":
    case "create_goal":
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

export const SAAN_TOOLS_SPEC = `
You have native access to execute project control commands. To execute an action, output an action block at the END of your message in this JSON format:
\`\`\`saan_action
{
  "action": "create_task" | "list_tasks" | "complete_task" | "create_event" | "list_events" | "create_goal" | "search_web",
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
`;
