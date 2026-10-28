/**
 * @file clean-markdown-scraper.ts
 * @description Clean-room TypeScript adaptation of web content cleaning and markdown extraction
 * inspired by Firecrawl. Strips boilerplate HTML (headers, footers, nav, cookie popups, ads),
 * resolves relative links and srcset images, and converts the clean body into semantic Markdown.
 */

export interface ScrapedPageMetadata {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  canonicalUrl?: string;
  author?: string;
}

export interface CleanMarkdownResult {
  markdown: string;
  metadata: ScrapedPageMetadata;
  extractedLinks: string[];
  extractedImages: string[];
}

export interface ScrapeCleanOptions {
  baseUrl?: string;
  onlyMainContent?: boolean;
  maxContentLength?: number;
  excludeTags?: string[];
}

const DEFAULT_EXCLUDE_TAGS = [
  'header',
  'footer',
  'nav',
  'aside',
  'script',
  'style',
  'noscript',
  'iframe',
];

const NOISE_CLASS_ID_REGEX = /(header|footer|nav|navbar|sidebar|modal|popup|overlay|ad|ads|advert|cookie|banner|share|social|breadcrumbs|widget)/i;

export class CleanMarkdownScraper {
  /**
   * Cleans raw HTML and converts it into structured semantic markdown.
   */
  public cleanAndConvert(rawHtml: string, options: ScrapeCleanOptions = {}): CleanMarkdownResult {
    if (!rawHtml || typeof rawHtml !== 'string') {
      return { markdown: '', metadata: {}, extractedLinks: [], extractedImages: [] };
    }

    const baseUrl = options.baseUrl || 'https://example.com';
    const metadata = this.extractMetadata(rawHtml);
    const extractedLinks: string[] = [];
    const extractedImages: string[] = [];

    // 1. Remove comments
    let processed = rawHtml.replace(/<!--[\s\S]*?-->/g, '');

    // 2. Remove script and style elements completely
    processed = processed.replace(/<(?:script|style|noscript|template)[\s\S]*?<\/(?:script|style|noscript|template)>/gi, '');

    // 3. If onlyMainContent requested, attempt to extract <main> or <article> or <div id="main"> first
    if (options.onlyMainContent !== false) {
      const mainMatch = processed.match(/<(?:main|article)[\s\S]*?<\/(?:main|article)>/i);
      if (mainMatch) {
        processed = mainMatch[0];
      }
    }

    // 4. Strip noise elements with matching tags/classes/ids
    const excludeTags = options.excludeTags || DEFAULT_EXCLUDE_TAGS;
    for (const tag of excludeTags) {
      const tagRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      processed = processed.replace(tagRegex, '');
    }

    // Strip elements where class or id matches noise regex
    processed = processed.replace(/<([a-z0-9]+)[^>]*(?:id|class)=["'][^"']*(?:cookie|popup|banner|advert|sidebar)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, '');

    // 5. Parse images & resolve srcset
    processed = processed.replace(/<img([^>]+)>/gi, (_, attrs) => {
      let src = '';
      let alt = '';
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
      const srcsetMatch = attrs.match(/srcset=["']([^"']+)["']/i);

      if (altMatch) alt = altMatch[1];

      if (srcsetMatch) {
        // Parse candidates and take highest resolution
        const candidates = srcsetMatch[1].split(',').map((c: string) => {
          const parts = c.trim().split(/\s+/);
          const url = parts[0];
          const descriptor = parts[1] || '1x';
          const size = parseFloat(descriptor.replace(/[wx]/i, '')) || 1;
          return { url, size };
        });
        candidates.sort((a: { size: number }, b: { size: number }) => b.size - a.size);
        if (candidates.length > 0 && candidates[0].url) {
          src = candidates[0].url;
        }
      }

      if (!src && srcMatch) {
        src = srcMatch[1];
      }

      if (src) {
        const resolvedSrc = this.resolveUrl(src, baseUrl);
        extractedImages.push(resolvedSrc);
        return `![${alt}](${resolvedSrc})`;
      }
      return '';
    });

    // 6. Parse links and resolve absolute URLs
    processed = processed.replace(/<a([^>]+)>([\s\S]*?)<\/a>/gi, (_, attrs, content) => {
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      const cleanContent = this.stripTags(content).trim();
      if (hrefMatch && hrefMatch[1] && !hrefMatch[1].startsWith('#') && !hrefMatch[1].startsWith('javascript:')) {
        const resolvedHref = this.resolveUrl(hrefMatch[1], baseUrl);
        extractedLinks.push(resolvedHref);
        return `[${cleanContent || resolvedHref}](${resolvedHref})`;
      }
      return cleanContent;
    });

    // 7. Convert headings
    processed = processed.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => `\n# ${this.stripTags(text).trim()}\n`);
    processed = processed.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => `\n## ${this.stripTags(text).trim()}\n`);
    processed = processed.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => `\n### ${this.stripTags(text).trim()}\n`);
    processed = processed.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, text) => `\n#### ${this.stripTags(text).trim()}\n`);

    // 8. Convert list items
    processed = processed.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `\n- ${this.stripTags(text).trim()}`);

    // 9. Convert blockquotes & code blocks
    processed = processed.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => `\n> ${this.stripTags(text).trim()}\n`);
    processed = processed.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `\n\`\`\`\n${this.stripTags(code).trim()}\n\`\`\`\n`);
    processed = processed.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => `\`${this.stripTags(code).trim()}\``);

    // 10. Convert tables
    processed = processed.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
      return this.convertHtmlTableToMarkdown(tableContent);
    });

    // 11. Convert paragraphs and line breaks
    processed = processed.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n\n${this.stripTags(text).trim()}\n\n`);
    processed = processed.replace(/<br\s*\/?>/gi, '\n');

    // 12. Strip all remaining HTML tags
    processed = this.stripTags(processed);

    // 13. Clean excessive whitespace and blank lines
    let markdown = processed
      .split('\n')
      .map(line => line.trim())
      .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
      .join('\n')
      .trim();

    if (options.maxContentLength && markdown.length > options.maxContentLength) {
      markdown = markdown.slice(0, options.maxContentLength) + '...';
    }

    return {
      markdown,
      metadata,
      extractedLinks: Array.from(new Set(extractedLinks)),
      extractedImages: Array.from(new Set(extractedImages)),
    };
  }

  private extractMetadata(html: string): ScrapedPageMetadata {
    const metadata: ScrapedPageMetadata = {};

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) metadata.title = this.stripTags(titleMatch[1]).trim();

    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    if (descMatch) metadata.description = descMatch[1].trim();

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
    if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1].trim();

    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i);
    if (ogDescMatch) metadata.ogDescription = ogDescMatch[1].trim();

    const canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
    if (canonMatch) metadata.canonicalUrl = canonMatch[1].trim();

    const authorMatch = html.match(/<meta\s+name=["']author["']\s+content=["']([^"']*)["']/i);
    if (authorMatch) metadata.author = authorMatch[1].trim();

    return metadata;
  }

  private convertHtmlTableToMarkdown(tableHtml: string): string {
    const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rows.length === 0) return '';

    const markdownRows: string[] = [];
    let isFirstRow = true;

    for (const row of rows) {
      const cells = row.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
      const rowValues = cells.map(cell => this.stripTags(cell).trim().replace(/\|/g, '\\|'));
      if (rowValues.length > 0) {
        markdownRows.push(`| ${rowValues.join(' | ')} |`);
        if (isFirstRow) {
          const sep = rowValues.map(() => '---');
          markdownRows.push(`| ${sep.join(' | ')} |`);
          isFirstRow = false;
        }
      }
    }

    return `\n${markdownRows.join('\n')}\n`;
  }

  private stripTags(str: string): string {
    return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  private resolveUrl(href: string, base: string): string {
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  }
}
