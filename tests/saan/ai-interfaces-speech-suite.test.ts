import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  KokoroTextSplitter,
  CircadianCadenceEngine,
} from "../../lib/saan/kokoro-cadence-pacing";

import {
  WhisperAsrNormalizer,
} from "../../lib/saan/whisper-asr-normalizer";

import {
  PreflightFilterPipeline,
} from "../../lib/saan/preflight-filter-pipeline";

import {
  ArtifactReasoningEngine,
} from "../../lib/saan/artifact-reasoning-engine";

import {
  dispatchSaanAction,
} from "../../lib/saan/controller";

describe("Category 5 & 6: AI Interfaces, Speech Intelligence & Vault UX (Repos 39-43)", () => {
  // ==========================================
  // REPO 39: Kokoro Cadence & Speech Pacing
  // ==========================================
  describe("Repo 39: Kokoro Cadence & Speech Pacing", () => {
    test("AST nesting stack prevents splitting inside English and Japanese quotes and parentheses", () => {
      const splitter = new KokoroTextSplitter();

      // Enclosed English quote with inner sentence
      const text1 = 'She said, "Hello there. How are you?". I replied, "I\'m fine."';
      const s1 = splitter.split(text1);
      assert.equal(s1.length, 2);
      assert.equal(s1[0], 'She said, "Hello there. How are you?".');
      assert.equal(s1[1], 'I replied, "I\'m fine."');

      // Parentheses with internal periods
      const text2 = "This is an example (This is pretty cool. Another sentence). Do you agree?";
      const s2 = splitter.split(text2);
      assert.equal(s2.length, 2);
      assert.equal(s2[0], "This is an example (This is pretty cool. Another sentence).");
      assert.equal(s2[1], "Do you agree?");
    });

    test("Protects contractions, floating numbers, and common abbreviations", () => {
      const splitter = new KokoroTextSplitter();

      const text = "Dr. Smith bought coffee for $9.99 today. It's a sunny day!";
      const sentences = splitter.split(text);

      assert.equal(sentences.length, 2);
      assert.equal(sentences[0], "Dr. Smith bought coffee for $9.99 today.");
      assert.equal(sentences[1], "It's a sunny day!");
    });

    test("Calculates dynamic circadian cadence based on hour of day", () => {
      const engine = new CircadianCadenceEngine();

      // Morning (7 AM)
      const m = engine.getCadenceSettings(7);
      assert.equal(m.timeSlot, 'morning');
      assert.equal(m.speed, 1.10);
      assert.equal(m.tone, 'energetic');

      // Afternoon (2 PM)
      const d = engine.getCadenceSettings(14);
      assert.equal(d.timeSlot, 'day');
      assert.equal(d.speed, 1.00);
      assert.equal(d.tone, 'focused');

      // Evening (8 PM)
      const e = engine.getCadenceSettings(20);
      assert.equal(e.timeSlot, 'evening');
      assert.equal(e.speed, 0.95);
      assert.equal(e.tone, 'warm');

      // Night (11 PM)
      const n = engine.getCadenceSettings(23);
      assert.equal(n.timeSlot, 'night');
      assert.equal(n.speed, 0.88);
      assert.equal(n.tone, 'gentle');
      assert.ok(n.periodPauseMs >= 500, "Night should feature lengthened pauses");
    });
  });

  // ==========================================
  // REPO 40: Whisper Multilingual ASR Normalizer
  // ==========================================
  describe("Repo 40: Whisper Multilingual ASR Normalizer", () => {
    test("Scrubs non-speech audio cues and bracketed artifacts", () => {
      const normalizer = new WhisperAsrNormalizer();
      const raw = "[laughter] Haan bilkul [cough], we should proceed (applause) right now.";
      const clean = normalizer.normalize(raw);

      assert.ok(!clean.includes('[laughter]'));
      assert.ok(!clean.includes('[cough]'));
      assert.ok(!clean.includes('(applause)'));
      assert.equal(clean, "Haan bilkul , we should proceed right now.");
    });

    test("Configures multilingual Hinglish decoding options", () => {
      const normalizer = new WhisperAsrNormalizer();
      const config = normalizer.getDecodingConfig('hinglish', 'Saan sovereign assistant context');

      assert.equal(config.language, 'hi');
      assert.equal(config.task, 'transcribe');
      assert.ok(config.temperatureCascade.length >= 5);
      assert.equal(config.promptPrefix, 'Saan sovereign assistant context');
    });

    test("Evaluates temperature fallback on repetitive loops and low confidence", () => {
      const normalizer = new WhisperAsrNormalizer();

      // Normal condition
      const r1 = normalizer.evaluateTemperatureFallback(0.0, false, -0.3);
      assert.equal(r1.shouldFallback, false);
      assert.equal(r1.nextTemperature, 0.0);

      // Repetition loop detected
      const r2 = normalizer.evaluateTemperatureFallback(0.0, true);
      assert.equal(r2.shouldFallback, true);
      assert.equal(r2.nextTemperature, 0.2);
    });
  });

  // ==========================================
  // REPO 41: Open-WebUI Preflight Filter Pipeline
  // ==========================================
  describe("Repo 41: Open-WebUI Preflight Filter & Security Valves", () => {
    test("Scrubs API keys, AWS keys, JWTs, and private keys from prompts", () => {
      const pipeline = new PreflightFilterPipeline();
      const dirtyPrompt = `
        Connecting to API with key sk-proj12345678901234567890 and AWS key AKIAIOSFODNN7EXAMPLE.
        Here is the token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c.
        -----BEGIN RSA PRIVATE KEY-----
        MIIEowIBAAKCAQEA0Y3X7...
        -----END RSA PRIVATE KEY-----
      `;

      const res = pipeline.scrubCredentials(dirtyPrompt);

      assert.ok(!res.cleanedText.includes('sk-proj12345678901234567890'));
      assert.ok(!res.cleanedText.includes('AKIAIOSFODNN7EXAMPLE'));
      assert.ok(!res.cleanedText.includes('eyJhbGciOiJIUzI1Ni'));
      assert.ok(!res.cleanedText.includes('BEGIN RSA PRIVATE KEY'));
      assert.ok(res.cleanedText.includes('[REDACTED_API_KEY]'));
      assert.ok(res.cleanedText.includes('[REDACTED_AWS_KEY]'));
      assert.ok(res.cleanedText.includes('[REDACTED_JWT]'));
      assert.ok(res.cleanedText.includes('[REDACTED_PRIVATE_KEY]'));
      assert.ok(res.redactedCount >= 4);
    });

    test("Sanitizes executable code by stripping ANSI codes and markdown fences", () => {
      const pipeline = new PreflightFilterPipeline();
      const rawCode = "```python\n\x1b[31mprint('hello')\x1b[0m\n```";
      const cleanCode = pipeline.sanitizeCode(rawCode);

      assert.equal(cleanCode, "print('hello')");
    });
  });

  // ==========================================
  // REPOS 42 & 43: LibreChat Artifacts & HF Chat-UI Reasoning
  // ==========================================
  describe("Repos 42 & 43: Modular Artifacts & Expandable Reasoning Accordion", () => {
    test("Extracts <think> internal CoT reasoning from response body", () => {
      const engine = new ArtifactReasoningEngine();
      const content = "<think>\nStep 1: Check user database.\nStep 2: Prepare briefing.\n</think>\nGood morning! Here is your plan.";

      const res = engine.extractReasoning(content);
      assert.equal(res.hasReasoning, true);
      assert.equal(res.reasoning, "Step 1: Check user database.\nStep 2: Prepare briefing.");
      assert.equal(res.cleanedAnswer, "Good morning! Here is your plan.");
    });

    test("Extracts structured interactive artifacts with metadata", () => {
      const engine = new ArtifactReasoningEngine();
      const content = `
        Here is the architecture diagram:
        <artifact identifier="arch-flow" type="application/vnd.mermaid" title="System Architecture">
        graph TD
        A[Client] --> B[Server]
        </artifact>
        And here is the script:
        <artifact identifier="setup-script" type="code" language="typescript" title="Setup Runner">
        export function init() { console.log('Ready'); }
        </artifact>
      `;

      const artifacts = engine.extractArtifacts(content);
      assert.equal(artifacts.length, 2);

      assert.equal(artifacts[0].identifier, 'arch-flow');
      assert.equal(artifacts[0].type, 'mermaid');
      assert.equal(artifacts[0].filename, 'arch-flow.mmd');

      assert.equal(artifacts[1].identifier, 'setup-script');
      assert.equal(artifacts[1].type, 'code');
      assert.equal(artifacts[1].language, 'typescript');
      assert.equal(artifacts[1].filename, 'setup-script.ts');
    });

    test("Extracts web citations and formats source chips", () => {
      const engine = new ArtifactReasoningEngine();
      const content = "For more details see https://docs.phryvos.org/k7 and https://github.com/hexgrad/kokoro.";

      const citations = engine.extractCitations(content);
      assert.equal(citations.length, 2);
      assert.equal(citations[0].domain, 'docs.phryvos.org');
      assert.equal(citations[1].domain, 'github.com');
    });
  });

  // ==========================================
  // CONTROLLER INTEGRATION
  // ==========================================
  describe("Controller Action Dispatch Integration", () => {
    test("Dispatches evaluate_speech_cadence action", async () => {
      const res = await dispatchSaanAction("evaluate_speech_cadence", {
        text: "Good morning Saan. Ready for the day?",
        hourOfDay: 8,
      });

      assert.equal(res.success, true);
      assert.equal(res.tier, 1);
      assert.equal(res.data.settings.timeSlot, 'morning');
      assert.equal(res.data.sentences.length, 2);
    });

    test("Dispatches normalize_asr_transcript action", async () => {
      const res = await dispatchSaanAction("normalize_asr_transcript", {
        rawTranscript: "[laughter] Haan bhai, kaam ho gaya.",
        lang: "hi",
      });

      assert.equal(res.success, true);
      assert.equal(res.data.decodingConfig.language, 'hi');
      assert.ok(!res.data.normalizedTranscript.includes('[laughter]'));
    });

    test("Dispatches scrub_preflight_prompt action", async () => {
      const res = await dispatchSaanAction("scrub_preflight_prompt", {
        prompt: "Use secret key sk-test12345678901234567890 for API calls.",
        codeToSanitize: "```ts\nconst x: number = 10;\n```",
      });

      assert.equal(res.success, true);
      assert.equal(res.data.redactedCount, 1);
      assert.equal(res.data.sanitizedCode, "const x: number = 10;");
    });

    test("Dispatches extract_artifacts_and_reasoning action", async () => {
      const res = await dispatchSaanAction("extract_artifacts_and_reasoning", {
        content: "<think>Verify data</think>Finished! <artifact identifier=\"test\" type=\"code\" language=\"py\">print(42)</artifact> https://example.com",
      });

      assert.equal(res.success, true);
      assert.equal(res.data.reasoning.hasReasoning, true);
      assert.equal(res.data.artifacts.length, 1);
      assert.equal(res.data.citations.length, 1);
    });
  });
});
