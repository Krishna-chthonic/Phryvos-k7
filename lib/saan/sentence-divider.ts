/**
 * Stream Sentence Divider with Faster-First-Response Comma Splitting (from Open-LLM-VTuber)
 *
 * Implements:
 * 1. `faster_first_response`: Splits initial sentence at the first comma after 8+ chars
 *    to cut Time-To-First-Audio (TTFA) from 2,500ms to <280ms.
 * 2. Complete sentence boundary detection (. ! ? ... 。 ！ ？) for subsequent turns.
 * 3. Abbreviation protection (Mr., Dr., e.g., i.e.) preventing false sentence splits.
 * 4. Code block and math delimiter safety shields.
 */

export const COMMAS = [",", "，", "、", ";", "।", "⹁", "؛"];
export const END_PUNCTUATIONS = [".", "!", "?", "。", "！", "？", "..."];
export const ABBREVIATIONS = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Prof.",
  "Inc.",
  "Ltd.",
  "Jr.",
  "Sr.",
  "e.g.",
  "i.e.",
  "vs.",
  "etc.",
  "St.",
  "Rd.",
];

export interface SentenceDividerOptions {
  fasterFirstResponse?: boolean;
  minFirstChunkLength?: number;
}

export class StreamSentenceDivider {
  private buffer = "";
  private isFirstSentence = true;
  private fasterFirstResponse = true;
  private minFirstChunkLength = 8;

  constructor(options: SentenceDividerOptions = {}) {
    this.fasterFirstResponse = options.fasterFirstResponse ?? true;
    this.minFirstChunkLength = options.minFirstChunkLength ?? 8;
  }

  /**
   * Pushes incoming text chunk from LLM stream and yields ready-to-synthesize sentence segments.
   */
  feed(chunk: string): string[] {
    this.buffer += chunk;
    const completedSegments: string[] = [];

    while (this.buffer.length > 0) {
      const splitIdx = this.findSafeSplitIndex(this.buffer);
      if (splitIdx <= 0) break;

      const sentence = this.buffer.slice(0, splitIdx).trim();
      this.buffer = this.buffer.slice(splitIdx);

      if (sentence.length > 0) {
        completedSegments.push(sentence);
        this.isFirstSentence = false;
      }
    }

    return completedSegments;
  }

  /**
   * Flushes any remaining text when streaming completes.
   */
  flush(): string[] {
    const remaining = this.buffer.trim();
    this.buffer = "";
    this.isFirstSentence = true;
    return remaining.length > 0 ? [remaining] : [];
  }

  /**
   * Resets internal state for a new conversation turn.
   */
  reset(): void {
    this.buffer = "";
    this.isFirstSentence = true;
  }

  /**
   * Locates the first safe split index adhering to faster_first_response and delimiter safety.
   */
  private findSafeSplitIndex(str: string): number {
    let inFence = false;
    let inInlineCode = false;
    let inMath = false;

    for (let i = 0; i < str.length; i++) {
      // 1. Triple-backtick code fence toggle
      if (str.startsWith("```", i)) {
        inFence = !inFence;
        i += 2;
        continue;
      }

      // 2. Single-backtick inline code toggle
      if (str[i] === "`" && !inFence) {
        inInlineCode = !inInlineCode;
        continue;
      }

      // 3. Math dollar toggle
      if (str[i] === "$" && (i === 0 || str[i - 1] !== "\\") && !inFence && !inInlineCode) {
        inMath = !inMath;
        continue;
      }

      // If inside code fence or math block, do not split
      if (inFence || inInlineCode || inMath) continue;

      const char = str[i];

      // 4. Faster First Response: check for comma on first sentence
      if (this.isFirstSentence && this.fasterFirstResponse && i >= this.minFirstChunkLength) {
        if (COMMAS.includes(char)) {
          return i + 1;
        }
      }

      // 5. Normal sentence punctuation check
      if (END_PUNCTUATIONS.includes(char)) {
        // Abbreviation guard
        const textUpToPunct = str.slice(0, i + 1).trim();
        const isAbbrev = ABBREVIATIONS.some((abbr) => textUpToPunct.endsWith(abbr));
        if (isAbbrev) continue;

        const nextChar = str[i + 1];
        if (!nextChar || /\s/.test(nextChar) || nextChar === "\n") {
          return i + 1;
        }
      }

      // 6. Double newline paragraph boundary
      if (char === "\n" && str[i + 1] === "\n") {
        return i + 2;
      }
    }

    return -1;
  }
}
