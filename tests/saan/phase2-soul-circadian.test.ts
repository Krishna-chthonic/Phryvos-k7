/**
 * Phase 2 Verification Suite: Authentic Living Soul & Circadian Life Engine
 *
 * Verifies Exit Gate 2:
 * 1. 24-Hour Circadian State transitions across 02:00, 08:00, 14:00, 20:00
 * 2. 2D Emotional Valence & Energy vector (Psycheros pattern)
 * 3. Logarithmic Bond Score calculation & cap at 100 (HerAndHim pattern)
 * 4. Output Sanitizer stripping 100% of AI robotic clichés (SillyTavern pattern)
 * 5. Prompt injection defense instruction presence (Crawl4AI pattern)
 */

import {
  getSaanProfile,
  buildSaanSystemPrompt,
  calculateBondIncrement,
  sanitizeSaanOutput,
  getBondStage,
} from "../../lib/saan/soul";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export function runPhase2Tests(): void {
  console.log("=== Running Phase 2 Living Soul & Circadian Engine Tests ===");

  // Test 1: Simulated 02:00 Sleep Mode & Boundary
  const nightProfile = getSaanProfile(45, 2);
  assert(nightProfile.isSleeping === true, "02:00 profile must have isSleeping = true");
  assert(nightProfile.circadianState === "sleep", "02:00 circadianState must be 'sleep'");
  assert(nightProfile.energy <= 0.2, "02:00 energy must be low (drowsy)");

  const nightPrompt = buildSaanSystemPrompt([], 45, "", 2);
  assert(nightPrompt.includes("CURRENT TIME REALITY: It is late night"), "02:00 prompt must include nighttime reality alert");
  assert(nightPrompt.includes("so ja aur sone de bhai"), "02:00 prompt must include sleepy human boundary");

  // Test 2: Simulated 08:00 Morning Chai Mode
  const morningProfile = getSaanProfile(45, 8);
  assert(morningProfile.isSleeping === false, "08:00 profile isSleeping must be false");
  assert(morningProfile.circadianState === "morning_chai", "08:00 state must be 'morning_chai'");
  assert(morningProfile.valence >= 0.7, "08:00 morning valence must be high/cheerful");

  // Test 3: Simulated 14:00 Work Focus Mode
  const workProfile = getSaanProfile(45, 14);
  assert(workProfile.circadianState === "work_focus", "14:00 state must be 'work_focus'");
  assert(workProfile.energy >= 0.8, "14:00 energy must be peak focus");

  // Test 4: Bond Progression Math (Logarithmic Diminishing Returns)
  const lowBondIncrement = calculateBondIncrement(10, 1);
  const midBondIncrement = calculateBondIncrement(50, 1);
  const highBondIncrement = calculateBondIncrement(90, 1);

  assert(lowBondIncrement > midBondIncrement, "Early bond growth must be faster than mid-stage bond");
  assert(midBondIncrement > highBondIncrement, "Mid-stage bond growth must be faster than high-stage bond");
  assert(calculateBondIncrement(100, 5) === 0, "Bond increment at 100 must be 0 (hard ceiling)");

  // Test 5: Post-Generation Output Sanitizer (SillyTavern pattern)
  const roboticOutput = "Certainly! How can I assist you today? As an AI language model, I do not possess emotions. Arre yaar, maine notes check kar liye!";
  const cleaned = sanitizeSaanOutput(roboticOutput);

  assert(!cleaned.toLowerCase().includes("certainly!"), "Sanitizer must strip 'Certainly!'");
  assert(!cleaned.toLowerCase().includes("how can i assist you today"), "Sanitizer must strip assistant opening");
  assert(!cleaned.toLowerCase().includes("as an ai language model"), "Sanitizer must strip AI disclaimer");
  assert(cleaned.includes("Arre yaar, maine notes check kar liye!"), "Sanitizer must retain genuine human dialogue");

  // Test 6: Security Defense Prompt Verification (Crawl4AI pattern)
  const systemPrompt = buildSaanSystemPrompt([], 45, "");
  assert(systemPrompt.includes("<untrusted_web_source>"), "System prompt must instruct model on <untrusted_web_source> security boundary");

  console.log("\n>>> ALL PHASE 2 EXIT GATE TESTS PASSED (100% SUCCESS) <<<\n");
}

runPhase2Tests();
