/**
 * @file document-collector-vault.ts
 * @description Clean-room TypeScript adaptation of Anything-LLM's document collector,
 * metadata sanitization, and semantic text chunking.
 * Inspired by Mintplex-Labs/anything-llm (0941fb0).
 */

export interface DocumentMetadata {
  title: string;
  url?: string;
  docAuthor?: string;
  description?: string;
  docSource?: string;
  chunkSource?: string;
  published?: string | number | null;
}

export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  wordCount: number;
  tokenCountEstimate: number;
}

export interface IngestedDocument {
  id: string;
  title: string;
  url: string;
  docAuthor: string;
  description: string;
  docSource: string;
  chunkSource: string;
  published: string;
  wordCount: number;
  tokenCountEstimate: number;
  chunks: DocumentChunk[];
}

export class DocumentCollector {
  /**
   * Slugifies strings into safe ASCII identifiers.
   */
  public slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Normalizes published metadata safely avoiding 1970 epoch fallback bugs on falsy values.
   */
  public normalizePublishedDate(val?: string | number | null): string {
    if (val === null || val === undefined || typeof val === 'boolean' || `${val}`.trim() === '') {
      return new Date().toISOString();
    }

    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    const parsed = new Date(String(val));
    if (!isNaN(parsed.getTime())) return parsed.toISOString();

    return new Date().toISOString();
  }

  /**
   * Ingests and normalizes raw text documents and splits into searchable chunks.
   */
  public processRawText(
    textContent: string,
    metadata: DocumentMetadata,
    options: { maxChunkWords?: number } = {}
  ): IngestedDocument {
    if (!textContent || typeof textContent !== 'string') {
      throw new Error('textContent must be a non-empty string');
    }

    const title = metadata?.title || 'Untitled Document';
    const slug = this.slugify(title);
    const id = `doc_${slug}_${Date.now()}`;

    // Normalize metadata
    const url = metadata.url || `file://${slug}.txt`;
    const docAuthor = metadata.docAuthor || 'Anonymous';
    const description = metadata.description || 'No description found';
    const docSource = metadata.docSource || 'vault';
    const chunkSource = metadata.chunkSource || `${slug}.txt`;
    const published = this.normalizePublishedDate(metadata.published);

    const words = textContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const tokenCountEstimate = Math.ceil(textContent.length / 4);

    // Chunking logic
    const maxWords = options.maxChunkWords || 150;
    const chunks: DocumentChunk[] = [];

    // Split along double-newline paragraphs first
    const paragraphs = textContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let currentChunkWords: string[] = [];
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(Boolean);
      if (currentChunkWords.length + paraWords.length <= maxWords) {
        currentChunkWords.push(...paraWords);
      } else {
        if (currentChunkWords.length > 0) {
          const chunkText = currentChunkWords.join(' ');
          chunks.push({
            chunkIndex: chunkIndex++,
            text: chunkText,
            wordCount: currentChunkWords.length,
            tokenCountEstimate: Math.ceil(chunkText.length / 4),
          });
          currentChunkWords = [];
        }
        currentChunkWords.push(...paraWords);
      }
    }

    if (currentChunkWords.length > 0) {
      const chunkText = currentChunkWords.join(' ');
      chunks.push({
        chunkIndex: chunkIndex++,
        text: chunkText,
        wordCount: currentChunkWords.length,
        tokenCountEstimate: Math.ceil(chunkText.length / 4),
      });
    }

    return {
      id,
      title,
      url,
      docAuthor,
      description,
      docSource,
      chunkSource,
      published,
      wordCount,
      tokenCountEstimate,
      chunks: chunks.length > 0 ? chunks : [{
        chunkIndex: 0,
        text: textContent,
        wordCount,
        tokenCountEstimate,
      }],
    };
  }
}
