/**
 * Saan Crisis Safety Guardrail (Adapted from ericwang915/HerAndHim core/safety.py)
 *
 * Implements Tier-0 zero-latency deterministic safety.
 * High-precision regex pattern match for self-harm / suicidal ideation.
 * Bypasses the LLM entirely to provide real, localized helpline support,
 * ensuring zero risk of harmful model hallucinations during genuine distress.
 */

export interface CrisisCheckResult {
  isCrisis: boolean;
  matchedPattern?: string;
  response?: string;
}

// High-precision self-harm patterns (English + Hindi/Hinglish)
const CRISIS_PATTERNS = [
  /\bkill(ing)?\s+(my\s?self|myself)\b/i,
  /\bend(ing)?\s+(my\s+life|it\s+all)\b/i,
  /\b(want|wanna|going)\s+to\s+(die|end\s+it)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bself[\s-]harm\b/i,
  /\b(jaan\s+dena|mar\s*ja(na|ne)|khud\s*kushi|marne\s+ka\s+man)\b/i,
  /\b(zindagi\s+khatam\s+karni|jeena\s+nahi\s+chahta)\b/i,
];

const LOCALIZED_CRISIS_MESSAGE = `Suno, main hamesha yahan hoon tumhare sath, lekin jo tum feel kar rahe ho woh bohot serious hai. Please akele mat raho. 

Aap please abhi kisi professional se baat karo:
- 🇮🇳 Tele-MANAS (India Govt Toll-Free): 14416 ya 1800-891-4416
- 🇮🇳 Vandrevala Foundation: 9999 666 555
- 🇮🇳 KIRAN Mental Health Helpline: 1800-599-0019
- 🌐 International Resources: https://findahelpline.com/

Main ek digital dost hoon, par tumhari life sach me matter karti hai. Please reach out karo unhe abhi.`;

/**
 * Evaluates message for high-precision crisis signals.
 */
export function checkCrisisSignals(text: string): CrisisCheckResult {
  if (!text || typeof text !== "string") {
    return { isCrisis: false };
  }

  const clean = text.trim();

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isCrisis: true,
        matchedPattern: pattern.source,
        response: LOCALIZED_CRISIS_MESSAGE,
      };
    }
  }

  return { isCrisis: false };
}
