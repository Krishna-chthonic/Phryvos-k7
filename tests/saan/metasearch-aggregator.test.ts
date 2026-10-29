import test from "node:test";
import assert from "node:assert/strict";
import {
  MetasearchAggregator,
  normalizeSearchUrl,
  normalizeTextField,
  calculateRankScore,
  type RawSearchResult,
} from "../../lib/saan/metasearch-aggregator";

test("SearXNG - URL Normalization & Tracking Token Stripping", () => {
  const dirtyUrl = "http://example.com/blog/article/?utm_source=twitter&utm_medium=cpc&fbclid=12345#section";
  const cleanUrl = normalizeSearchUrl(dirtyUrl);

  assert.equal(cleanUrl, "https://example.com/blog/article");
  assert.ok(!cleanUrl.includes("utm_source"));
  assert.ok(!cleanUrl.includes("fbclid"));
  assert.ok(!cleanUrl.endsWith("/"));
  assert.ok(cleanUrl.startsWith("https://"));
});

test("SearXNG - Text Normalization at Full Word Boundaries", () => {
  const text = "The quick brown fox jumps over the lazy dog";
  const truncated = normalizeTextField(text, 20);

  assert.equal(truncated, "The quick brown fox …", "Should truncate cleanly at word boundary without breaking words");
  assert.ok(!truncated.includes("jumps"));

  const shortText = "Hello World";
  assert.equal(normalizeTextField(shortText, 50), "Hello World");
});

test("SearXNG - Reciprocal Rank Fusion (RRF) Scoring", () => {
  const singleEngineHighRank = calculateRankScore(
    { engines: ["google"], positions: [1] },
    { google: 1.0 }
  );

  const singleEngineLowRank = calculateRankScore(
    { engines: ["google"], positions: [10] },
    { google: 1.0 }
  );

  assert.ok(singleEngineHighRank > singleEngineLowRank, "Position 1 must rank higher than Position 10");

  const multiEngineCorroborated = calculateRankScore(
    { engines: ["google", "searxng"], positions: [1, 2] },
    { google: 1.0, searxng: 1.2 }
  );

  assert.ok(multiEngineCorroborated > singleEngineHighRank, "Multi-engine corroboration must boost ranking score");
});

test("Khoj - Multi-Topic Query Decomposition", () => {
  const aggregator = new MetasearchAggregator();

  // 1. Conjunction / Comparison query
  const comparison = aggregator.decomposeQuery("Vite vs Webpack for Next.js");
  assert.ok(comparison.length >= 2);
  assert.ok(comparison.some((q) => q.toLowerCase().includes("vite")));
  assert.ok(comparison.some((q) => q.toLowerCase().includes("webpack")));

  // 2. Site-specific query
  const siteQuery = aggregator.decomposeQuery("react 19 release notes on reddit.com");
  assert.ok(siteQuery.some((q) => q.includes("site:reddit.com")));

  // 3. Question exploration
  const questionQuery = aggregator.decomposeQuery("what is bi-temporal memory calculus?");
  assert.ok(questionQuery.some((q) => q.includes("overview")));
});

test("SearXNG & Khoj - Multi-Source Aggregation & Deduplication", () => {
  const aggregator = new MetasearchAggregator();

  const rawResults: RawSearchResult[] = [
    {
      title: "React 19 Official Documentation",
      url: "https://react.dev/blog/2024/12/05/react-19?utm_source=twitter",
      content: "Short intro snippet",
      engine: "google",
      position: 1,
    },
    {
      title: "React 19 Official Documentation and Upgrade Guide",
      url: "http://react.dev/blog/2024/12/05/react-19/",
      content: "Exhaustive long intro snippet discussing actions, async transitions and useOptimistic hook in detail.",
      engine: "searxng",
      position: 1,
    },
    {
      title: "Community thoughts on React 19",
      url: "https://news.ycombinator.com/item?id=42323",
      content: "Discussion on React 19 features",
      engine: "duckduckgo",
      position: 3,
    },
  ];

  const aggregated = aggregator.aggregate(rawResults);

  // The 2 duplicate react.dev URLs should be merged into 1
  assert.equal(aggregated.length, 2);

  const reactDevResult = aggregated.find((r) => r.url === "https://react.dev/blog/2024/12/05/react-19");
  assert.ok(reactDevResult);
  assert.equal(reactDevResult.engines.length, 2, "Merged result should list both google and searxng");
  assert.ok(reactDevResult.content.includes("Exhaustive long intro"), "Longest snippet should prevail");
  assert.ok(reactDevResult.score > aggregated[1].score, "Corroborated result should rank first");
});

test("SearXNG & Khoj - Metasearch Simulation Pipeline", () => {
  const aggregator = new MetasearchAggregator();
  const sim = aggregator.simulateMetasearch("Bun vs Node.js in 2026");

  assert.ok(sim.subqueries.length >= 2);
  assert.ok(sim.results.length >= 2);
  assert.ok(sim.durationMs >= 0);

  const history = aggregator.getSearchHistory();
  assert.ok(history.length >= 2);
  assert.equal(history[0].query, "Bun vs Node.js in 2026");
});
