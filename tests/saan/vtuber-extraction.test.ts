import test from "node:test";
import assert from "node:assert/strict";
import {
  Live2dExpressionMapper,
  globalAvatarMapper,
} from "../../lib/saan/avatar-expressions";
import { StreamSentenceDivider } from "../../lib/saan/sentence-divider";
import {
  OrderedAudioQueue,
  computeRmsVolumeEnvelope,
  type AudioPayload,
} from "../../lib/saan/ordered-audio-queue";
import { StreamJsonDetector } from "../../lib/saan/streaming-json-detector";
import { truncateHeardMemory } from "../../lib/saan/interruption-contract";
import {
  filterStageDirections,
  normalizeSpeakableText,
} from "../../lib/saan/speech-transformer";
import { dispatchSaanAction } from "../../lib/saan/controller";

test("Live2D Avatar Expressions: extracts emotion and motion tokens and strips keywords", () => {
  const mapper = new Live2dExpressionMapper();
  const input = "[joy] [nod] Namaste! Main theek hoon. [blush] Aap kaise ho?";

  const res = mapper.extract(input);
  assert.equal(res.hasActions, true);
  assert.deepEqual(res.expressions, ["joy", "blush"]);
  assert.deepEqual(res.motions, ["nod"]);
  assert.equal(res.speech, "Namaste! Main theek hoon. Aap kaise ho?");

  const cleaned = mapper.removeKeywords(input);
  assert.equal(cleaned, "Namaste! Main theek hoon. Aap kaise ho?");

  const joyIndex = mapper.getExpressionIndex("joy");
  assert.equal(joyIndex, 1);
  const unknownIndex = mapper.getExpressionIndex("unknown_emotion");
  assert.equal(unknownIndex, 0); // fallback to neutral
});

test("Live2D Avatar Touch Interaction: handles head and body hit areas", () => {
  const headTap = globalAvatarMapper.handleTap("head");
  assert.equal(headTap.hitArea, "head");
  assert.equal(headTap.expression, "blush");
  assert.equal(headTap.motion, "nod");
  assert.ok(headTap.dialogueHinglish.includes("sar mat thapthapao"));

  const bodyTap = globalAvatarMapper.handleTap("body");
  assert.equal(bodyTap.hitArea, "body");
  assert.equal(bodyTap.expression, "curious");
  assert.equal(bodyTap.motion, "tilt_head");
  assert.ok(bodyTap.dialogueHinglish.includes("poke"));
});

test("StreamSentenceDivider: faster_first_response splits on first comma for ultra-low TTFA", () => {
  const divider = new StreamSentenceDivider({ fasterFirstResponse: true });

  // Initial feed splits immediately on first comma for ultra-low TTFA (<280ms)
  const chunk1 = divider.feed("Hello my friend,");
  assert.equal(chunk1.length, 1);
  assert.equal(chunk1[0], "Hello my friend,");

  // Subsequent feed processes full sentences
  const chunk2 = divider.feed(" this is sentence one. And this is sentence two.");
  assert.equal(chunk2.length, 2);
  assert.equal(chunk2[0], "this is sentence one.");
  assert.equal(chunk2[1], "And this is sentence two.");

  // Remaining unpunctuated text flushed at end
  divider.feed(" Flushing final words");
  const finalChunks = divider.flush();
  assert.equal(finalChunks.length, 1);
  assert.equal(finalChunks[0], "Flushing final words");
});

test("StreamSentenceDivider: protects abbreviations and code blocks from premature splitting", () => {
  const divider = new StreamSentenceDivider({ fasterFirstResponse: false });

  // Abbreviation Dr. and Mr. should not split prematurely (should result in 2 sentences, not 4)
  const res1 = divider.feed("Good morning Dr. Watson and Mr. Holmes. How are you today?");
  assert.equal(res1.length, 2);
  assert.equal(res1[0], "Good morning Dr. Watson and Mr. Holmes.");
  assert.equal(res1[1], "How are you today?");

  // Code block should not split on period inside code fence
  const codeDivider = new StreamSentenceDivider({ fasterFirstResponse: false });
  const res2 = codeDivider.feed("Check this code: ```ts\nconst x = obj.prop;\n``` Now run it.");
  assert.equal(res2.length, 1);
  assert.ok(res2[0].includes("const x = obj.prop;"));
  assert.ok(res2[0].includes("Now run it."));
});

test("OrderedAudioQueue: buffers out-of-order parallel audio chunks and drains in strict monotonic sequence", async () => {
  const delivered: number[] = [];
  const queue = new OrderedAudioQueue(async (payload) => {
    delivered.push(payload.sequenceNumber);
  });

  const seq0 = queue.nextSequence(); // 0
  const seq1 = queue.nextSequence(); // 1
  const seq2 = queue.nextSequence(); // 2

  assert.equal(seq0, 0);
  assert.equal(seq1, 1);
  assert.equal(seq2, 2);

  const payload0: AudioPayload = {
    sequenceNumber: 0,
    audioBase64: "base64_0",
    text: "Part zero",
    isSilent: false,
    volumes: [0.1, 0.5],
    sliceLengthMs: 20,
  };

  const payload1: AudioPayload = {
    sequenceNumber: 1,
    audioBase64: "base64_1",
    text: "Part one",
    isSilent: false,
    volumes: [0.2, 0.6],
    sliceLengthMs: 20,
  };

  const payload2: AudioPayload = {
    sequenceNumber: 2,
    audioBase64: "base64_2",
    text: "Part two",
    isSilent: false,
    volumes: [0.3, 0.7],
    sliceLengthMs: 20,
  };

  // Deliver 0 first
  await queue.pushPayload(payload0);
  assert.deepEqual(delivered, [0]);

  // Deliver 2 BEFORE 1 (parallel race condition simulation)
  await queue.pushPayload(payload2);
  // 2 must NOT be delivered yet because 1 is missing!
  assert.deepEqual(delivered, [0]);

  // Now deliver 1 -> queue must drain 1 AND then 2!
  await queue.pushPayload(payload1);
  assert.deepEqual(delivered, [0, 1, 2]);
});

test("computeRmsVolumeEnvelope: computes normalized 20ms RMS volume slices", () => {
  // Generate 1600 samples (100ms at 16000Hz = 5 slices of 20ms / 320 samples each)
  const samples: number[] = [];
  for (let i = 0; i < 1600; i++) {
    // Generate sine wave amplitude
    samples.push(Math.sin((i / 1600) * Math.PI * 4) * 0.8);
  }

  const envelope = computeRmsVolumeEnvelope(samples, 20, 16000);
  assert.equal(envelope.length, 5);
  // Each envelope slice should be between 0.0 and 1.0
  for (const val of envelope) {
    assert.ok(val >= 0.0 && val <= 1.0);
  }
  // Max value in normalized envelope should be 1.0
  assert.equal(Math.max(...envelope), 1.0);
});

test("StreamJsonDetector: detects complete JSON objects mid-stream via brace depth tracking", () => {
  const detector = new StreamJsonDetector();

  const chunk1 = detector.feed('Sure, I will schedule this. {"action": "create_event",');
  assert.deepEqual(chunk1, []);
  assert.equal(detector.getCompleted().length, 0);

  const chunk2 = detector.feed(' "startAt": 1700000000} And here is more normal text.');
  assert.equal(chunk2.length, 1);
  assert.equal(chunk2[0].action, "create_event");
  assert.equal(chunk2[0].startAt, 1700000000);
  assert.equal(detector.getCleanText(), "Sure, I will schedule this. And here is more normal text.");
});

test("truncateHeardMemory: enforces auditory reality contract on user interruption", () => {
  const fullAssistantText =
    "Namaste! Today is a beautiful morning. We have scheduled your design review for 10 AM, and your laundry is also due by evening. Let me know if you want to make any changes.";

  // User interrupted after 2 seconds (around 5 words at 150 wpm)
  const truncated = truncateHeardMemory(fullAssistantText, 2.0, 150);
  assert.equal(truncated.wasTruncated, true);
  assert.ok(truncated.savedContent.includes("[Interrupted by user]"));
  assert.ok(truncated.savedContent.includes("..."));
  assert.ok(truncated.heardWordsCount < truncated.totalWordsCount);

  // If user listened to the entire audio (e.g. 60 seconds), it is not truncated
  const full = truncateHeardMemory(fullAssistantText, 60.0, 150);
  assert.equal(full.wasTruncated, false);
  assert.equal(full.savedContent, fullAssistantText);
});

test("speech-transformer: filterStageDirections and normalizeSpeakableText", () => {
  // Test stage directions and bracket stripping
  const rawText = "*smiles warmly* [joy] Hello Krishna! *waves hand* [nod] How are you?";
  const cleanSpeech = filterStageDirections(rawText);
  assert.equal(cleanSpeech, "Hello Krishna! How are you?");

  // Test speakable normalizations
  const unnormalized = "The price is $50.25 at 9:05 PM on 10/28/2026.";
  const speakable = normalizeSpeakableText(unnormalized);
  assert.ok(speakable.includes("50 dollars and 25 cents"));
  assert.ok(speakable.includes("9 oh 5 PM"));
  assert.ok(speakable.includes("October 28, 2026"));
});

test("controller: dispatches Open-LLM-VTuber actions via dispatchSaanAction", async () => {
  // 1. map_avatar_expression
  const emoRes = await dispatchSaanAction("map_avatar_expression", {
    text: "[blush] [tilt_head] Thank you so much!",
  });
  assert.equal(emoRes.success, true);
  assert.equal(emoRes.tier, 1);
  assert.deepEqual(emoRes.data.expressions, ["blush"]);
  assert.deepEqual(emoRes.data.motions, ["tilt_head"]);
  assert.equal(emoRes.data.speech, "Thank you so much!");

  // 2. handle_avatar_tap
  const tapRes = await dispatchSaanAction("handle_avatar_tap", { hitArea: "head" });
  assert.equal(tapRes.success, true);
  assert.equal(tapRes.tier, 1);
  assert.equal(tapRes.data.expression, "blush");

  // 3. normalize_speakable_text
  const normRes = await dispatchSaanAction("normalize_speakable_text", {
    text: "Cost is $15 at 3:05 PM",
  });
  assert.equal(normRes.success, true);
  assert.ok(normRes.data.speakableText.includes("15 dollars"));
  assert.ok(normRes.data.speakableText.includes("3 oh 5 PM"));

  // 4. get_rms_volume_envelope
  const envRes = await dispatchSaanAction("get_rms_volume_envelope", {
    samples: [0.1, -0.2, 0.4, -0.3, 0.5, 0.2],
    sliceMs: 10,
    sampleRate: 100,
  });
  assert.equal(envRes.success, true);
  assert.ok(Array.isArray(envRes.data.envelope));
});
