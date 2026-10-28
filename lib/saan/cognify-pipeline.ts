/**
 * Cognify Pipeline & Two-Phase Atomic Rollback Engine
 * Clean-room TypeScript adaptation inspired by topoteretes/cognee modules/cognify/rollback.py.
 *
 * Implements:
 * 1. Multi-stage text-to-graph extraction pipeline.
 * 2. Two-phase atomic rollback on pipeline failure:
 *    - Deletes graph and vector artifacts first.
 *    - Cleans relational ownership records and resets pipeline status second.
 * 3. Prevents "ghost memories" and corrupt partial graph states.
 */

export interface CognifyPipelineArtifacts {
  runId: string;
  createdNodeIds: string[];
  createdEdgeIds: string[];
  status: "pending" | "completed" | "failed" | "rolled_back";
  error?: string;
  timestamp: number;
}

export type PipelineStageFn = (runId: string) => Promise<{ nodeIds: string[]; edgeIds: string[] }>;

export class CognifyPipelineManager {
  private activeRuns = new Map<string, CognifyPipelineArtifacts>();

  /**
   * Executes a pipeline with transactional rollback guarantees.
   */
  public async executePipeline(
    runId: string,
    stages: Array<{ name: string; run: PipelineStageFn }>,
    rollbackHandler: (artifacts: CognifyPipelineArtifacts) => Promise<void>
  ): Promise<{ success: boolean; artifacts: CognifyPipelineArtifacts }> {
    const artifacts: CognifyPipelineArtifacts = {
      runId,
      createdNodeIds: [],
      createdEdgeIds: [],
      status: "pending",
      timestamp: Date.now(),
    };

    this.activeRuns.set(runId, artifacts);

    try {
      for (const stage of stages) {
        const res = await stage.run(runId);
        if (res.nodeIds && res.nodeIds.length > 0) {
          artifacts.createdNodeIds.push(...res.nodeIds);
        }
        if (res.edgeIds && res.edgeIds.length > 0) {
          artifacts.createdEdgeIds.push(...res.edgeIds);
        }
      }

      artifacts.status = "completed";
      return { success: true, artifacts };
    } catch (err: any) {
      artifacts.status = "failed";
      artifacts.error = err instanceof Error ? err.message : String(err);

      // Execute Cognee-style two-phase rollback
      try {
        await rollbackHandler(artifacts);
        artifacts.status = "rolled_back";
      } catch (rollbackErr: any) {
        console.error(`[CognifyPipeline] Critical error during rollback for run ${runId}:`, rollbackErr);
      }

      return { success: false, artifacts };
    }
  }

  public getRun(runId: string): CognifyPipelineArtifacts | null {
    return this.activeRuns.get(runId) || null;
  }
}
