import { NextRequest, NextResponse } from "next/server";
import {
  getSaanProfile,
  buildSaanSystemPrompt,
  sanitizeSaanOutput,
  updateRelationshipFromSentiment,
} from "@/lib/saan/soul";
import {
  getSaanMemories,
  extractMemoriesFromTurn,
  getBondScore,
  bumpBondScore,
} from "@/lib/saan/memory";
import {
  SAAN_TOOLS_SPEC,
  parseDirtyJson,
  executeRollback,
  dispatchSaanAction,
  type SaanActionResult,
} from "@/lib/saan/controller";
import { checkCrisisSignals } from "@/lib/saan/safety";
import { recordUserReplied } from "@/lib/saan/proactive";
import { pickReaction, splitBurst, calculateReplyDelay } from "@/lib/saan/humanize";
import { getMoodOrgan } from "@/lib/saan/mood-organ";
import { recordSpoken } from "@/lib/saan/familiarity";
import { splitOoc, formatDirectorNotes, forNarrative } from "@/lib/saan/ooc";
import { findOverusedPhrases, formatAntiSlopPrompt } from "@/lib/saan/anti-slop";
import { looksConsequential, loadLedgerFromDb, addDeeds, dueDeeds, mentionsOpenDeed, markAnswered, syncLedgerToDb } from "@/lib/saan/ledger";
import { reinforceMemory } from "@/lib/saan/auto-promote";
import { formatTimePrefix } from "@/lib/saan/airi-datetime";
import { categorizeResponse } from "@/lib/saan/airi-reasoning";
import { parseStreamingControlTokens } from "@/lib/saan/airi-streaming-control";
import {
  evaluateLorebook,
  DEFAULT_SAAN_LOREBOOK,
  getActiveLorebookState,
  setActiveLorebookState,
} from "@/lib/saan/lorebook";
import {
  exportSaanToCardV2,
  serializeCharacterCardV2,
  parseCharacterCardJson,
} from "@/lib/saan/character-card";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";
import { substituteMacros } from "@/lib/saan/macro-engine";
import { insertPromptsAtDepth } from "@/lib/saan/depth-injector";
import { getAuthorsNoteInjection } from "@/lib/saan/authors-note";
import { mergeConsecutiveRoles } from "@/lib/saan/prompt-merger";
import { applyRegexPipeline } from "@/lib/saan/regex-pipeline";
import { pruneContextTurns, clampOutputTokens } from "@/lib/saan/token-budget";
import {
  getGraphMemoryStore,
  searchGlobalGraph,
  DEFAULT_SAAN_GRAPH_NODES,
  type GraphNode,
} from "@/lib/saan/graph-memory";
import { globalChatVariables } from "@/lib/saan/chat-variables";
import { getCoreMemoryManager } from "@/lib/saan/core-memory-blocks";
import { getMem0AuditLog } from "@/lib/saan/mem0-decision-matrix";
import { getTemporalEdgeGraphStore } from "@/lib/saan/temporal-edge-graph";
import { requireVault } from "@/server/vault-guard";
import { defaultProvider, createLlmClient } from "@/lib/providers-service";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is a rollback request
    if (body.type === "rollback" && body.snapshotId) {
      const rollbackRes = executeRollback(body.snapshotId);
      return NextResponse.json({ ok: rollbackRes.success, message: rollbackRes.message });
    }

    // Direct Action Dispatch for Saan 50-Repo OS Cockpit
    if (body.type === "action" && body.action) {
      const actionRes = await dispatchSaanAction(body.action, body.params || {});
      return NextResponse.json({ ok: actionRes.success, actionResult: actionRes });
    }

    // SillyTavern CharacterCard V2/V3 Export
    if (body.type === "export_card") {
      const card = exportSaanToCardV2();
      return NextResponse.json({
        ok: true,
        card,
        json: serializeCharacterCardV2(card),
      });
    }

    // SillyTavern CharacterCard V2/V3 Import
    if (body.type === "import_card" && body.cardData) {
      const parsed = parseCharacterCardJson(body.cardData);
      return NextResponse.json({
        ok: true,
        message: `Loaded character card '${parsed.data.name}' successfully!`,
        card: parsed,
      });
    }

    // RisuAI Chat Variables Management
    if (body.type === "get_chat_variables") {
      return NextResponse.json({ ok: true, variables: globalChatVariables.getAll() });
    }
    if (body.type === "set_chat_variable" && body.key) {
      globalChatVariables.set(body.key, body.value);
      return NextResponse.json({ ok: true, variables: globalChatVariables.getAll() });
    }
    if (body.type === "increment_chat_variable" && body.key) {
      const next = globalChatVariables.add(body.key, body.delta ?? 1);
      return NextResponse.json({ ok: true, key: body.key, value: next, variables: globalChatVariables.getAll() });
    }
    if (body.type === "toggle_chat_variable" && body.key) {
      const next = globalChatVariables.toggle(body.key);
      return NextResponse.json({ ok: true, key: body.key, value: next, variables: globalChatVariables.getAll() });
    }

    // RisuAI Graph Associative Memory Management
    if (body.type === "get_graph_nodes") {
      return NextResponse.json({ ok: true, nodes: getGraphMemoryStore().getAllNodes() });
    }
    if (body.type === "query_graph_memory") {
      const searchResult = searchGlobalGraph(body.query || "", body.depth || 1);
      return NextResponse.json({ ok: true, result: searchResult });
    }

    // Letta Core Memory Management
    if (body.type === "get_core_memory") {
      const coreMgr = getCoreMemoryManager();
      return NextResponse.json({
        ok: true,
        coreMemory: {
          human: coreMgr.getBlock("human")?.content || "",
          persona: coreMgr.getBlock("persona")?.content || "",
        },
        summary: coreMgr.getCapacitySummary(),
        history: coreMgr.getHistory(),
      });
    }
    if (body.type === "update_core_memory" && body.coreMemory) {
      const coreMgr = getCoreMemoryManager();
      if (typeof body.coreMemory.human === "string") {
        coreMgr.updateBlock("human", body.coreMemory.human, "user");
      }
      if (typeof body.coreMemory.persona === "string") {
        coreMgr.updateBlock("persona", body.coreMemory.persona, "user");
      }
      return NextResponse.json({
        ok: true,
        message: "Core Memory updated",
        coreMemory: {
          human: coreMgr.getBlock("human")?.content || "",
          persona: coreMgr.getBlock("persona")?.content || "",
        },
        summary: coreMgr.getCapacitySummary(),
        history: coreMgr.getHistory(),
      });
    }

    // Mem0 4-State Memory Audit Log
    if (body.type === "get_mem0_events") {
      return NextResponse.json({ ok: true, events: getMem0AuditLog() });
    }

    // Graphiti Bi-Temporal Knowledge Graph
    if (body.type === "get_temporal_graph") {
      const store = getTemporalEdgeGraphStore();
      const snapshot = store.getSnapshot(body.asOf ? Number(body.asOf) : undefined);
      return NextResponse.json({ ok: true, graph: snapshot });
    }
    if (body.type === "add_temporal_edge" && body.edge) {
      const store = getTemporalEdgeGraphStore();
      const res = store.addEdge(body.edge);
      return NextResponse.json({
        ok: true,
        edge: res.edge,
        supersededEdgeIds: res.supersededEdgeIds,
        graph: store.getSnapshot(),
      });
    }

    const rawUserMessage = body.message;
    const history: IncomingMessage[] = body.history || [];

    if (!rawUserMessage || typeof rawUserMessage !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Split Out-of-Character (OOC) Directives from spoken dialogue (Chronicler ooc.ts pattern)
    const { spoken, directives } = splitOoc(rawUserMessage);
    const userMessage = spoken || rawUserMessage;
    const spokenNarrative = forNarrative(rawUserMessage);
    const directorNote = formatDirectorNotes(directives);

    // 0. Tier-0 Deterministic Crisis Safety Guardrail (HerAndHim safety.py pattern)
    const crisisCheck = checkCrisisSignals(userMessage);
    if (crisisCheck.isCrisis && crisisCheck.response) {
      return NextResponse.json({
        ok: true,
        reply: crisisCheck.response,
        reaction: "🥺",
        bubbles: [crisisCheck.response],
        delayMs: 300,
        action: null,
        profile: getSaanProfile(getBondScore()),
      });
    }

    // Record user activity to clear unanswered proactive streak
    recordUserReplied();

    // Calculate selective pre-reply emoji reaction (HerAndHim humanize.py pattern)
    const reaction = pickReaction(userMessage);

    // Anti-Slop: detect overused phrases in recent assistant replies (Chronicler anti-slop.ts pattern)
    const assistantReplies = history.filter((h) => h.role === "assistant").map((h) => h.content);
    const overusedPhrases = findOverusedPhrases(assistantReplies);
    const antiSlopPrompt = formatAntiSlopPrompt(overusedPhrases);

    // 1. Extract and store any new memories from the user's message (Mem0 4-State Engine)
    const mem0Decisions = extractMemoriesFromTurn(userMessage);

    // 2. Load context: bond score & active bi-temporal memories (Graphiti / Datapace)
    const bondScore = bumpBondScore(1);
    const rawMemories = getSaanMemories(12);
    const memories = rawMemories.map((m) => m.point);

    // Auto-promote reinforcement for used active memories (Chronicler auto-promote.ts pattern)
    for (const m of rawMemories) {
      reinforceMemory(m.id, "active_session");
    }

    // 3. Construct system prompt with tools and circadian presence
    let systemPrompt = buildSaanSystemPrompt(memories, bondScore, SAAN_TOOLS_SPEC);
    systemPrompt += `\n\n${globalAvatarMapper.getPromptSpec()}`;
    if (antiSlopPrompt) {
      systemPrompt += `\n\n${antiSlopPrompt}`;
    }
    if (directorNote) {
      systemPrompt += `\n\n${directorNote}`;
    }

    // SillyTavern Macro substitution on system prompt (with idle duration support)
    const lastTimestamp = body.lastTimestamp ? Number(body.lastTimestamp) : (Date.now() - 3600_000);
    systemPrompt = substituteMacros(systemPrompt, {
      charName: "Saan",
      userName: "Krishna",
      lastUserMessage: rawUserMessage,
      lastInteractionTimestamp: lastTimestamp,
    });

    // SillyTavern World Info / Lorebook Selective Engine
    const currentTurnState = getActiveLorebookState();
    currentTurnState.currentTurn = history.length;
    const lorebookResult = evaluateLorebook(rawUserMessage, DEFAULT_SAAN_LOREBOOK, currentTurnState);
    setActiveLorebookState(lorebookResult.updatedState);

    // Airi temporal anchor prefix for user turns
    const timeStampedUserMessage = `${formatTimePrefix()}${spokenNarrative}`;

    // RisuAI Chat Variables Auto-Increment & Session Sync
    globalChatVariables.add("turn_count", 1);

    // RisuAI Graph Associative Memory Search (BFS 1-hop traversal)
    const graphResult = searchGlobalGraph(rawUserMessage, 1);

    let messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: timeStampedUserMessage },
    ];

    // SillyTavern Context Depth Injection (Author's Note & Active Lore @ depth 2)
    const depthInjections = [];
    if (lorebookResult.combinedContent) {
      depthInjections.push({
        id: "lorebook_active",
        content: `[ACTIVE WORLD INFO / LOREBOOK ANCHORS]:\n${lorebookResult.combinedContent}`,
        role: "system" as const,
        depth: 2,
        order: 90,
      });
    }

    if (graphResult.matchedNodes.length > 0) {
      const graphSummary = graphResult.matchedNodes
        .map((node) => `• ${node.name}: ${node.summary} (Connected: ${node.connections.join(", ")})`)
        .join("\n");
      depthInjections.push({
        id: "graph_memory_associative",
        content: `[ASSOCIATIVE KNOWLEDGE GRAPH CONTEXT]:\n${graphSummary}`,
        role: "system" as const,
        depth: 1,
        order: 85,
      });
    }

    const anInjection = getAuthorsNoteInjection(history.length);
    if (anInjection) {
      depthInjections.push(anInjection);
    }

    if (depthInjections.length > 0) {
      messages = insertPromptsAtDepth(messages, depthInjections);
    }

    // SillyTavern Consecutive Role Merge Engine (strict turn alternation)
    messages = mergeConsecutiveRoles(messages);

    // RisuAI Dynamic Token Headroom & Context Budget Clamping
    const { prunedMessages, budget: tokenBudget } = pruneContextTurns(messages, 8192, 500);
    messages = prunedMessages;
    const clampedMaxTokens = tokenBudget.outputTokens;

    let reply = "";
    let providerUsed = "Vault Provider";
    let fallbackTriggered = false;

    // A. Custom Vault Provider attempt (if vault is unlocked)
    try {
      const vaultCtx = await requireVault();
      const def = defaultProvider(vaultCtx);
      if (def && !def.name.includes("Free Frontier") && !def.baseUrl.includes("pollinations")) {
        const client = createLlmClient(vaultCtx, def.id, { skipScrubber: true });
        const res = await client.createTurn(
          messages,
          undefined,
          def.models[0] || "gpt-4o-mini",
          undefined,
          { timeoutMs: 25_000, temperature: 0.85 }
        );
        if (res.text && res.text.trim()) {
          reply = res.text.trim();
          providerUsed = def.name || "Vault Provider";
          fallbackTriggered = false;
        }
      }
    } catch {
      // Vault locked or no custom provider
    }

    // B. Public Frontier Gateway Cascade (Pollinations OpenAI)
    if (!reply) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 28_000);

        const resp = await fetch("https://text.pollinations.ai/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer free-tier",
          },
          body: JSON.stringify({
            model: "openai",
            messages,
            temperature: 0.88,
            max_tokens: clampedMaxTokens,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          reply = data.choices?.[0]?.message?.content?.trim() || "";
          if (reply) {
            providerUsed = "Frontier Cascade (OpenAI)";
            fallbackTriggered = true;
          }
        }
      } catch (e) {
        // Fallback to text endpoint
      }
    }

    // C. Direct fast fallback
    if (!reply) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);

        const promptText = `${systemPrompt}\n\nRecent conversation:\n${history
          .slice(-4)
          .map((m) => `${m.role === "user" ? "Friend" : "Saan"}: ${m.content}`)
          .join("\n")}\nFriend: ${userMessage}\nSaan:`;

        const resp = await fetch("https://text.pollinations.ai/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: promptText }],
            model: "openai-fast",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const text = await resp.text();
          if (text && !text.includes("Free limit reached")) {
            reply = text.trim();
            providerUsed = "Fast Frontier Fallback";
            fallbackTriggered = true;
          }
        }
      } catch (e) {}
    }

    // D. Organic sleepy / offline fallback if all network failed
    if (!reply) {
      const p = getSaanProfile(bondScore);
      reply = p.isSleeping
        ? "Hmm... neend me hoon yaar. Kal subah baat karte hain na, so ja!"
        : `Hey... main abhi ${p.activity.toLowerCase()} kar rahi thi aur connection thoda atak gaya. Kya bol rahe the?`;
      providerUsed = "Sovereign Organic Fallback";
      fallbackTriggered = true;
    }

    // 4. Check for Action Blocks (`saan_action`) in the reply using DirtyJson (Agent Zero pattern)
    let actionExecuted: SaanActionResult | null = null;
    const actionMatch = reply.match(/```saan_action\s*([\s\S]*?)\s*```/);
    if (actionMatch) {
      const parsed = parseDirtyJson(actionMatch[1]);
      if (parsed && parsed.action) {
        actionExecuted = await dispatchSaanAction(parsed.action, parsed.params || {});
        // Clean out the raw action block from the chat reply text
        reply = reply.replace(/```saan_action[\s\S]*?```/, "").trim();
      }
    }

    // 4b. Airi Reasoning isolation & Streaming Control token categorization
    const categorized = categorizeResponse(reply);
    const thoughts = categorized.thoughts;
    const plans = categorized.plans;
    const streamingControls = parseStreamingControlTokens(categorized.speech);
    reply = streamingControls.cleanText;

    // 5. Post-Generation Anti-AI Cliché Sanitization (SillyTavern pattern)
    reply = sanitizeSaanOutput(reply);
    reply = applyRegexPipeline(reply, "ai_output");

    // 6. HerAndHim Multi-Bubble Burst & Reply Pacing Toolkit
    const bubbles = splitBurst(reply);
    const delayMs = calculateReplyDelay(reply);

    // 7. Update 4D Relationship Tensor (HerAndHim pattern) & Psycheros Mood Organ
    const sentiment = /(\bgood\b|great|love|happy|awesome|mast|badhai|shandar|thank)/i.test(userMessage)
      ? "positive"
      : /(\bbad\b|terrible|sad|angry|gussa|dukhi|upset|hate)/i.test(userMessage)
      ? "negative"
      : "neutral";
    updateRelationshipFromSentiment(sentiment, 0.5);

    // Psycheros Mood Organ: Ingest external turn modifier
    const valenceDelta = sentiment === "positive" ? 0.25 : sentiment === "negative" ? -0.25 : 0.05;
    const arousalDelta = sentiment !== "neutral" ? 0.2 : -0.05;
    getMoodOrgan().ingest({
      valence: valenceDelta,
      arousal: arousalDelta,
      dominance: 0.1,
      weight: 0.5,
      source: "user_turn",
    });

    // Psycheros Familiarity: record spoken output to prevent future repetition
    recordSpoken(reply);

    // Chronicler Consequence Ledger: Record or resolve commitments
    if (looksConsequential(userMessage, reply)) {
      try {
        let ledger = loadLedgerFromDb();
        if (mentionsOpenDeed(ledger, reply)) {
          const due = dueDeeds(ledger, 10);
          if (due.length > 0) {
            ledger = markAnswered(ledger, [due[0].id], 10);
          }
        } else {
          ledger = addDeeds(ledger, [{ deed: `${userMessage.slice(0, 50)}` }], 10);
        }
        syncLedgerToDb(ledger);
      } catch (err) {
        console.warn("[Chat] Consequence ledger sync error:", err);
      }
    }

    const updatedProfile = getSaanProfile(bondScore);

    return NextResponse.json({
      ok: true,
      reply,
      bubbles,
      delayMs,
      reaction,
      action: actionExecuted,
      profile: updatedProfile,
      thoughts,
      plans,
      controls: streamingControls.controls,
      lorebookActivated: lorebookResult.activatedEntries.map((e) => e.id),
      tokenBudget,
      providerTelemetry: {
        providerUsed,
        fallbackTriggered,
        clampedMaxTokens,
      },
      graphAssociations: graphResult.matchedNodes.map((n) => n.name),
      chatVariables: globalChatVariables.getAll(),
      coreMemorySummary: getCoreMemoryManager().getCapacitySummary(),
      mem0Decisions,
      mem0Events: getMem0AuditLog(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process turn" }, { status: 500 });
  }
}

export async function GET() {
  const bondScore = getBondScore();
  return NextResponse.json({
    ok: true,
    profile: getSaanProfile(bondScore),
  });
}
