import test from "node:test";
import assert from "node:assert/strict";
import {
  DirtyJson,
  ObservableActionStream,
  RepairableActionException,
  type ActionEvent,
  type ObservationEvent,
  type ToolHandler,
} from "../../lib/saan/observable-action-stream";

test("Repo 19: OpenHands Observable Action Stream & DirtyJson Repair Engine", async (t) => {
  await t.test("DirtyJson parses dirty JSON with comments, unquoted keys, and Python literals", () => {
    const rawDirtyJson = `
      // Lead comment explaining action
      {
        action: "web_search", /* inline comment */
        query: "quantum computing principles",
        depth: 3,
        enabled: True,
        fallback: None,
        tags: ["physics", "computing",], // trailing comma
      }
    `;

    const parsed = DirtyJson.parse(rawDirtyJson);
    assert.equal(parsed.action, "web_search");
    assert.equal(parsed.query, "quantum computing principles");
    assert.equal(parsed.depth, 3);
    assert.equal(parsed.enabled, true);
    assert.equal(parsed.fallback, null);
    assert.deepEqual(parsed.tags, ["physics", "computing"]);
  });

  await t.test("recordToolCall appends paired ActionEvent and ObservationEvent", () => {
    const stream = new ObservableActionStream();
    const { action, observation } = stream.recordToolCall(
      "search_memory",
      { query: "user preferences" },
      "Memory retrieved: Prefers adrak chai",
      { thought: ["Need to check past preferences before proposing evening study ritual"] }
    );

    assert.equal(action.kind, "action");
    assert.equal(action.toolName, "search_memory");
    assert.equal(observation.kind, "observation");
    assert.equal(observation.actionId, action.id);
    assert.equal(observation.content, "Memory retrieved: Prefers adrak chai");
    assert.equal(stream.getEvents().length, 2);
  });

  await t.test("executeChainedLoop enforces security gate policy on HIGH risk tools", async () => {
    const stream = new ObservableActionStream();

    const highRiskTool: ToolHandler = {
      name: "delete_database",
      securityRisk: "HIGH",
      execute: async () => "Deleted",
    };
    stream.registerTool(highRiskTool);

    const result = await stream.executeChainedLoop((iteration) => {
      if (iteration === 1) {
        return {
          toolName: "delete_database",
          args: {},
          thought: ["Attempting destructive operation"],
          securityApproved: false, // User consent denied
        };
      }
      return null;
    });

    assert.equal(result.completed, false);
    assert.ok(result.error?.includes("rejected"));
    const events = stream.getEvents();
    assert.equal(events.some((e) => e.kind === "user_reject"), true);
  });

  await t.test("executeChainedLoop handles RepairableActionException and self-corrects", async () => {
    const stream = new ObservableActionStream();
    let attempts = 0;

    const fragileTool: ToolHandler = {
      name: "parse_code",
      securityRisk: "LOW",
      execute: async (args) => {
        attempts++;
        if (attempts === 1) {
          throw new RepairableActionException(
            "Missing file extension",
            "Try adding .ts to the path argument"
          );
        }
        return `Successfully parsed ${args.path}`;
      },
    };
    stream.registerTool(fragileTool);

    const result = await stream.executeChainedLoop((iteration, lastObs) => {
      if (iteration === 1) {
        return {
          toolName: "parse_code",
          args: { path: "main" },
          thought: ["First attempt with incomplete path"],
        };
      }
      if (iteration === 2 && lastObs?.isError) {
        return {
          toolName: "parse_code",
          args: { path: "main.ts" }, // Repaired based on hint
          thought: ["Repaired path argument using observation hint"],
        };
      }
      return null;
    });

    assert.equal(result.completed, true);
    assert.equal(result.iterations, 2);
    assert.ok(result.finalResult?.includes("Successfully parsed main.ts"));
  });
});
