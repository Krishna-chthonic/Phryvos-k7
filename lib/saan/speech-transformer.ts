/**
 * Speech Transformer: Math, Chemistry, Prices & Markdown Stream Segmenter (from moeru-ai/airi)
 *
 * Implements:
 * 1. Spoken Math normalizer: converts LaTeX equations into natural conversational prose for TTS.
 * 2. Spoken Chemistry normalizer: converts mhchem (\ce{...}) formulas into natural spoken words.
 * 3. Price & Currency escaper: prevents LaTeX math parsers from breaking on price strings ($5 vs $x^2$).
 * 4. MarkdownSegmenter: streaming audio segmenter ensuring whole sentences and closed formulas before TTS.
 */

// Greek letter dictionary
const GREEK_MAP: Record<string, string> = {
  alpha: "alpha",
  beta: "beta",
  gamma: "gamma",
  delta: "delta",
  epsilon: "epsilon",
  theta: "theta",
  lambda: "lambda",
  mu: "mu",
  pi: "pi",
  sigma: "sigma",
  tau: "tau",
  phi: "phi",
  omega: "omega",
  Delta: "capital delta",
  Sigma: "capital sigma",
  Omega: "capital omega",
};

// Common math symbol dictionary
const SYMBOL_MAP: Record<string, string> = {
  "\\pm": "plus or minus",
  "\\neq": "is not equal to",
  "\\le": "is less than or equal to",
  "\\leq": "is less than or equal to",
  "\\ge": "is greater than or equal to",
  "\\geq": "is greater than or equal to",
  "\\approx": "is approximately",
  "\\times": "times",
  "\\cdot": "times",
  "\\div": "divided by",
  "\\infty": "infinity",
  "\\to": "approaches",
  "\\rightarrow": "approaches",
  "\\in": "in",
  "\\sum": "sum of",
  "\\int": "integral of",
};

// Common chemistry formula dictionary
const CHEM_MAP: Record<string, string> = {
  H2O: "water",
  CO2: "carbon dioxide",
  O2: "oxygen",
  H2: "hydrogen",
  N2: "nitrogen",
  NaCl: "sodium chloride",
  HCl: "hydrochloric acid",
  CH4: "methane",
  NH3: "ammonia",
  H2SO4: "sulfuric acid",
  C6H12O6: "glucose",
};

/**
 * Escapes the `$` of a currency price outside code blocks so math parsers do not greedily pair it.
 * e.g. "$5, and the area is $x^2$" -> "\\$5, and the area is $x^2$"
 */
export function escapePrices(text: string): string {
  // Matches dollar amounts like $5, $19.99, $1,200 followed by punctuation, whitespace, or word boundary
  const priceRegex = /\$(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?=[\s,.;:!?)\]]|$)/gu;
  return text.replace(priceRegex, (match) => `\\${match}`);
}

/**
 * Transforms LaTeX math equations into natural spoken prose.
 */
export function transformMathToSpeech(latex: string): string {
  let s = latex.trim();

  // Strip outer math delimiters ($...$, $$...$$, \(...\), \[...\])
  s = s.replace(/^\$\$([\s\S]*)\$\$$/, "$1");
  s = s.replace(/^\$([\s\S]*)\$$/, "$1");
  s = s.replace(/^\\\[([\s\S]*)\\\]$/, "$1");
  s = s.replace(/^\\\(([\s\S]*)\\\)$/, "$1");
  s = s.trim();

  // 1. Fractions: \frac{a}{b} -> "a over b"
  while (/\\frac\{([^{}]+)\}\{([^{}]+)\}/.test(s)) {
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      return `${transformMathToSpeech(num)} over ${transformMathToSpeech(den)}`;
    });
  }

  // 2. Square Roots: \sqrt[n]{x} -> "nth root of x", \sqrt{x} -> "square root of x"
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, (_, deg, val) => {
    return `${deg}th root of ${transformMathToSpeech(val)}`;
  });
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, (_, val) => {
    return `square root of ${transformMathToSpeech(val)}`;
  });

  // 3. Powers / Exponents: x^2 -> "x squared", x^3 -> "x cubed", x^n -> "x to the power of n"
  s = s.replace(/([a-zA-Z0-9_\(\)]+)\^2(?![0-9])/g, "$1 squared");
  s = s.replace(/([a-zA-Z0-9_\(\)]+)\^3(?![0-9])/g, "$1 cubed");
  s = s.replace(/([a-zA-Z0-9_\(\)]+)\^\{([^{}]+)\}/g, (_, base, exp) => {
    return `${base} to the power of ${transformMathToSpeech(exp)}`;
  });
  s = s.replace(/([a-zA-Z0-9_\(\)]+)\^([a-zA-Z0-9]+)/g, (_, base, exp) => {
    return `${base} to the power of ${exp}`;
  });

  // 4. Subscripts: x_i -> "x sub i", x_{min} -> "x sub min"
  s = s.replace(/([a-zA-Z0-9]+)_\{([^{}]+)\}/g, "$1 sub $2");
  s = s.replace(/([a-zA-Z0-9]+)_([a-zA-Z0-9])/g, "$1 sub $2");

  // 5. Greek letters
  for (const [key, word] of Object.entries(GREEK_MAP)) {
    const re = new RegExp(`\\\\${key}\\b`, "g");
    s = s.replace(re, word);
  }

  // 6. Common math symbols
  for (const [sym, word] of Object.entries(SYMBOL_MAP)) {
    s = s.split(sym).join(` ${word} `);
  }

  // 7. Operators and cleanups
  s = s.replace(/\\left\(/g, "(").replace(/\\right\)/g, ")");
  s = s.replace(/\\left\[/g, "[").replace(/\\right\]/g, "]");
  s = s.replace(/\\left\\\{/g, "{").replace(/\\right\\\}/g, "}");
  s = s.replace(/\\text\{([^{}]+)\}/g, "$1");
  s = s.replace(/\\quad/g, " ").replace(/\\qquad/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Transforms Chemistry mhchem expressions into natural spoken words.
 * e.g. \ce{2H2 + O2 -> 2H2O} -> "2 H 2 plus O 2 yields 2 H 2 O"
 */
export function transformChemToSpeech(chemExpr: string): string {
  let s = chemExpr.replace(/^\\ce\{/, "").replace(/\}$/, "").trim();

  // Known direct molecules
  if (CHEM_MAP[s]) {
    return CHEM_MAP[s];
  }

  // Reaction arrows
  s = s.replace(/->/g, " yields ");
  s = s.replace(/<->/g, " in equilibrium with ");
  s = s.replace(/\+/g, " plus ");

  // Expand formula numbers: H2O -> H two O
  s = s.replace(/([A-Z][a-z]?)(\d+)/g, "$1 $2");

  return s.replace(/\s+/g, " ").trim();
}

/**
 * Full Text-to-Speech Preprocessor:
 * Translates inline LaTeX math ($...$, $$...$$) and chemistry (\ce{...}) formulas
 * in a markdown string into clean spoken English prose for TTS synthesis.
 */
export function toNaturalSpeechText(text: string): string {
  if (!text) return "";

  // 1. Disambiguate price dollar signs first
  let processed = escapePrices(text);

  // 2. Chemistry formulas: \ce{...}
  processed = processed.replace(/\\ce\{([^{}]+)\}/g, (_, formula) => {
    return ` ${transformChemToSpeech(formula)} `;
  });

  // 3. Display Math: $$...$$ or \[...\]
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    return ` ${transformMathToSpeech(math)} `;
  });
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    return ` ${transformMathToSpeech(math)} `;
  });

  // 4. Inline Math: $...$ or \(...\)
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    return ` ${transformMathToSpeech(math)} `;
  });
  processed = processed.replace(/\\\(([^\$\n]+?)\\\)/g, (_, math) => {
    return ` ${transformMathToSpeech(math)} `;
  });

  // 4b. Bare LaTeX macros and powers without explicit delimiters
  processed = transformMathToSpeech(processed);

  // 5. Convert currency amounts to natural spoken form (e.g. $25 -> 25 dollars, \$5.99 -> 5.99 dollars)
  processed = processed.replace(/(?:\\\$|\$)(\d+(?:\.\d+)?)/g, "$1 dollars");

  // 6. Clean up markdown formatting for TTS (remove bold/italic asterisks, backticks, hashes)
  processed = processed.replace(/```[\s\S]*?```/g, " "); // skip code blocks in speech
  processed = processed.replace(/`([^`]+)`/g, "$1");
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "$1");
  processed = processed.replace(/\*([^*]+)\*/g, "$1");
  processed = processed.replace(/^#+\s+/gm, "");
  processed = processed.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"); // link text only

  return processed.replace(/\s+/g, " ").trim();
}

/**
 * MarkdownSegmenter (from Airi core-agent):
 * Splits streamed markdown into complete sentences, waiting until open math, code blocks,
 * or links are closed before emitting an audio segment.
 */
export class MarkdownSegmenter {
  private buffer = "";

  /**
   * Pushes incoming text chunk from LLM stream.
   * Returns newly completed sentences that are ready for audio synthesis.
   */
  push(text: string): string[] {
    this.buffer += text;
    const completedSegments: string[] = [];

    while (this.buffer.length > 0) {
      const splitIdx = this.findSafeSplitPoint(this.buffer);
      if (splitIdx <= 0) break;

      const sentence = this.buffer.slice(0, splitIdx).trim();
      this.buffer = this.buffer.slice(splitIdx);
      if (sentence.length > 0) {
        completedSegments.push(sentence);
      }
    }

    return completedSegments;
  }

  /**
   * Alias for push.
   */
  feed(text: string): string[] {
    return this.push(text);
  }

  /**
   * Flushes any remaining text when LLM stream finishes.
   */
  end(): string[] {
    const remaining = this.buffer.trim();
    this.buffer = "";
    return remaining.length > 0 ? [remaining] : [];
  }

  /**
   * Alias for end.
   */
  flush(): string[] {
    return this.end();
  }

  /**
   * Locates the first safe sentence punctuation where no code or math blocks are open.
   */
  private findSafeSplitPoint(str: string): number {
    let inFence = false;
    let inInlineCode = false;
    let inMath = false;

    for (let i = 0; i < str.length; i++) {
      // Check for triple backtick code fence
      if (str.startsWith("```", i)) {
        inFence = !inFence;
        i += 2;
        continue;
      }

      // Check for single inline code backtick (outside fence)
      if (str[i] === "`" && !inFence) {
        inInlineCode = !inInlineCode;
        continue;
      }

      // Math dollar toggle
      if (str[i] === "$" && (i === 0 || str[i - 1] !== "\\") && !inFence && !inInlineCode) {
        inMath = !inMath;
        continue;
      }

      // If inside code or math, do not split
      if (inFence || inInlineCode || inMath) continue;

      // Sentence boundaries: . ! ? followed by space, newline, or end
      const char = str[i];
      if (char === "." || char === "!" || char === "?" || char === "。" || char === "！" || char === "？") {
        const nextChar = str[i + 1];
        if (!nextChar || /\s/.test(nextChar)) {
          return i + 1;
        }
      }
    }

    return -1;
  }
}
