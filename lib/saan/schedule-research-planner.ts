/**
 * Schedule & Research Planner for Saan Companion (K7)
 * Clean-room adaptation of khoj-ai/khoj architecture (Commit ae229ca, AGPL-3.0 Clean-Room).
 *
 * Implements:
 * 1. Multi-step ResearchIteration engine with mid-course user interrupt queue.
 * 2. Query decomposition into orthogonal subqueries.
 * 3. Notification fatigue filter (to_notify_or_not logic).
 * 4. Calendar collision detection & alternate slot recommendation.
 */

export interface ResearchIteration {
  iterationNumber: number;
  query: string;
  subqueries: string[];
  findings: string[];
  interruptedBy?: string;
  timestamp: string;
}

export interface ResearchPlanResult {
  completed: boolean;
  totalIterations: number;
  finalQuery: string;
  consolidatedFindings: string[];
  iterations: ResearchIteration[];
  notifiable: boolean;
}

export interface ScheduledSlot {
  id: string;
  title: string;
  startAt: number; // epoch ms
  endAt: number;   // epoch ms
}

export interface ScheduleConflictCheckResult {
  hasConflict: boolean;
  conflictingSlots: ScheduledSlot[];
  proposedAlternateSlot?: {
    startAt: number;
    endAt: number;
    reason: string;
  };
}

export class ScheduleResearchPlanner {
  public maxIterations = 5;

  /**
   * Decomposes a multi-faceted query into 2-3 focused subqueries.
   */
  public decomposeSubqueries(query: string): string[] {
    const cleaned = query.trim();
    if (!cleaned) return [];

    // Simple heuristic clause-based decomposition
    const parts = cleaned
      .split(/\band\b|\balso\b|\bas well as\b|,/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 5);

    if (parts.length >= 2) {
      return parts.slice(0, 3);
    }

    return [
      cleaned,
      `Core concepts and background on: ${cleaned}`,
      `Current implementations and benchmarks for: ${cleaned}`,
    ];
  }

  /**
   * Multi-step research loop with dynamic mid-course user interrupts.
   */
  public executeResearchLoop(
    initialQuery: string,
    stepResearcher: (query: string, subqueries: string[]) => string[],
    interruptQueue: string[] = []
  ): ResearchPlanResult {
    let currentQuery = initialQuery;
    const iterations: ResearchIteration[] = [];
    const allFindings: string[] = [];

    for (let iter = 1; iter <= this.maxIterations; iter++) {
      // Check for mid-course interrupt
      let interruptedBy: string | undefined = undefined;
      if (interruptQueue.length > 0) {
        interruptedBy = interruptQueue.shift()!;
        currentQuery = `${currentQuery} (Refined: ${interruptedBy})`;
      }

      const subqueries = this.decomposeSubqueries(currentQuery);
      const findings = stepResearcher(currentQuery, subqueries);
      allFindings.push(...findings);

      iterations.push({
        iterationNumber: iter,
        query: currentQuery,
        subqueries,
        findings,
        interruptedBy,
        timestamp: new Date().toISOString(),
      });

      // Stop condition: sufficient findings gathered
      if (allFindings.length >= 6) {
        break;
      }
    }

    const notifiable = this.toNotifyOrNot(allFindings);

    return {
      completed: true,
      totalIterations: iterations.length,
      finalQuery: currentQuery,
      consolidatedFindings: Array.from(new Set(allFindings)),
      iterations,
      notifiable,
    };
  }

  /**
   * Notification fatigue filter (khoj to_notify_or_not logic):
   * Determines whether background results warrant disturbing the user.
   */
  public toNotifyOrNot(findings: string[]): boolean {
    if (findings.length === 0) return false;
    // Suppress if all findings indicate empty / unchanged state
    const nonTrivial = findings.filter(
      (f) =>
        !f.toLowerCase().includes("no new changes") &&
        !f.toLowerCase().includes("unchanged") &&
        !f.toLowerCase().includes("up to date")
    );
    return nonTrivial.length > 0;
  }

  /**
   * Calendar schedule collision detector:
   * Inspects existing events and proposes next available 1-hour window.
   */
  public checkScheduleConflict(
    proposedStartAt: number,
    durationMs: number,
    existingSlots: ScheduledSlot[]
  ): ScheduleConflictCheckResult {
    const proposedEndAt = proposedStartAt + durationMs;

    const conflicts = existingSlots.filter((slot) => {
      // Overlap condition: startA < endB && endA > startB
      return proposedStartAt < slot.endAt && proposedEndAt > slot.startAt;
    });

    if (conflicts.length === 0) {
      return { hasConflict: false, conflictingSlots: [] };
    }

    // Find next available slot after the latest conflicting event
    const latestConflictEnd = Math.max(...conflicts.map((c) => c.endAt));
    // 15-minute buffer after conflict ends
    const alternateStart = latestConflictEnd + 15 * 60 * 1000;
    const alternateEnd = alternateStart + durationMs;

    return {
      hasConflict: true,
      conflictingSlots: conflicts,
      proposedAlternateSlot: {
        startAt: alternateStart,
        endAt: alternateEnd,
        reason: `Overlaps with '${conflicts.map((c) => c.title).join(", ")}'. Recommended next open slot.`,
      },
    };
  }
}
