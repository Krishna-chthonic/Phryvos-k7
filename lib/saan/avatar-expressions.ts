/**
 * Live2D Avatar Embodiment & Expression Engine (from Open-LLM-VTuber live2d_model.py)
 *
 * Implements:
 * 1. 12 Discrete Emotional Expressions (joy, sadness, anger, blush, wink, smirk, thinking, etc.)
 * 2. 8 Physical Avatar Motions (nod, wave, shake_head, bow, laugh, tilt_head, sigh, stretch)
 * 3. Tag extraction & TTS keyword stripping ([joy], [nod])
 * 4. Interactive Touch HitAreas (HitAreaHead, HitAreaBody)
 */

export interface AvatarExpression {
  id: string;
  index: number;
  label: string;
  intensity: number; // 0.0 to 1.0
}

export interface AvatarMotion {
  name: string;
  group: string;
  durationMs: number;
}

export interface ExpressionExtractionResult {
  speech: string;
  expressions: string[];
  motions: string[];
  hasActions: boolean;
}

export interface TapReaction {
  hitArea: "head" | "body";
  motion: string;
  expression: string;
  dialogueHinglish: string;
  dialogueEnglish: string;
}

// Universal Live2D Emotion Map
export const DEFAULT_EMOTION_MAP: Record<string, number> = {
  neutral: 0,
  joy: 1,
  sadness: 2,
  anger: 3,
  surprise: 4,
  blush: 5,
  wink: 6,
  smirk: 7,
  thinking: 8,
  pout: 9,
  sleepy: 10,
  curious: 11,
};

// Universal Physical Motion Groups
export const DEFAULT_MOTION_MAP: Record<string, string> = {
  nod: "agree",
  shake_head: "disagree",
  wave: "greeting",
  tilt_head: "wondering",
  bow: "respect",
  laugh: "amused",
  sigh: "relief",
  stretch: "relax",
};

export class Live2dExpressionMapper {
  private emoMap: Record<string, number>;
  private motionMap: Record<string, string>;

  constructor(
    customEmoMap: Record<string, number> = DEFAULT_EMOTION_MAP,
    customMotionMap: Record<string, string> = DEFAULT_MOTION_MAP
  ) {
    this.emoMap = { ...customEmoMap };
    this.motionMap = { ...customMotionMap };
  }

  /**
   * Extracts [expression] and [motion] tokens from text, returning cleaned speech.
   */
  extract(rawText: string): ExpressionExtractionResult {
    if (!rawText || typeof rawText !== "string") {
      return { speech: "", expressions: [], motions: [], hasActions: false };
    }

    const expressions: string[] = [];
    const motions: string[] = [];
    let cleaned = rawText;

    // 1. Scan for emotion tokens: [joy], [blush], [wink], etc.
    for (const emo of Object.keys(this.emoMap)) {
      const tag = `[${emo}]`;
      const regex = new RegExp(`\\[${emo}\\]`, "gi");
      if (regex.test(cleaned)) {
        if (!expressions.includes(emo)) {
          expressions.push(emo);
        }
        cleaned = cleaned.replace(regex, "");
      }
    }

    // 2. Scan for physical motion tokens: [nod], [wave], [bow], etc.
    for (const motion of Object.keys(this.motionMap)) {
      const tag = `[${motion}]`;
      const regex = new RegExp(`\\[${motion}\\]`, "gi");
      if (regex.test(cleaned)) {
        if (!motions.includes(motion)) {
          motions.push(motion);
        }
        cleaned = cleaned.replace(regex, "");
      }
    }

    // Clean multiple spaces and trim
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

    return {
      speech: cleaned,
      expressions,
      motions,
      hasActions: expressions.length > 0 || motions.length > 0,
    };
  }

  /**
   * Strips all expression and motion keywords from text for TTS.
   */
  removeKeywords(text: string): string {
    return this.extract(text).speech;
  }

  /**
   * Maps emotion string to integer index used by Live2D models.
   */
  getExpressionIndex(emotion: string): number {
    const key = emotion.trim().toLowerCase();
    return this.emoMap[key] ?? this.emoMap.neutral ?? 0;
  }

  /**
   * Handles touch / click hit areas on the avatar.
   */
  handleTap(hitArea: "head" | "body"): TapReaction {
    if (hitArea === "head") {
      return {
        hitArea: "head",
        motion: "nod",
        expression: "blush",
        dialogueHinglish: "Arre! Aise achanak se sar mat thapthapao na, thoda blush ho jata hai...",
        dialogueEnglish: "Hey! Don't pat my head so suddenly, it makes me blush a bit...",
      };
    } else {
      return {
        hitArea: "body",
        motion: "tilt_head",
        expression: "curious",
        dialogueHinglish: "Haanji? Kuch kehna chahte ho ya bas poke kar rahe the?",
        dialogueEnglish: "Yes? Did you want to say something, or are you just poking me?",
      };
    }
  }

  /**
   * Generates prompt instructions for the system prompt.
   */
  getPromptSpec(): string {
    const emos = Object.keys(this.emoMap).map((k) => `[${k}]`).join(" ");
    const motions = Object.keys(this.motionMap).map((k) => `[${k}]`).join(" ");
    return `AVATAR EXPRESSIONS & PHYSICAL GESTURES (Open-LLM-VTuber pattern):
You can naturally embed facial expressions and body motions directly in your dialogue using square brackets:
Expressions: ${emos}
Motions: ${motions}
Example: "[joy] [wave] Hey there! [curious] Aaj kya plan hai?"`;
  }
}

// Global Singleton
export const globalAvatarMapper = new Live2dExpressionMapper();
