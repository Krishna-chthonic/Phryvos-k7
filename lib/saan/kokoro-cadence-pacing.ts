/**
 * @file kokoro-cadence-pacing.ts
 * @description Clean-room TypeScript adaptation of Kokoro's text splitting,
 * nesting-stack quote tracking, punctuation cadence, and circadian speech pacing.
 * Inspired by hexgrad/kokoro (dfb907a).
 */

const SENTENCE_TERMINATORS = new Set(['.', '!', '?', '…', '。', '？', '！', '\n']);
const TRAILING_CHARS = new Set(['"', "'", ')', ']', '}', '」', '』', '”', '’']);

const MATCHING_PAIRS = new Map<string, string>([
  [')', '('],
  [']', '['],
  ['}', '{'],
  ['」', '「'],
  ['』', '『'],
  ['”', '“'],
  ['’', '‘'],
  ['》', '《'],
  ['〉', '〈'],
]);

const OPENING_CHARS = new Set(MATCHING_PAIRS.values());

const COMMON_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'sgt', 'col', 'gen', 'rep',
  'sen', 'gov', 'lt', 'maj', 'capt', 'st', 'mt', 'etc', 'co', 'inc', 'ltd',
  'dept', 'vs', 'p', 'pg', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug',
  'sep', 'sept', 'oct', 'nov', 'dec', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
]);

export interface CadenceSettings {
  speed: number;
  periodPauseMs: number;
  commaPauseMs: number;
  tone: 'energetic' | 'focused' | 'warm' | 'gentle';
  timeSlot: 'morning' | 'day' | 'evening' | 'night';
}

export class KokoroTextSplitter {
  /**
   * Splits text into coherent sentences using an AST nesting stack to prevent
   * accidental splits inside quotes, brackets, abbreviations, or numbers.
   */
  public split(text: string): string[] {
    if (!text || typeof text !== 'string') return [];

    const buffer = text;
    const len = buffer.length;
    const sentences: string[] = [];
    const stack: string[] = [];

    let sentenceStart = 0;
    let i = 0;

    const scanBoundary = (start: number): { end: number; nextNonSpace: number } => {
      let end = start;
      while (end + 1 < len && TRAILING_CHARS.has(buffer[end + 1])) {
        ++end;
      }
      let nextNonSpace = end + 1;
      while (nextNonSpace < len && /\s/.test(buffer[nextNonSpace])) {
        ++nextNonSpace;
      }
      return { end, nextNonSpace };
    };

    while (i < len) {
      const c = buffer[i];

      // Update quote & bracket stack
      if (c === '"' || c === "'") {
        // Ignore apostrophe between letters (contractions like don't, it's)
        const isContraction =
          c === "'" &&
          i > 0 &&
          i < len - 1 &&
          /[A-Za-z]/.test(buffer[i - 1]) &&
          /[A-Za-z]/.test(buffer[i + 1]);

        if (!isContraction) {
          if (stack.length && stack[stack.length - 1] === c) {
            stack.pop();
          } else {
            stack.push(c);
          }
        }
      } else if (OPENING_CHARS.has(c)) {
        stack.push(c);
      } else if (MATCHING_PAIRS.has(c)) {
        const expected = MATCHING_PAIRS.get(c);
        if (stack.length && stack[stack.length - 1] === expected) {
          stack.pop();
        }
      }

      // Check for sentence boundary when outside any nested quote or bracket
      if (stack.length === 0 && SENTENCE_TERMINATORS.has(c)) {
        const currentSegment = buffer.slice(sentenceStart, i);

        // Skip numbered list markers (e.g. "1." or "\n2.")
        if (/(^|\n)\d+$/.test(currentSegment)) {
          ++i;
          continue;
        }

        const { end: boundaryEnd, nextNonSpace } = scanBoundary(i);

        // Float or currency check: if no space after dot (e.g. "$9.99"), skip
        if (i === nextNonSpace - 1 && c !== '\n') {
          ++i;
          continue;
        }

        // Determine token preceding terminator
        let tokenStart = i - 1;
        while (tokenStart >= 0 && /\S/.test(buffer[tokenStart])) {
          tokenStart--;
        }
        tokenStart = Math.max(sentenceStart, tokenStart + 1);
        const token = buffer.substring(tokenStart, i).toLowerCase().replace(/['’]s$/i, '').replace(/\.+$/, '');

        // Abbreviation check
        if (COMMON_ABBREVIATIONS.has(token)) {
          ++i;
          continue;
        }

        // URL or email check
        const rawToken = buffer.substring(tokenStart, i);
        if (/https?[,:]\/\//.test(rawToken) || rawToken.includes('@')) {
          ++i;
          continue;
        }

        // Lookahead check: if period followed by lowercase letter, not a sentence end
        if (c === '.' && nextNonSpace < len && /[a-z]/.test(buffer[nextNonSpace])) {
          ++i;
          continue;
        }

        // Valid sentence boundary
        const sentence = buffer.substring(sentenceStart, boundaryEnd + 1).trim();
        if (sentence && sentence !== '...' && sentence !== '…') {
          sentences.push(sentence);
        }

        i = boundaryEnd + 1;
        sentenceStart = i;
        continue;
      }

      ++i;
    }

    // Trailing remnant
    const remainder = buffer.substring(sentenceStart).trim();
    if (remainder.length > 0) {
      sentences.push(remainder);
    }

    return sentences;
  }
}

export class CircadianCadenceEngine {
  private splitter = new KokoroTextSplitter();

  /**
   * Computes human-like conversational cadence and prosodic pacing
   * based on user's circadian cycle (hour 0-23).
   */
  public getCadenceSettings(hourOfDay?: number): CadenceSettings {
    const hour = hourOfDay !== undefined ? hourOfDay : new Date().getHours();

    if (hour >= 5 && hour < 9) {
      // Early morning / Dawn: alert, crisp, fast pacing
      return {
        speed: 1.10,
        periodPauseMs: 180,
        commaPauseMs: 80,
        tone: 'energetic',
        timeSlot: 'morning',
      };
    } else if (hour >= 9 && hour < 18) {
      // Workday / Daytime: neutral, focused, standard pace
      return {
        speed: 1.00,
        periodPauseMs: 240,
        commaPauseMs: 110,
        tone: 'focused',
        timeSlot: 'day',
      };
    } else if (hour >= 18 && hour < 22) {
      // Evening / Wind-Down: warm, reflective, slightly relaxed pace
      return {
        speed: 0.95,
        periodPauseMs: 360,
        commaPauseMs: 160,
        tone: 'warm',
        timeSlot: 'evening',
      };
    } else {
      // Late night / Sleep window: soft, gentle, hushed whisper pace
      return {
        speed: 0.88,
        periodPauseMs: 500,
        commaPauseMs: 220,
        tone: 'gentle',
        timeSlot: 'night',
      };
    }
  }

  /**
   * Evaluates text segments with circadian cadence annotations.
   */
  public paceText(text: string, hourOfDay?: number) {
    const settings = this.getCadenceSettings(hourOfDay);
    const sentences = this.splitter.split(text);

    return {
      settings,
      sentenceCount: sentences.length,
      sentences: sentences.map((s, idx) => ({
        index: idx,
        text: s,
        pauseAfterMs: idx === sentences.length - 1 ? 0 : settings.periodPauseMs,
        speed: settings.speed,
      })),
    };
  }
}
