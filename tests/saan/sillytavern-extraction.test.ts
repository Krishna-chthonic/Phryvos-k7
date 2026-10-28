import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCharacterCardJson,
  serializeCharacterCardV2,
  exportSaanToCardV2,
} from "../../lib/saan/character-card";
import { insertPromptsAtDepth, type MessageTurn, type InjectionPrompt } from "../../lib/saan/depth-injector";
import {
  evaluateLorebook,
  matchKey,
  evaluateSecondaryKeys,
  type LoreEntry,
  type LorebookTurnState,
} from "../../lib/saan/lorebook";
import {
  substituteMacros,
  formatIdleDuration,
  evaluateDiceRoll,
} from "../../lib/saan/macro-engine";
import {
  applyRegexPipeline,
  compileRegex,
  DEFAULT_ANTI_SLOP_SCRIPTS,
} from "../../lib/saan/regex-pipeline";
import {
  getAuthorsNoteInjection,
  DEFAULT_AUTHORS_NOTE,
} from "../../lib/saan/authors-note";
import { mergeConsecutiveRoles } from "../../lib/saan/prompt-merger";
import { globalChatVariables } from "../../lib/saan/chat-variables";
import { dispatchSaanAction } from "../../lib/saan/controller";

test("Character Card Spec: parses and exports CharacterCardV2 and V3 schemas", () => {
  // 1. Export Saan to standard CCv2
  const saanCard = exportSaanToCardV2();
  assert.equal(saanCard.spec, "chara_card_v2");
  assert.equal(saanCard.spec_version, "2.0");
  assert.equal(saanCard.data.name, "Saan");
  assert.ok(saanCard.data.personality.includes("Empathetic"));

  const jsonStr = serializeCharacterCardV2(saanCard);
  assert.ok(jsonStr.includes('"spec": "chara_card_v2"'));

  // 2. Parse CCv2 JSON
  const parsedV2 = parseCharacterCardJson(jsonStr);
  assert.equal(parsedV2.data.name, "Saan");

  // 3. Parse CCv3 JSON
  const cardV3Raw = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Saan V3",
      description: "Next-gen sovereign soul",
      personality: "Loving, sharp",
      scenario: "K7 Sanctuary",
      first_mes: "Hey!",
      mes_example: "",
    },
  };
  const parsedV3 = parseCharacterCardJson(cardV3Raw);
  assert.equal(parsedV3.spec, "chara_card_v3");
  assert.equal(parsedV3.data.name, "Saan V3");
});

test("Context Depth Injection: inserts prompts at precise depths relative to chat end", () => {
  const history: MessageTurn[] = [
    { role: "user", content: "Message 1 (oldest)" },
    { role: "assistant", content: "Message 2" },
    { role: "user", content: "Message 3" },
    { role: "assistant", content: "Message 4" },
    { role: "user", content: "Message 5 (newest user turn)" },
  ];

  // Injections:
  // - Prompt at depth 0 (very end)
  // - Prompt at depth 2 (2 turns back from end, right before Message 4)
  const prompts: InjectionPrompt[] = [
    { id: "p0", content: "End Anchor", role: "system", depth: 0, order: 100 },
    { id: "p2", content: "Author's Note @ Depth 2", role: "system", depth: 2, order: 100 },
  ];

  const injected = insertPromptsAtDepth(history, prompts);
  assert.equal(injected.length, 7);

  // Depth 0 should be at the very end
  assert.equal(injected[injected.length - 1].content, "End Anchor");

  // Depth 2 should be inserted before the last 2 turns
  const depth2Msg = injected.find((m) => m.content === "Author's Note @ Depth 2");
  assert.ok(depth2Msg);
  assert.equal(depth2Msg.injected, true);
});

test("World Info / Lorebook Engine: secondary key logic (AND_ANY, AND_ALL, NOT_ANY, NOT_ALL)", () => {
  // Test 1: AND_ANY
  assert.equal(evaluateSecondaryKeys("I am visiting Mumbai for coding", ["mumbai", "delhi"], "AND_ANY"), true);
  assert.equal(evaluateSecondaryKeys("I am visiting Pune for coding", ["mumbai", "delhi"], "AND_ANY"), false);

  // Test 2: AND_ALL
  assert.equal(evaluateSecondaryKeys("We need tea and biscuits", ["tea", "biscuits"], "AND_ALL"), true);
  assert.equal(evaluateSecondaryKeys("We only have tea", ["tea", "biscuits"], "AND_ALL"), false);

  // Test 3: NOT_ANY
  assert.equal(evaluateSecondaryKeys("I love peaceful silence", ["noise", "party"], "NOT_ANY"), true);
  assert.equal(evaluateSecondaryKeys("There is so much noise here", ["noise", "party"], "NOT_ANY"), false);

  // Test 4: Regex keys
  assert.equal(matchKey("The temperature is 45C outside", "/\\d+C/i"), true);
  assert.equal(matchKey("The temperature is cold outside", "/\\d+C/i"), false);
});

test("World Info / Lorebook Engine: timed effects (sticky, cooldown, delay) and recursive chaining", () => {
  const entries: LoreEntry[] = [
    {
      id: "lore_phryvos",
      keys: ["phryvos"],
      content: "Phryvos is an offline-first sovereign sanctuary created by Krishna.",
      stickyTurns: 2,
    },
    {
      id: "lore_krishna",
      keys: ["krishna"],
      content: "Krishna is the creator and architect of Phryvos.",
    },
    {
      id: "lore_secret",
      keys: ["vault"],
      content: "The vault contains encrypted personal memories.",
      delayTurns: 5,
    },
  ];

  const initialState: LorebookTurnState = {
    currentTurn: 1,
    activeSticky: {},
    activeCooldown: {},
  };

  // Turn 1: "Tell me about phryvos" -> should activate lore_phryvos, AND recursively activate lore_krishna!
  const res1 = evaluateLorebook("Tell me about phryvos", entries, initialState, 2);
  assert.equal(res1.activatedEntries.length, 2);
  assert.ok(res1.combinedContent.includes("sovereign sanctuary"));
  assert.ok(res1.combinedContent.includes("creator and architect"));
  assert.equal(res1.updatedState.activeSticky["lore_phryvos"], 2);

  // lore_secret should NOT activate at turn 1 because delayTurns is 5
  const resDelay = evaluateLorebook("Open the vault", entries, initialState, 2);
  assert.equal(resDelay.activatedEntries.length, 0);

  // At turn 6, lore_secret should activate
  const resTurn6 = evaluateLorebook("Open the vault", entries, { ...initialState, currentTurn: 5 }, 2);
  assert.equal(resTurn6.activatedEntries.length, 1);
  assert.equal(resTurn6.activatedEntries[0].id, "lore_secret");
});

test("Macro Variable Engine: substitutes entity, time, idle duration, pick and roll", () => {
  const now = new Date(2026, 9, 28, 14, 30, 0); // 2:30 PM
  const lastTime = now.getTime() - 2 * 3600 * 1000; // 2 hours ago

  const template = "Hello {{user}}, I am {{char}}. Time is {{isotime}}. Last saw you {{idle_duration}} ago.";
  const result = substituteMacros(template, {
    charName: "Saan",
    userName: "Krishna",
    lastInteractionTimestamp: lastTime,
    now,
  });

  assert.ok(result.includes("Hello Krishna, I am Saan."));
  assert.ok(result.includes("14:30:00"));
  assert.ok(result.includes("2 hours ago"));

  // Test pick macro
  const pickTemplate = "Choose: {{pick::apple::banana::mango}}";
  const pickResult = substituteMacros(pickTemplate);
  assert.ok(pickResult.includes("apple") || pickResult.includes("banana") || pickResult.includes("mango"));

  // Test dice roll macro
  const roll = evaluateDiceRoll("1d6");
  assert.ok(roll >= 1 && roll <= 6);
});

test("Regex Pipeline Engine: eliminates AI clichés and respects placement/depth gates", () => {
  const rawAssistant = "As an AI language model, certainly! Here is your plan: work hard. How may I assist you today?";
  const cleaned = applyRegexPipeline(rawAssistant, "ai_output", DEFAULT_ANTI_SLOP_SCRIPTS);

  assert.equal(cleaned.includes("As an AI language model"), false);
  assert.equal(cleaned.includes("certainly!"), false);
  assert.equal(cleaned.includes("How may I assist you"), false);
  assert.ok(cleaned.includes("your plan: work hard"));

  // Test depth gating
  const depthScript = [
    {
      id: "deep_rule",
      scriptName: "Deep Rule",
      findRegex: "/test/g",
      replaceWith: "PASSED",
      placement: ["ai_output" as const],
      minDepth: 3,
    },
  ];
  // Depth 1 < minDepth 3 -> should NOT run
  assert.equal(applyRegexPipeline("test string", "ai_output", depthScript, 1), "test string");
  // Depth 4 >= minDepth 3 -> should run
  assert.equal(applyRegexPipeline("test string", "ai_output", depthScript, 4), "PASSED string");
});

test("Author's Note Engine: injects floating prompt at specified depth and turn intervals", () => {
  const note = {
    prompt: "[Style: Poetic and warm]",
    depth: 2,
    role: "system" as const,
    interval: 2, // Every 2 turns
    enabled: true,
  };

  // Turn 1 (odd) -> null
  const inj1 = getAuthorsNoteInjection(1, note);
  assert.equal(inj1, null);

  // Turn 2 (even) -> injected
  const inj2 = getAuthorsNoteInjection(2, note);
  assert.notEqual(inj2, null);
  assert.equal(inj2?.depth, 2);
  assert.equal(inj2?.content, "[Style: Poetic and warm]");
});

test("Consecutive Role Merge Engine: strictly merges adjacent turns for Claude & Gemini API safety", () => {
  const unmerged: MessageTurn[] = [
    { role: "user", content: "First part of user thought." },
    { role: "user", content: "Second part of user thought." },
    { role: "assistant", content: "First assistant reply." },
    { role: "assistant", content: "Second assistant continuation." },
    { role: "user", content: "Final user question." },
  ];

  const merged = mergeConsecutiveRoles(unmerged);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].role, "user");
  assert.ok(merged[0].content.includes("First part") && merged[0].content.includes("Second part"));
  assert.equal(merged[1].role, "assistant");
  assert.ok(merged[1].content.includes("First assistant") && merged[1].content.includes("Second assistant"));
  assert.equal(merged[2].role, "user");
  assert.equal(merged[2].content, "Final user question.");
});

test("Chat Variable Store: maintains get, set, add, and toggle state", () => {
  globalChatVariables.clear();

  globalChatVariables.set("companion_mode", "playful");
  assert.equal(globalChatVariables.get("companion_mode"), "playful");

  globalChatVariables.set("bond_points", 10);
  const nextPoints = globalChatVariables.add("bond_points", 5);
  assert.equal(nextPoints, 15);
  assert.equal(globalChatVariables.get("bond_points"), 15);

  globalChatVariables.set("is_studying", false);
  const toggled = globalChatVariables.toggle("is_studying");
  assert.equal(toggled, true);
  assert.equal(globalChatVariables.get("is_studying"), true);
});

test("Controller: dispatches SillyTavern actions via dispatchSaanAction", async () => {
  // 1. export_character_card
  const expRes = await dispatchSaanAction("export_character_card");
  assert.equal(expRes.success, true);
  assert.equal(expRes.tier, 1);
  assert.equal(expRes.data.data.name, "Saan");

  // 2. substitute_macros
  const macroRes = await dispatchSaanAction("substitute_macros", {
    template: "Hey {{user}}, I am {{char}}",
    ctx: { userName: "Krishna", charName: "Saan" },
  });
  assert.equal(macroRes.success, true);
  assert.equal(macroRes.data.substituted, "Hey Krishna, I am Saan");

  // 3. get_authors_note
  const anRes = await dispatchSaanAction("get_authors_note", { turnCount: 2 });
  assert.equal(anRes.success, true);
  assert.notEqual(anRes.data, null);

  // 4. set_chat_variable and get_chat_variable
  const setVarRes = await dispatchSaanAction("set_chat_variable", {
    key: "current_topic",
    value: "quantum computing",
  });
  assert.equal(setVarRes.success, true);

  const getVarRes = await dispatchSaanAction("get_chat_variable", { key: "current_topic" });
  assert.equal(getVarRes.success, true);
  assert.equal(getVarRes.data.value, "quantum computing");
});

test("DEFAULT_SAAN_LOREBOOK: activates Phryvos sanctuary and Krishna lore on relevant prompt keywords", () => {
  const { DEFAULT_SAAN_LOREBOOK, evaluateLorebook } = require("../../lib/saan/lorebook");
  assert.ok(DEFAULT_SAAN_LOREBOOK.length >= 4);

  // Turn: user mentions "phryvos" and "chai"
  const res = evaluateLorebook(
    "Namaste Saan! Aaj hum phryvos architecture par kaam karenge aur subah ki chai piyenge.",
    DEFAULT_SAAN_LOREBOOK,
    { currentTurn: 1, activeSticky: {}, activeCooldown: {} }
  );

  assert.ok(res.activatedEntries.length >= 2);
  const ids = res.activatedEntries.map((e: any) => e.id);
  assert.ok(ids.includes("lore_phryvos"));
  assert.ok(ids.includes("lore_chai"));
  assert.ok(res.combinedContent.includes("Phryvos K7"));
  assert.ok(res.combinedContent.includes("adrak-elaichi chai"));
});

test("SillyTavern Multi-Swipe Alternative & CCv2 Export: exports valid JSON and maintains alternative swipes", () => {
  const card = exportSaanToCardV2();
  const serialized = serializeCharacterCardV2(card);
  const parsed = parseCharacterCardJson(serialized);

  assert.equal(parsed.spec, "chara_card_v2");
  assert.equal(parsed.data.name, "Saan");

  // Verify swipe model structure
  const testMessage = {
    id: "msg_1",
    sender: "saan",
    text: "First draft reply.",
    alternatives: ["Second alternative reply.", "Third alternative reply."],
    activeAltIndex: 2, // points to 2nd alternative (3rd total option)
  };

  assert.equal(testMessage.alternatives.length, 2);
  const activeText = testMessage.activeAltIndex === 0 ? testMessage.text : testMessage.alternatives[testMessage.activeAltIndex - 1];
  assert.equal(activeText, "Third alternative reply.");
});
