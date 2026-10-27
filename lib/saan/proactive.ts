/**
 * Saan Proactive & Absence Ledger (Adapted from ericwang915/HerAndHim core/proactive_state.py)
 *
 * Ephemeral in-memory ledger tracking unanswered proactive check-ins.
 * Deliberately NOT persisted: a process restart resets the count in the forgiving direction,
 * preventing Saan from holding a grudge across app restarts.
 */

interface SessionState {
  unansweredCount: number;
  lastProactiveTime: number;
  lastUserReplyTime: number;
}

const sessions = new Map<string, SessionState>();
const DEFAULT_SESSION = "default";

function getOrCreateSession(sessionId = DEFAULT_SESSION): SessionState {
  let state = sessions.get(sessionId);
  if (!state) {
    state = {
      unansweredCount: 0,
      lastProactiveTime: 0,
      lastUserReplyTime: Date.now(),
    };
    sessions.set(sessionId, state);
  }
  return state;
}

/**
 * Records that Saan sent an unprompted proactive message.
 */
export function recordProactiveSent(sessionId = DEFAULT_SESSION): void {
  const state = getOrCreateSession(sessionId);
  state.unansweredCount += 1;
  state.lastProactiveTime = Date.now();
}

/**
 * Records that the user replied, clearing any ignored streak.
 */
export function recordUserReplied(sessionId = DEFAULT_SESSION): void {
  const state = getOrCreateSession(sessionId);
  state.unansweredCount = 0;
  state.lastUserReplyTime = Date.now();
}

/**
 * Returns current count of unanswered proactive messages.
 */
export function getUnansweredCount(sessionId = DEFAULT_SESSION): number {
  return getOrCreateSession(sessionId).unansweredCount;
}

/**
 * Checks if the user has ignored multiple proactive attempts (>= 2).
 */
export function hasIgnoredStreak(sessionId = DEFAULT_SESSION): boolean {
  return getOrCreateSession(sessionId).unansweredCount >= 2;
}

/**
 * Returns elapsed minutes since user last replied.
 */
export function getMinutesSinceLastReply(sessionId = DEFAULT_SESSION): number {
  const state = getOrCreateSession(sessionId);
  return (Date.now() - state.lastUserReplyTime) / (1000 * 60);
}
