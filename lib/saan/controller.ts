/**
 * Sovereign Project Controller for Saan (Inspired by Agent Zero, Khoj, Open Interpreter)
 *
 * Grants Saan autonomous management over K7's systems:
 * 1. Task Management (/tasks)
 * 2. Calendar & Events (/calendar)
 * 3. Life Goals & Milestones (/goals)
 * 4. Fast Internet Search / Web Knowledge
 */

import { getDb } from "@/lib/db/client";

export interface SaanActionResult {
  success: boolean;
  action: string;
  message: string;
  data?: any;
}

/**
 * Creates a new task in the user's workspace
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

    return {
      success: true,
      action: "create_task",
      message: `Created task "${title}"`,
      data: { id: Number(res.lastInsertRowid), title, priority, dueDate },
    };
  } catch (err: any) {
    return { success: false, action: "create_task", message: err.message };
  }
}

/**
 * Lists active tasks from the database
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
      message: `Found ${rows.length} ${status} tasks`,
      data: rows,
    };
  } catch (err: any) {
    return { success: false, action: "list_tasks", message: err.message };
  }
}

/**
 * Marks a task as completed
 */
export function completeTask(taskId: number): SaanActionResult {
  try {
    const db = getDb();
    const now = Date.now();
    const res = db
      .prepare(
        "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?"
      )
      .run(now, now, taskId);

    if (res.changes === 0) {
      return { success: false, action: "complete_task", message: `Task #${taskId} not found` };
    }
    return {
      success: true,
      action: "complete_task",
      message: `Task #${taskId} marked as completed!`,
    };
  } catch (err: any) {
    return { success: false, action: "complete_task", message: err.message };
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
      message: `Scheduled "${title}" on calendar`,
      data: { id: Number(res.lastInsertRowid), title, startAt },
    };
  } catch (err: any) {
    return { success: false, action: "create_event", message: err.message };
  }
}

/**
 * Lists upcoming calendar events
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
      message: `Found ${rows.length} upcoming events`,
      data: rows,
    };
  } catch (err: any) {
    return { success: false, action: "list_events", message: err.message };
  }
}

/**
 * Creates a new personal goal
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
      message: `Created goal "${title}"`,
      data: { id: Number(res.lastInsertRowid), title, targetDate },
    };
  } catch (err: any) {
    return { success: false, action: "create_goal", message: err.message };
  }
}

/**
 * Searches the web for information using fast metasearch
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
      return { success: false, action: "search_web", message: `Search failed with status ${res.status}` };
    }

    const html = await res.text();
    // Simple regex extraction of top snippet results
    const snippets: string[] = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 4) {
      const clean = match[1].replace(/<[^>]+>/g, "").trim();
      if (clean) snippets.push(clean);
    }

    return {
      success: true,
      action: "search_web",
      message: `Found ${snippets.length} web results`,
      data: snippets.length > 0 ? snippets.join("\n\n") : "No instant snippets found.",
    };
  } catch (err: any) {
    return { success: false, action: "search_web", message: err.message };
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
