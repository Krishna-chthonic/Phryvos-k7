/**
 * Temporal Anchor Prefixing (from moeru-ai/airi core-agent)
 *
 * Implements:
 * Formats user turns as `[YYYY-MM-DD HH:MM] ` in the user's local timezone.
 * Annotates user messages so the model has a concrete time anchor on every turn
 * without mirroring the prefix into assistant output.
 */

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatTimePrefix(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hour = pad2(d.getHours());
  const minute = pad2(d.getMinutes());

  return `[${year}-${month}-${day} ${hour}:${minute}] `;
}
