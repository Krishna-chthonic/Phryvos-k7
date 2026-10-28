/**
 * @file document-collector-vault.ts
 * @description Clean-room TypeScript adaptation of Anything-LLM's document collector,
 * metadata normalization, JavaScript epoch 1970 bug defense, Obsidian wikilink parsing,
 * and semantic text chunking.
 * Inspired by Mintplex-Labs/anything-llm (0941fb0, MIT).
 */

import { createHash } from 'crypto';

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
  checksum: string;
  wikilinks?: string[];
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
  detectedWikilinks: string[];
}

export class DocumentCollector {
  /**
   * Slugifies strings into safe lowercase ASCII identifiers, stripping file extensions.
   */
  public slugify(text: string): string {
    const withoutExt = text.includes('.') ? text.split('.').slice(0, -1).join('-') : text;
    return withoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled';
  }

  /**
   * Calculates deterministic SHA-256 checksum for byte or string payloads.
   */
  public calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Normalizes the `published` metadata key into a locale/ISO date string.
   * Defends against JavaScript's `Number(falsy)` coercion bug which turns
   * null, boolean, whitespace, or empty arrays into 0 (epoch 1970).
   */
  public normalizePublishedDate(val?: unknown): string {
    if (
      val === null ||
      val === undefined ||
      typeof val === 'boolean' ||
      (typeof val === 'object' && Array.isArray(val)) ||
      `${val}`.trim() === ''
    ) {
      return new Date().toISOString();
    }

    const num = Number(val);
    if (!isNaN(num) && isFinite(num)) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    const parsed = new Date(String(val));
    if (!isNaN(parsed.getTime())) return parsed.toISOString();

    return new Date().toISOString();
  }

  /**
   * Normalizes URL metadata key into a web URI or local file scheme.
   */
  public normalizeUrl(url: string | undefined, title: string): string {
    if (url && typeof url === 'string') {
      try {
        const u = new URL(url);
        if (['http:', 'https:'].includes(u.protocol)) {
          return `web://${url.toLowerCase()}.website`;
        }
      } catch {
        // Fall back to file scheme
      }
    }
    return `file://${this.slugify(title)}.txt`;
  }

  /**
   * Parses Obsidian-style wikilinks: `[[Target]]` or `[[Target|Alias]]`.
   */
  public extractWikilinks(text: string): string[] {
    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const target = match[1].trim();
      if (target && !links.includes(target)) {
        links.push(target);
      }
    }
    return links;
  }

  /**
   * Ingests and normalizes raw text documents and splits into searchable chunks
   * with paragraph boundaries and token estimation.
   */
  public processRawText(
    textContent: string,
    metadata: DocumentMetadata,
    options: { maxChunkWords?: number; overlapWords?: number } = {}
  ): IngestedDocument {
    if (!textContent || typeof textContent !== 'string') {
      throw new Error('textContent must be a non-empty string');
    }

    if (!metadata?.title || typeof metadata.title !== 'string') {
      throw new Error('metadata.title must be a non-empty string');
    }

    const titleSlug = this.slugify(metadata.title);
    const id = `doc_${titleSlug}_${Date.now()}`;

    const title = metadata.title;
    const filename = `${titleSlug}.txt`;
    const url = this.normalizeUrl(metadata.url, metadata.title);
    const docAuthor = typeof metadata.docAuthor === 'string' ? metadata.docAuthor : 'no author specified';
    const description = typeof metadata.description === 'string' ? metadata.description : 'no description found';
    const docSource = typeof metadata.docSource === 'string' ? metadata.docSource : 'no source set';
    const chunkSource = typeof metadata.chunkSource === 'string' ? metadata.chunkSource : `${titleSlug}.txt`;
    const published = this.normalizePublishedDate(metadata.published);

    const words = textContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const tokenCountEstimate = Math.ceil(textContent.length / 4);

    const allWikilinks = this.extractWikilinks(textContent);

    // Paragraph-based chunking with word limit
    const maxWords = options.maxChunkWords || 150;
    const overlap = options.overlapWords || 0;
    const rawParagraphs = textContent.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    const chunks: DocumentChunk[] = [];
    let currentWords: string[] = [];
    let currentText = '';

    for (const paragraph of rawParagraphs) {
      const pWords = paragraph.split(/\s+/).filter(Boolean);

      if (currentWords.length + pWords.length > maxWords && currentWords.length > 0) {
        const text = currentText.trim();
        chunks.push({
          chunkIndex: chunks.length,
          text,
          wordCount: currentWords.length,
          tokenCountEstimate: Math.ceil(text.length / 4),
          checksum: this.calculateChecksum(text),
          wikilinks: this.extractWikilinks(text),
        });

        // Retain overlap if requested
        if (overlap > 0 && currentWords.length > overlap) {
          const overlapSlice = currentWords.slice(-overlap);
          currentWords = [...overlapSlice, ...pWords];
          currentText = overlapSlice.join(' ') + '\n\n' + paragraph;
        } else {
          currentWords = [...pWords];
          currentText = paragraph;
        }
      } else {
        currentWords.push(...pWords);
        currentText = currentText ? `${currentText}\n\n${paragraph}` : paragraph;
      }
    }

    if (currentWords.length > 0) {
      const text = currentText.trim();
      chunks.push({
        chunkIndex: chunks.length,
        text,
        wordCount: currentWords.length,
        tokenCountEstimate: Math.ceil(text.length / 4),
        checksum: this.calculateChecksum(text),
        wikilinks: this.extractWikilinks(text),
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
      chunks,
      detectedWikilinks: allWikilinks,
    };
  }
}
