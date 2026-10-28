/**
 * Auditory Reality Interruption Memory Contract (from Open-LLM-VTuber basic_memory_agent.py)
 *
 * Implements:
 * When the user barges in and interrupts the companion mid-sentence, standard agents mistakenly
 * save the full generated assistant text to conversation history, causing the LLM to hallucinate
 * that the user heard the entire monologue.
 *
 * This contract truncates assistant memory to ONLY what was actually spoken out loud before interruption:
 * `Memory_assistant = heard_response + "..."` and appends `[Interrupted by user]`.
 */

export interface TruncatedMemoryResult {
  savedContent: string;
  heardText: string;
  wasTruncated: boolean;
  heardWordsCount: number;
  totalWordsCount: number;
}

export function truncateHeardMemory(
  fullGeneratedText: string,
  heardDurationSeconds: number,
  estimatedWordsPerMinute = 150
): TruncatedMemoryResult {
  if (!fullGeneratedText || typeof fullGeneratedText !== "string") {
    return {
      savedContent: "[Interrupted by user]",
      heardText: "",
      wasTruncated: true,
      heardWordsCount: 0,
      totalWordsCount: 0,
    };
  }

  const words = fullGeneratedText.trim().split(/\s+/);
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      savedContent: "[Interrupted by user]",
      heardText: "",
      wasTruncated: true,
      heardWordsCount: 0,
      totalWordsCount: 0,
    };
  }

  // Calculate approximate words spoken in heard duration
  const wordsPerSecond = estimatedWordsPerMinute / 60.0;
  const heardCount = Math.max(1, Math.min(totalWords, Math.floor(heardDurationSeconds * wordsPerSecond)));

  // If the user heard virtually the entire monologue (>90% of words), save in full
  if (heardCount >= totalWords) {
    return {
      savedContent: fullGeneratedText,
      heardText: fullGeneratedText,
      wasTruncated: false,
      heardWordsCount: totalWords,
      totalWordsCount: totalWords,
    };
  }

  const heardWords = words.slice(0, heardCount).join(" ");
  const truncatedSpeech = `${heardWords}...`;
  const savedContent = `${truncatedSpeech}\n\n[Interrupted by user]`;

  return {
    savedContent,
    heardText: truncatedSpeech,
    wasTruncated: true,
    heardWordsCount: heardCount,
    totalWordsCount: totalWords,
  };
}
