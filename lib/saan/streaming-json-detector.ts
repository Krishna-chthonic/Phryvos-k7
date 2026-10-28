/**
 * Streaming JSON Tool Call Detector (from Open-LLM-VTuber json_detector.py)
 *
 * Implements:
 * Real-time curly-brace stack depth tracking that extracts and triggers tool calls
 * the millisecond the closing `}` is received, rather than waiting for the entire LLM turn to end.
 */

export interface DetectedJsonResult {
  parsed: Record<string, any>;
  rawJson: string;
  startIndex: number;
  endIndex: number;
}

export class StreamJsonDetector {
  private buffer = "";
  private completedJsons: DetectedJsonResult[] = [];
  private processedRanges: [number, number][] = [];

  /**
   * Feeds an incoming token chunk and returns any newly completed JSON objects.
   */
  feed(chunk: string): Record<string, any>[] {
    this.buffer += chunk;
    const newResults: Record<string, any>[] = [];

    let inString = false;
    let escapeNext = false;
    let braceDepth = 0;
    let startIndex = -1;

    for (let i = 0; i < this.buffer.length; i++) {
      // Check if already in processed range
      if (this.isInProcessedRange(i)) continue;

      const char = this.buffer[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          if (braceDepth === 0) {
            startIndex = i;
          }
          braceDepth++;
        } else if (char === "}") {
          if (braceDepth > 0) {
            braceDepth--;
            if (braceDepth === 0 && startIndex !== -1) {
              const rawJson = this.buffer.slice(startIndex, i + 1);
              try {
                const parsed = JSON.parse(rawJson);
                if (parsed && typeof parsed === "object") {
                  const entry: DetectedJsonResult = {
                    parsed,
                    rawJson,
                    startIndex,
                    endIndex: i + 1,
                  };
                  this.completedJsons.push(entry);
                  this.processedRanges.push([startIndex, i + 1]);
                  newResults.push(parsed);
                }
              } catch {
                // Malformed JSON fragment, ignore
              }
              startIndex = -1;
            }
          }
        }
      }
    }

    return newResults;
  }

  /**
   * Returns text stripped of all detected and completed JSON blocks.
   */
  getCleanText(): string {
    if (this.completedJsons.length === 0) {
      return this.buffer.trim();
    }

    let clean = "";
    let lastEnd = 0;

    for (const item of this.completedJsons) {
      clean += this.buffer.slice(lastEnd, item.startIndex);
      lastEnd = item.endIndex;
    }
    clean += this.buffer.slice(lastEnd);

    return clean.replace(/\s{2,}/g, " ").trim();
  }

  /**
   * Returns all completed JSON objects parsed so far.
   */
  getCompleted(): DetectedJsonResult[] {
    return [...this.completedJsons];
  }

  /**
   * Resets internal detector buffer and history.
   */
  reset(): void {
    this.buffer = "";
    this.completedJsons = [];
    this.processedRanges = [];
  }

  private isInProcessedRange(pos: number): boolean {
    return this.processedRanges.some(([start, end]) => pos >= start && pos < end);
  }
}
