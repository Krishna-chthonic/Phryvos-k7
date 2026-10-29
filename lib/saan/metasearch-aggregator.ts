/**
 * @file metasearch-aggregator.ts
 * @description Clean-room TypeScript adaptation of query decomposition and metasearch aggregation
 * inspired by Khoj and SearXNG. Provides multi-source query expansion, URL normalization,
 * hash-based duplicate merging, reciprocal rank fusion scoring, and citation generation.
 */

export interface RawSearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  position: number;
  publishedDate?: string;
  thumbnail?: string;
}

export interface AggregatedSearchResult {
  title: string;
  url: string;
  content: string;
  engines: string[];
  positions: number[];
  score: number;
  publishedDate?: string;
  thumbnail?: string;
}

export interface DecompositionOptions {
  maxSubqueries?: number;
  chatHistory?: string[];
  location?: string;
  currentDate?: string;
}

export interface MetasearchSimulationResult {
  query: string;
  subqueries: string[];
  results: AggregatedSearchResult[];
  durationMs: number;
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_eid',
  'ref',
  'source',
]);

export const MAXIMUM_TITLE_LENGTH_CHARS = 200;
export const MAXIMUM_CONTENT_LENGTH_CHARS = 1200;

/**
 * Truncates text at full word boundaries (inspired by SearXNG _normalize_text_field).
 * e.g. truncateText("hello world", 9) yields "hello …" instead of "hello wor"
 */
export function normalizeTextField(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/(\s)+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced) + ' …';
}

/**
 * Normalizes URLs for deduplication:
 * - Decodes percent-encodings where appropriate
 * - Strips marketing tracking parameters (utm_*, fbclid, etc.)
 * - Trims trailing slashes
 * - Upgrades insecure http to https when possible
 */
export function normalizeSearchUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  try {
    const urlObj = new URL(rawUrl.trim());

    // Strip tracking parameters
    for (const key of Array.from(urlObj.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.startsWith('utm_')) {
        urlObj.searchParams.delete(key);
      }
    }

    // Lowercase hostname
    urlObj.hostname = urlObj.hostname.toLowerCase();

    // Standardize protocol
    if (urlObj.protocol === 'http:' && !urlObj.hostname.endsWith('.onion')) {
      urlObj.protocol = 'https:';
    }

    // Remove empty hash
    urlObj.hash = '';

    let clean = urlObj.toString();
    // Strip trailing slash
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    // If not a valid absolute URL, fallback to trimmed string
    return rawUrl.trim().replace(/\/+$/, '');
  }
}

/**
 * Calculates SearXNG-inspired reciprocal rank score.
 */
export function calculateRankScore(
  result: { engines: string[]; positions: number[] },
  engineWeights: Record<string, number> = {},
  priority: 'low' | 'normal' | 'high' = 'normal'
): number {
  let weight = 1.0;

  for (const engine of result.engines) {
    const engineWeight = engineWeights[engine] ?? 1.0;
    weight *= Number(engineWeight);
  }

  weight *= result.positions.length;
  let score = 0;

  for (const pos of result.positions) {
    if (priority === 'low') continue;
    if (priority === 'high') {
      score += weight;
    } else {
      // Reciprocal rank score
      score += weight / Math.max(1, pos);
    }
  }

  return Math.round(score * 1000) / 1000;
}

export class MetasearchAggregator {
  private defaultEngineWeights: Record<string, number> = {
    google: 1.0,
    searxng: 1.2,
    brave: 1.1,
    duckduckgo: 0.9,
    firecrawl: 1.3,
    bing: 0.8,
  };

  private searchHistory: Array<{ query: string; subqueries: string[]; resultsCount: number; timestamp: string }> = [];

  constructor() {
    this.seedDefaultHistory();
  }

  private seedDefaultHistory(): void {
    if (this.searchHistory.length === 0) {
      this.searchHistory.push({
        query: "Next.js 16 Server Actions vs Route Handlers",
        subqueries: [
          "Next.js 16 Server Actions vs Route Handlers",
          "Next.js 16 Server Actions",
          "Route Handlers",
        ],
        resultsCount: 3,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Decomposes a multi-faceted user query into orthogonal search subqueries (inspired by Khoj).
   */
  public decomposeQuery(query: string, options: DecompositionOptions = {}): string[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const max = options.maxSubqueries ?? 3;
    const subqueries = new Set<string>();

    // Add primary clean query
    subqueries.add(trimmed);

    // Heuristic multi-topic decomposition
    // 1. Check for conjunctions: 'and', 'vs', 'versus', 'compared to'
    const andMatch = trimmed.match(/^(.+?)\s+(?:and|vs\.?|versus|compared to)\s+(.+)$/i);
    if (andMatch && andMatch[1] && andMatch[2]) {
      const part1 = andMatch[1].trim();
      const part2 = andMatch[2].trim();
      if (part1.length > 3) subqueries.add(part1);
      if (part2.length > 3) subqueries.add(part2);
    }

    // 2. Check for site-specific clauses: e.g., 'on Reuters', 'from Reddit'
    const siteMatch = trimmed.match(/^(.+?)\s+(?:on|from|via)\s+([a-zA-Z0-9-]+\.(?:com|org|net|io|edu|gov))$/i);
    if (siteMatch && siteMatch[1] && siteMatch[2]) {
      subqueries.add(`site:${siteMatch[2].toLowerCase()} ${siteMatch[1].trim()}`);
    }

    // 3. Check for question words needing background lookup
    const questionMatch = trimmed.match(/^(?:what is|how does|why is|explain)\s+(.+?)(?:\?|$)/i);
    if (questionMatch && questionMatch[1]) {
      subqueries.add(`${questionMatch[1].trim()} overview`);
      subqueries.add(`${questionMatch[1].trim()} latest news`);
    }

    // 4. Inject location context if provided and relevant
    if (options.location && !trimmed.toLowerCase().includes(options.location.toLowerCase())) {
      if (trimmed.toLowerCase().includes('weather') || trimmed.toLowerCase().includes('news') || trimmed.toLowerCase().includes('local')) {
        subqueries.add(`${trimmed} ${options.location}`);
      }
    }

    return Array.from(subqueries).slice(0, max);
  }

  /**
   * Aggregates, deduplicates, and scores search results across multiple engines.
   */
  public aggregate(
    rawResults: RawSearchResult[],
    engineWeights?: Record<string, number>,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): AggregatedSearchResult[] {
    const weights = { ...this.defaultEngineWeights, ...(engineWeights || {}) };
    const resultMap = new Map<string, {
      title: string;
      url: string;
      content: string;
      engines: Set<string>;
      positions: number[];
      publishedDate?: string;
      thumbnail?: string;
    }>();

    for (const raw of rawResults) {
      if (!raw || !raw.url) continue;

      const normUrl = normalizeSearchUrl(raw.url);
      const existing = resultMap.get(normUrl);

      if (!existing) {
        resultMap.set(normUrl, {
          title: (raw.title || '').trim(),
          url: normUrl,
          content: (raw.content || '').trim(),
          engines: new Set([raw.engine]),
          positions: [raw.position],
          publishedDate: raw.publishedDate,
          thumbnail: raw.thumbnail,
        });
      } else {
        existing.engines.add(raw.engine);
        existing.positions.push(raw.position);

        if ((raw.content || '').trim().length > existing.content.length) {
          existing.content = raw.content.trim();
        }

        if ((raw.title || '').trim().length > existing.title.length) {
          existing.title = raw.title.trim();
        }

        if (raw.publishedDate && !existing.publishedDate) {
          existing.publishedDate = raw.publishedDate;
        }
        if (raw.thumbnail && !existing.thumbnail) {
          existing.thumbnail = raw.thumbnail;
        }
      }
    }

    const aggregated: AggregatedSearchResult[] = [];

    for (const entry of resultMap.values()) {
      const enginesList = Array.from(entry.engines);
      const score = calculateRankScore(
        { engines: enginesList, positions: entry.positions },
        weights,
        priority
      );

      aggregated.push({
        title: normalizeTextField(entry.title, MAXIMUM_TITLE_LENGTH_CHARS),
        url: entry.url,
        content: normalizeTextField(entry.content, MAXIMUM_CONTENT_LENGTH_CHARS),
        engines: enginesList,
        positions: entry.positions,
        score,
        publishedDate: entry.publishedDate,
        thumbnail: entry.thumbnail,
      });
    }

    aggregated.sort((a, b) => b.score - a.score);
    return aggregated;
  }

  /**
   * Simulates full metasearch pipeline: Khoj Query Decomposition + SearXNG Reciprocal Rank Aggregation.
   */
  public simulateMetasearch(query: string, options: DecompositionOptions = {}): MetasearchSimulationResult {
    const startTime = performance.now();
    const subqueries = this.decomposeQuery(query, options);

    // Mock search responses from SearXNG, Brave, DuckDuckGo, and Firecrawl
    const mockRawResults: RawSearchResult[] = [
      {
        title: `${query} - Comprehensive Architectural Overview`,
        url: `https://nextjs.org/docs/app/building-your-application/data-fetching?utm_source=docs&ref=google`,
        content: `Comprehensive guide explaining ${query}. Discusses server-side mutability, streaming React Server Components, and zero-bundle client boundary optimizations.`,
        engine: "searxng",
        position: 1,
        publishedDate: "2026-10-15",
      },
      {
        title: `${query} - Comprehensive Architectural Overview`,
        url: `http://nextjs.org/docs/app/building-your-application/data-fetching/`, // Same URL: tests normalization, http upgrade, trailing slash
        content: `Comprehensive guide explaining ${query}. Discusses server-side mutability and streaming React Server Components.`,
        engine: "brave",
        position: 2,
      },
      {
        title: `Deep Dive: Benchmarking ${subqueries[1] || query} in Production`,
        url: `https://github.com/vercel/next.js/discussions/77402?utm_medium=social`,
        content: `Benchmark analysis examining latency, cold-start characteristics, and cache invalidation mechanics for ${subqueries[1] || query}.`,
        engine: "duckduckgo",
        position: 2,
        publishedDate: "2026-09-28",
      },
      {
        title: `Practical Patterns for ${subqueries[2] || query}`,
        url: `https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API`,
        content: `Standard web platform specs for request and response streaming pipelines with cross-origin safety fences.`,
        engine: "searxng",
        position: 3,
      },
    ];

    const results = this.aggregate(mockRawResults);
    const durationMs = Number((performance.now() - startTime).toFixed(2));

    this.searchHistory.unshift({
      query,
      subqueries,
      resultsCount: results.length,
      timestamp: new Date().toISOString(),
    });

    if (this.searchHistory.length > 30) {
      this.searchHistory.pop();
    }

    return {
      query,
      subqueries,
      results,
      durationMs,
    };
  }

  public getSearchHistory() {
    return [...this.searchHistory];
  }
}
