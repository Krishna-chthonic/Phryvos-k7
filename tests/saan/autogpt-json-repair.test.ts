import test from "node:test";
import assert from "node:assert/strict";
import {
  DirtyJsonRepairEngine,
  DirtyJsonRepairAuditor,
} from "../../lib/saan/dirty-json-repair";

test("Repo 20: AutoGPT & Agent-Zero Dirty JSON Repair Engine & Audit Drawer", async (t) => {
  await t.test("repairAndParse strips markdown code block wrappers (json, saan_action)", () => {
    const raw = "```json\n{\"action\": \"test_tool\", \"value\": 42}\n```";
    const res = DirtyJsonRepairEngine.repairAndParse(raw);
    assert.equal(res.success, true);
    assert.equal(res.data.action, "test_tool");
    assert.equal(res.data.value, 42);
    assert.ok(res.anomalies.includes("stripped_markdown_fence"));
  });

  await t.test("repairAndParse strips single-line and multi-line C-style comments", () => {
    const raw = `
      // Single line comment before object
      {
        /* Multi-line comment inside */
        "tool": "verify_memory",
        "valid": true // Trailing comment
      }
    `;
    const res = DirtyJsonRepairEngine.repairAndParse(raw);
    assert.equal(res.success, true);
    assert.equal(res.data.tool, "verify_memory");
    assert.equal(res.data.valid, true);
    assert.ok(res.anomalies.includes("stripped_comments"));
  });

  await t.test("repairAndParse converts Python literals True, False, None to JSON standards", () => {
    const raw = '{"active": True, "archived": False, "tombstone": None}';
    const res = DirtyJsonRepairEngine.repairAndParse(raw);
    assert.equal(res.success, true);
    assert.equal(res.data.active, true);
    assert.equal(res.data.archived, false);
    assert.equal(res.data.tombstone, null);
    assert.ok(res.anomalies.includes("replaced_python_literals"));
  });

  await t.test("repairAndParse normalizes single-quoted strings and unquoted object keys", () => {
    const raw = "{ action: 'search_temporal_graph', query: 'adrak chai' }";
    const res = DirtyJsonRepairEngine.repairAndParse(raw);
    assert.equal(res.success, true);
    assert.equal(res.data.action, "search_temporal_graph");
    assert.equal(res.data.query, "adrak chai");
    assert.ok(res.anomalies.includes("fixed_unquoted_keys"));
    assert.ok(res.anomalies.includes("normalized_single_quotes"));
  });

  await t.test("repairAndParse removes trailing commas before closing braces and brackets", () => {
    const raw = '{"items": ["chai", "notes",], "count": 2,}';
    const res = DirtyJsonRepairEngine.repairAndParse(raw);
    assert.equal(res.success, true);
    assert.deepEqual(res.data.items, ["chai", "notes"]);
    assert.equal(res.data.count, 2);
    assert.ok(res.anomalies.includes("removed_trailing_commas"));
  });

  await t.test("repairAndParse performs heuristic balancing for truncated JSON with missing brackets/braces", () => {
    const raw = '{"action": "create_task", "params": {"title": "Autonomous verification", "tags": ["a", "b"';
    const res = DirtyJsonRepairEngine.repairAndParse(raw);
    assert.equal(res.success, true);
    assert.equal(res.data.action, "create_task");
    assert.equal(res.data.params.title, "Autonomous verification");
    assert.deepEqual(res.data.params.tags, ["a", "b"]);
    assert.ok(res.anomalies.some((a) => a.startsWith("balanced_")));
  });

  await t.test("DirtyJsonRepairAuditor records repairs and aggregates anomaly statistics", () => {
    const auditor = new DirtyJsonRepairAuditor({ maxHistory: 10 });
    const raw = "{ tool: 'ping', enabled: True, }";
    const res = DirtyJsonRepairEngine.repairAndParse(raw);

    const event = auditor.recordRepair(raw, res);
    assert.equal(event.success, true);
    assert.equal(auditor.getEvents().length, 1);

    const stats = auditor.getStats();
    assert.equal(stats.totalAudits, 1);
    assert.equal(stats.successCount, 1);
    assert.ok(stats.anomalyFrequencies["fixed_unquoted_keys"] >= 1);
    assert.ok(stats.anomalyFrequencies["replaced_python_literals"] >= 1);
  });
});
