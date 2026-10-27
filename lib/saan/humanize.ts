/**
 * Saan Humanize Toolkit (Adapted from ericwang915/HerAndHim core/humanize.py)
 *
 * Implements real-human conversational delivery:
 * 1. replyDelay()    - Length-scaled, circadian-aware, jittered typing delay (slower/groggy during sleep hours)
 * 2. splitBurst()    - Splits multi-paragraph replies into natural 1–3 chat bubbles on blank lines
 * 3. pickReaction()  - Selective pre-reply emoji reactions on emotional or funny user inputs
 * 4. humanizeGap()   - Natural elapsed time phrasing ("about 15 minutes", "about 3 hours", "about 2 days")
 * 5. findOpenThread()- Pinpoints recent high-intensity emotional events for natural follow-ups
 */

// Reaction emoji pools
const REACT_PHOTO = ["❤️", "😍", "🥰", "🔥"];
const REACT_FUNNY = ["🤣", "😂", "😁"];
const REACT_SAD   = ["😢", "🥺", "🤗"];
const REACT_LOVE  = ["😘", "❤️", "✨"];
const REACT_WIN   = ["🎉", "🏆", "👏", "🔥"];

/**
 * Calculates a natural human typing delay (in milliseconds).
 * Scales with text length, adds randomized jitter, and increases during late-night sleep hours.
 */
export function calculateReplyDelay(text: string, circadianHour?: number): number {
  const n = (text || "").length;
  const hour = circadianHour !== undefined ? circadianHour : new Date().getHours();

  // Base delay: ~700ms + ~11ms per character up to 360 chars (~4.6s max base)
  const baseSec = 0.7 + Math.min(n, 360) * 0.011;
  // Randomized human jitter between 0.6x and 1.4x
  const jitter = 0.6 + Math.random() * 0.8;
  let delaySec = baseSec * jitter;

  // Groggy/slow response if Saan was sleeping (11 PM - 6 AM)
  if (hour >= 23 || hour < 6) {
    delaySec += 1.5 + Math.random() * 2.5; // +1.5s to 4.0s groggy delay
  }

  // Hard clamp between 600ms and 8000ms so it feels human without causing UI timeouts
  const finalMs = Math.round(Math.min(Math.max(delaySec * 1000, 600), 8000));
  return finalMs;
}

/**
 * Splits a long assistant response into 1–3 natural chat bubbles on paragraph boundaries (\n\n).
 * Real people fire off consecutive short bubbles instead of dropping a massive wall of text.
 */
export function splitBurst(text: string, maxParts = 3): string[] {
  const raw = (text || "").trim();
  if (!raw) return [];

  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length <= 1) {
    return [raw];
  }

  // If more paragraphs than maxParts, greedily merge the shortest adjacent pair
  const parts = [...paragraphs];
  while (parts.length > maxParts) {
    let shortestIdx = 0;
    let minLen = parts[0].length + parts[1].length;

    for (let i = 1; i < parts.length - 1; i++) {
      const combined = parts[i].length + parts[i + 1].length;
      if (combined < minLen) {
        minLen = combined;
        shortestIdx = i;
      }
    }

    parts.splice(shortestIdx, 2, `${parts[shortestIdx]}\n\n${parts[shortestIdx + 1]}`);
  }

  return parts;
}

/**
 * Selective emoji reaction on user message (fired before typing reply).
 * Selective by design: reacting to everything reads like a bot.
 */
export function pickReaction(text: string, hasImage = false): string | null {
  const t = (text || "").toLowerCase().trim();

  // Photos get high probability reaction
  if (hasImage && Math.random() < 0.85) {
    return REACT_PHOTO[Math.floor(Math.random() * REACT_PHOTO.length)];
  }

  // Laughter / Humor
  if (/(\bha\s?ha\b|lol|lmao|😂|🤣|hasna|hasi|joke|funny)/i.test(t)) {
    return Math.random() < 0.6 ? REACT_FUNNY[Math.floor(Math.random() * REACT_FUNNY.length)] : null;
  }

  // Affection / Love / Care
  if (/(\bmiss you\b|\blove you\b|pyaar|yaad|care|sweet|cute|❤️|😘)/i.test(t)) {
    return Math.random() < 0.7 ? REACT_LOVE[Math.floor(Math.random() * REACT_LOVE.length)] : null;
  }

  // Sadness / Stress / Exhaustion
  if (/(\bsad\b|tired|exhausted|cry|hurt|thak gaya|dard|problem|upset|😭|😢)/i.test(t)) {
    return Math.random() < 0.6 ? REACT_SAD[Math.floor(Math.random() * REACT_SAD.length)] : null;
  }

  // Wins / Achievements / Success
  if (/(\bpassed\b|success|cleared|got the job|offer|won|completed|shandar|badhai|phod diya|party|🎉)/i.test(t)) {
    return Math.random() < 0.8 ? REACT_WIN[Math.floor(Math.random() * REACT_WIN.length)] : null;
  }

  return null;
}

/**
 * Formats a natural conversational phrasing for elapsed time since last chat.
 */
export function humanizeGap(diffMinutes: number): string {
  if (diffMinutes < 2) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `about ${Math.round(diffMinutes)} minutes ago`;
  }
  const hours = diffMinutes / 60;
  if (hours < 24) {
    const rounded = Math.round(hours);
    return `about ${rounded} hour${rounded === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  return `about ${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Finds the most emotionally significant recent topic/event to follow up on.
 */
export function findOpenThread(
  events: Array<{
    topic: string;
    summary: string;
    sentiment: string;
    intensity: number;
    followUp?: boolean;
  }>
): string | null {
  if (!events || events.length === 0) return null;

  const candidates = events.filter(
    (e) =>
      e.summary &&
      e.summary.trim().length > 0 &&
      e.topic &&
      !["general", "greeting", "idle"].includes(e.topic.toLowerCase())
  );

  if (candidates.length === 0) return null;

  // Score candidate: negative/distress events or explicit follow-up flags get priority
  const scored = candidates.map((e) => {
    let score = Number(e.intensity || 0.5);
    if (e.sentiment === "negative") score += 0.5; // High priority for caring check-in
    if (e.followUp) score += 0.8;
    return { event: e, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].event;
  return `${best.topic}: "${best.summary}"`;
}
