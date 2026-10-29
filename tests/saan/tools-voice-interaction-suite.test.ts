import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  StealthHeaderGenerator,
  DEVICE_PROFILES,
  type DevicePreset,
} from "../../lib/saan/stealth-fetch-headers";

import {
  McpJsonRpcBridge,
  type McpTool,
  type McpResource,
  type McpPrompt,
} from "../../lib/saan/mcp-jsonrpc-bridge";

import {
  PipecatFramePipeline,
  AudioRawFrame,
  TextFrame,
  CancelFrame,
  type Frame,
} from "../../lib/saan/pipecat-frame-pipeline";

import {
  VoiceTurnTakingFSM,
  UtteranceNormalizer,
} from "../../lib/saan/voice-turntaking-fsm";

import {
  dispatchSaanAction,
} from "../../lib/saan/controller";

describe("Category 5: Tools, Wire Protocols & Voice Interaction Suite (Repos 34-38)", () => {
  // ==========================================
  // REPO 34: Playwright Anti-Bot Stealth Headers
  // ==========================================
  describe("Repo 34: Playwright Anti-Bot Stealth Headers", () => {
    test("Generates Chromium Client Hints headers for desktop Chrome profile", () => {
      const generator = new StealthHeaderGenerator();
      const headers = generator.generateHeaders('desktop-chrome-linux');

      assert.ok(headers['User-Agent'].includes('Chrome'), "User-Agent should include Chrome");
      assert.equal(headers['Sec-Ch-Ua-Mobile'], '?0', "Desktop should have Sec-Ch-Ua-Mobile ?0");
      assert.equal(headers['Sec-Ch-Ua-Platform'], '"Linux"', "Linux platform hint required");
      assert.ok(headers['Sec-Ch-Ua'].includes('Chromium'), "Sec-Ch-Ua brand list should include Chromium");
      assert.equal(headers['Sec-Fetch-Mode'], 'navigate');
      assert.equal(headers['Sec-Fetch-Dest'], 'document');
      assert.equal(headers['Upgrade-Insecure-Requests'], '1');
    });

    test("Generates mobile Client Hints headers for Android Pixel profile", () => {
      const generator = new StealthHeaderGenerator();
      const headers = generator.generateHeaders('mobile-pixel-android');

      assert.ok(headers['User-Agent'].includes('Android'), "User-Agent should include Android");
      assert.equal(headers['Sec-Ch-Ua-Mobile'], '?1', "Mobile device must have Sec-Ch-Ua-Mobile ?1");
      assert.equal(headers['Sec-Ch-Ua-Platform'], '"Android"', "Android platform hint required");
    });

    test("Omits Sec-Ch-Ua headers for Safari/WebKit profiles", () => {
      const generator = new StealthHeaderGenerator();
      const headers = generator.generateHeaders('desktop-safari-mac');

      assert.ok(headers['User-Agent'].includes('Safari'), "User-Agent should include Safari");
      assert.equal(headers['Sec-Ch-Ua'], undefined, "Safari does not send Chromium Sec-Ch-Ua");
      assert.equal(headers['Sec-Ch-Ua-Mobile'], undefined, "Safari does not send Sec-Ch-Ua-Mobile");
    });

    test("Allows header overrides and profile inspection", () => {
      const generator = new StealthHeaderGenerator();
      const headers = generator.generateHeaders('desktop-chrome-windows', {
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'X-Custom-Token': 'saan-test-42',
      });

      assert.equal(headers['Accept-Language'], 'fr-FR,fr;q=0.9');
      assert.equal(headers['X-Custom-Token'], 'saan-test-42');
      assert.equal(headers['Sec-Ch-Ua-Platform'], '"Windows"');

      const profile = generator.getProfile('desktop-chrome-windows');
      assert.equal(profile.viewport.width, 1920);
      assert.equal(profile.platform, 'Windows');
    });
  });

  // ==========================================
  // REPO 35: Model Context Protocol (MCP 2.x) Bridge
  // ==========================================
  describe("Repo 35: Model Context Protocol (MCP 2.x) Wire Protocol", () => {
    test("Performs MCP 2024-11-05 initialize handshake", async () => {
      const bridge = new McpJsonRpcBridge();
      const res = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'k7-test-client', version: '1.0.0' },
        },
      });

      assert.ok(res, "Response should not be null");
      assert.equal(res.id, 1);
      assert.equal(res.result.protocolVersion, '2024-11-05');
      assert.equal(res.result.serverInfo.name, 'saan-k7-mcp');
      assert.ok(res.result.capabilities.tools, "Server should advertise tool capability");
      assert.ok(res.result.capabilities.resources, "Server should advertise resources capability");
    });

    test("Handles tools/list and dynamic tools/call execution", async () => {
      const bridge = new McpJsonRpcBridge();
      bridge.registerTool(
        {
          name: 'add_numbers',
          description: 'Adds two numbers together',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'number' }, b: { type: 'number' } },
            required: ['a', 'b'],
          },
        },
        async (args) => ({ sum: (args.a || 0) + (args.b || 0) })
      );

      // 1. List tools
      const listRes = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });
      assert.ok(listRes?.result?.tools?.some((t: any) => t.name === 'add_numbers'));

      // 2. Call tool
      const callRes = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'add_numbers',
          arguments: { a: 17, b: 25 },
        },
      });

      assert.equal(callRes?.id, 3);
      assert.equal(callRes?.result?.isError, false);
      const parsedOutput = JSON.parse(callRes?.result?.content?.[0]?.text);
      assert.equal(parsedOutput.sum, 42);
    });

    test("Handles resources/list and resources/read with URIs", async () => {
      const bridge = new McpJsonRpcBridge();
      bridge.registerResource(
        { uri: 'saan://vault/stats', name: 'Vault Stats', mimeType: 'application/json' },
        () => JSON.stringify({ activeMemories: 512, status: 'encrypted' })
      );

      const listRes = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/list',
      });
      assert.ok(listRes?.result?.resources?.some((r: any) => r.uri === 'saan://vault/stats'));

      const readRes = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 5,
        method: 'resources/read',
        params: { uri: 'saan://vault/stats' },
      });

      assert.equal(readRes?.result?.contents?.[0]?.uri, 'saan://vault/stats');
      const stats = JSON.parse(readRes?.result?.contents?.[0]?.text);
      assert.equal(stats.activeMemories, 512);
    });

    test("Handles prompts/list and prompts/get with template arguments", async () => {
      const bridge = new McpJsonRpcBridge();
      bridge.registerPrompt(
        {
          name: 'sovereign_advice',
          description: 'Sovereign companion guidance template',
          arguments: [{ name: 'topic', required: true }],
        },
        (args) => [
          {
            role: 'system',
            content: { type: 'text', text: `You are Saan providing guidance on ${args?.topic || 'general'}` },
          },
        ]
      );

      const getRes = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 6,
        method: 'prompts/get',
        params: { name: 'sovereign_advice', arguments: { topic: 'local AI security' } },
      });

      assert.equal(getRes?.result?.messages?.[0]?.role, 'system');
      assert.ok(getRes?.result?.messages?.[0]?.content?.text.includes('local AI security'));
    });

    test("Returns standard JSON-RPC errors for unknown methods and missing tools", async () => {
      const bridge = new McpJsonRpcBridge();
      // Unknown method
      const errRes1 = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 7,
        method: 'unknown/method',
      });
      assert.equal(errRes1?.error?.code, -32601);

      // Tool not found
      const errRes2 = await bridge.handleMessage({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'non_existent_tool' },
      });
      assert.equal(errRes2?.error?.code, -32602);
    });
  });

  // ==========================================
  // REPO 36: Pipecat Streaming Frame Pipeline
  // ==========================================
  describe("Repo 36: Pipecat Streaming Frame Pipeline", () => {
    test("Maintains monotonic nanosecond timestamps (pts) across frames", () => {
      const pipeline = new PipecatFramePipeline();
      const f1 = new AudioRawFrame(new Uint8Array(160), 16000, 1);
      const f2 = new TextFrame("hello voice");

      assert.ok(f2.pts >= f1.pts, "Presentation timestamps must be monotonically non-decreasing");
      assert.equal(f1.sampleRate, 16000);
      assert.equal(f2.text, "hello voice");
      assert.equal(f1.interruptible, true);
    });

    test("Atomic queue draining on CancelFrame (barge-in cancellation)", () => {
      const pipeline = new PipecatFramePipeline();
      pipeline.clear();

      // Enqueue 3 interruptible frames
      pipeline.push(new AudioRawFrame(new Uint8Array(160)));
      pipeline.push(new AudioRawFrame(new Uint8Array(160)));
      pipeline.push(new TextFrame("queued speech"));
      assert.equal(pipeline.size(), 3);

      // Barge-in: Push CancelFrame
      const cancel = new CancelFrame("user_spoke_over");
      pipeline.push(cancel);

      // All 3 interruptible frames were purged; only CancelFrame remains
      assert.equal(pipeline.size(), 1);
      const nextFrame = pipeline.pop();
      assert.ok(nextFrame instanceof CancelFrame);
      assert.equal((nextFrame as CancelFrame).reason, "user_spoke_over");
      assert.equal(pipeline.size(), 0);
    });
  });

  // ==========================================
  // REPO 37 & 38: LiveKit Turn-Taking FSM & OVOS Normalization
  // ==========================================
  describe("Repos 37 & 38: Voice Turn-Taking FSM & Spoken Utterance Normalization", () => {
    test("FSM cycles cleanly through conversational voice states", () => {
      const fsm = new VoiceTurnTakingFSM();
      assert.equal(fsm.getState(), 'IDLE');

      // User starts speaking
      let trans = fsm.handleEvent('user_speech_start');
      assert.equal(trans.currentState, 'LISTENING');
      assert.equal(trans.bargeInDetected, false);

      // User stops speaking
      trans = fsm.handleEvent('user_speech_end');
      assert.equal(trans.currentState, 'THINKING');

      // LLM produces speech synthesis
      trans = fsm.handleEvent('llm_response_ready');
      assert.equal(trans.currentState, 'SPEAKING');

      // TTS playback finishes
      trans = fsm.handleEvent('bot_speech_end');
      assert.equal(trans.currentState, 'IDLE');
    });

    test("Detects barge-in speech interruption while SPEAKING", () => {
      const fsm = new VoiceTurnTakingFSM();
      // Set to SPEAKING
      fsm.handleEvent('user_speech_start');
      fsm.handleEvent('user_speech_end');
      fsm.handleEvent('llm_response_ready');
      assert.equal(fsm.getState(), 'SPEAKING');

      // User speaks over bot
      const trans = fsm.handleEvent('user_speech_start');
      assert.equal(trans.currentState, 'LISTENING');
      assert.equal(trans.bargeInDetected, true, "Barge-in must be flagged when user interrupts SPEAKING state");
    });

    test("OVOS Normalizer scrubs acoustic fillers and stutter repetitions", () => {
      const normalizer = new UtteranceNormalizer();

      // Acoustic fillers
      const raw1 = "um so like what is the weather today ah i mean in Paris";
      const clean1 = normalizer.normalize(raw1);
      assert.ok(!clean1.includes("um"), "Should remove 'um'");
      assert.ok(!clean1.includes("like"), "Should remove 'like'");
      assert.ok(!clean1.includes("i mean"), "Should remove 'i mean'");
      assert.ok(clean1.includes("what is the weather today"), "Should preserve core intent");

      // Stutter repetitions
      const raw2 = "I I think we we should schedule the meeting";
      const clean2 = normalizer.normalize(raw2);
      assert.equal(clean2, "I think we should schedule the meeting");
    });
  });

  // ==========================================
  // CONTROLLER INTEGRATION
  // ==========================================
  describe("Controller Action Dispatch Integration", () => {
    test("Dispatches generate_stealth_headers action", async () => {
      const result = await dispatchSaanAction("generate_stealth_headers", {
        preset: "mobile-pixel-android",
      });

      assert.equal(result.success, true);
      assert.equal(result.tier, 1);
      assert.equal(result.data.profile.isMobile, true);
      assert.equal(result.data.headers['Sec-Ch-Ua-Mobile'], '?1');
    });

    test("Dispatches dispatch_mcp_call action to query registered resources", async () => {
      const result = await dispatchSaanAction("dispatch_mcp_call", {
        message: {
          jsonrpc: "2.0",
          id: 101,
          method: "resources/read",
          params: { uri: "saan://status" },
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.data.id, 101);
      const parsed = JSON.parse(result.data.result.contents[0].text);
      assert.equal(parsed.node, "phryvos-k7");
      assert.equal(parsed.companion, "saan");
    });

    test("Dispatches process_audio_frame and barge-in interrupt action", async () => {
      // Normal frame
      const r1 = await dispatchSaanAction("process_audio_frame", {
        sampleRate: 16000,
        channels: 1,
      });
      assert.equal(r1.success, true);
      assert.ok(r1.data.frameId > 0);

      // Barge-in interrupt
      const r2 = await dispatchSaanAction("process_audio_frame", {
        interrupt: true,
      });
      assert.equal(r2.success, true);
      assert.equal(r2.data.interrupted, true);
    });

    test("Dispatches handle_voice_turn_event and normalizes spoken input", async () => {
      const result = await dispatchSaanAction("handle_voice_turn_event", {
        event: "user_speech_start",
        spokenInput: "um uh hello Saan Saan can you hear me",
      });

      assert.equal(result.success, true);
      assert.equal(result.data.transition.currentState, "LISTENING");
      assert.equal(result.data.normalizedText, "hello Saan can you hear me");
    });
  });
});
