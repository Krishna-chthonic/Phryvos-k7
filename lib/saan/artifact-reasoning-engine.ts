/**
 * @file artifact-reasoning-engine.ts
 * @description Clean-room TypeScript adaptation of LibreChat's modular artifact
 * extraction pane and HuggingFace Chat-UI's expandable reasoning accordions.
 * Inspired by LibreChat-AI/LibreChat (8d3da9b) and huggingface/chat-ui (eda15a0).
 */

export interface ParsedArtifact {
  id: string;
  identifier: string;
  title: string;
  type: 'code' | 'mermaid' | 'html' | 'markdown' | 'table' | 'unknown';
  mimeType: string;
  language?: string;
  content: string;
  filename: string;
}

export interface ReasoningParseResult {
  hasReasoning: boolean;
  reasoning: string;
  cleanedAnswer: string;
}

export interface CitationChip {
  url: string;
  domain: string;
  title?: string;
  index: number;
}

export class ArtifactReasoningEngine {
  /**
   * Separates <think>...</think> or <thought>...</thought> CoT reasoning
   * blocks from the final user-facing response.
   */
  public extractReasoning(text: string): ReasoningParseResult {
    if (!text || typeof text !== 'string') {
      return { hasReasoning: false, reasoning: '', cleanedAnswer: '' };
    }

    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i) ||
                       text.match(/<thought>([\s\S]*?)<\/thought>/i);

    if (thinkMatch) {
      const reasoning = thinkMatch[1].trim();
      const cleaned = text.replace(thinkMatch[0], '').trim();
      return {
        hasReasoning: true,
        reasoning,
        cleanedAnswer: cleaned,
      };
    }

    return {
      hasReasoning: false,
      reasoning: '',
      cleanedAnswer: text.trim(),
    };
  }

  /**
   * Extracts structured interactive artifacts from response content.
   * Supports XML style `<artifact ...>...</artifact>` and standard markdown code fences.
   */
  public extractArtifacts(text: string): ParsedArtifact[] {
    if (!text || typeof text !== 'string') return [];

    const artifacts: ParsedArtifact[] = [];
    const artifactRegex = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/gi;

    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = artifactRegex.exec(text)) !== null) {
      idx++;
      const attrsRaw = match[1];
      const content = match[2].trim();

      const identifier = this.extractAttr(attrsRaw, 'identifier') || `artifact-${idx}`;
      const title = this.extractAttr(attrsRaw, 'title') || `Artifact ${idx}`;
      const typeRaw = (this.extractAttr(attrsRaw, 'type') || '').toLowerCase();
      const language = this.extractAttr(attrsRaw, 'language') || undefined;

      let type: ParsedArtifact['type'] = 'code';
      let mimeType = 'text/plain';
      let ext = 'txt';

      if (typeRaw.includes('mermaid') || language === 'mermaid') {
        type = 'mermaid';
        mimeType = 'application/vnd.mermaid';
        ext = 'mmd';
      } else if (typeRaw.includes('html') || language === 'html') {
        type = 'html';
        mimeType = 'text/html';
        ext = 'html';
      } else if (typeRaw.includes('markdown') || language === 'markdown' || language === 'md') {
        type = 'markdown';
        mimeType = 'text/markdown';
        ext = 'md';
      } else if (language) {
        type = 'code';
        mimeType = 'text/x-code';
        ext = language === 'typescript' || language === 'ts' ? 'ts'
            : language === 'javascript' || language === 'js' ? 'js'
            : language === 'python' || language === 'py' ? 'py'
            : 'txt';
      }

      artifacts.push({
        id: `art_${Date.now()}_${idx}`,
        identifier,
        title,
        type,
        mimeType,
        language,
        content,
        filename: `${identifier}.${ext}`,
      });
    }

    // Fallback: If no explicit XML <artifact> tags, extract prominent markdown code blocks
    if (artifacts.length === 0) {
      const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
      let codeMatch: RegExpExecArray | null;
      let codeIdx = 0;

      while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
        codeIdx++;
        const lang = (codeMatch[1] || 'text').toLowerCase();
        const codeContent = codeMatch[2].trim();

        if (codeContent.length > 20) {
          let type: ParsedArtifact['type'] = 'code';
          let mime = 'text/x-code';
          let ext = lang;

          if (lang === 'mermaid') {
            type = 'mermaid';
            mime = 'application/vnd.mermaid';
            ext = 'mmd';
          } else if (lang === 'html') {
            type = 'html';
            mime = 'text/html';
          } else if (lang === 'markdown' || lang === 'md') {
            type = 'markdown';
            mime = 'text/markdown';
            ext = 'md';
          }

          artifacts.push({
            id: `art_code_${codeIdx}`,
            identifier: `snippet-${codeIdx}`,
            title: `${lang.toUpperCase()} Snippet #${codeIdx}`,
            type,
            mimeType: mime,
            language: lang,
            content: codeContent,
            filename: `snippet-${codeIdx}.${ext}`,
          });
        }
      }
    }

    return artifacts;
  }

  /**
   * Extracts web source URLs and formats clickable citation chips.
   */
  public extractCitations(text: string): CitationChip[] {
    if (!text || typeof text !== 'string') return [];

    const urlRegex = /https?:\/\/[^\s)\]>"']+/gi;
    const matches = text.match(urlRegex) || [];
    const seen = new Set<string>();
    const chips: CitationChip[] = [];

    for (const url of matches) {
      // Clean trailing punctuation
      const cleanUrl = url.replace(/[.,;:!?]+$/, '');
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);

      try {
        const parsed = new URL(cleanUrl);
        chips.push({
          url: cleanUrl,
          domain: parsed.hostname.replace(/^www\./, ''),
          index: chips.length + 1,
        });
      } catch {
        // Skip invalid URLs
      }
    }

    return chips;
  }

  private extractAttr(attrString: string, attrName: string): string | null {
    const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i');
    const match = attrString.match(regex);
    return match ? match[1] : null;
  }
}

export const globalArtifactReasoningEngine = new ArtifactReasoningEngine();

