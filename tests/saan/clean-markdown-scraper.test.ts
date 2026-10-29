import test from "node:test";
import assert from "node:assert/strict";
import {
  CleanMarkdownScraper,
  FirecrawlDocumentStore,
  CMP_POPUP_PATTERNS,
} from "../../lib/saan/clean-markdown-scraper";

test("Firecrawl Scraper - Shadow DOM Flattening & Slot Resolution", () => {
  const scraper = new CleanMarkdownScraper();
  const shadowHtml = `
    <div class="custom-card">
      <style scoped>.card { color: red; }</style>
      <slot name="header">Default Header</slot>
      <slot>Default Content</slot>
    </div>
  `;

  const flattened = scraper.flattenShadowDom(shadowHtml);
  assert.ok(!flattened.includes("scoped"));
  assert.ok(flattened.includes("Default Header"));
  assert.ok(flattened.includes("Default Content"));
});

test("Firecrawl Scraper - CMP Cookie Banners & Boilerplate Removal", () => {
  const scraper = new CleanMarkdownScraper();
  const dirtyHtml = `
    <html>
      <head><title>Test Article Title</title></head>
      <body>
        <header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
        <div id="onetrust-consent-sdk"><p>We use cookies to track you</p></div>
        <div class="CybotCookiebotDialog"><p>Consent dialog</p></div>
        <main>
          <h1>Actual Article Heading</h1>
          <p>This is the essential main content that should be preserved.</p>
        </main>
        <footer><p>© 2026 Commercial Corp</p></footer>
      </body>
    </html>
  `;

  const result = scraper.cleanAndConvert(dirtyHtml, { onlyMainContent: true });

  assert.ok(result.markdown.includes("# Actual Article Heading"));
  assert.ok(result.markdown.includes("This is the essential main content"));
  assert.ok(!result.markdown.includes("Home"));
  assert.ok(!result.markdown.includes("cookies to track you"));
  assert.ok(!result.markdown.includes("Consent dialog"));
  assert.ok(!result.markdown.includes("Commercial Corp"));
});

test("Firecrawl Scraper - Srcset Image Resolution & Highest Density Selection", () => {
  const scraper = new CleanMarkdownScraper();
  const imgHtml = `
    <main>
      <img src="/img/thumb.png" alt="Architecture Diagram" srcset="/img/small.png 1x, /img/large-2x.png 2x, /img/ultra-3x.png 3x">
    </main>
  `;

  const result = scraper.cleanAndConvert(imgHtml, { baseUrl: "https://example.com/blog/" });

  assert.ok(result.markdown.includes("![Architecture Diagram](https://example.com/img/ultra-3x.png)"));
  assert.equal(result.extractedImages.length, 1);
  assert.equal(result.extractedImages[0], "https://example.com/img/ultra-3x.png");
});

test("Firecrawl Scraper - Table Conversion to GitHub Flavored Markdown", () => {
  const scraper = new CleanMarkdownScraper();
  const tableHtml = `
    <main>
      <table>
        <tr><th>Framework</th><th>Latency (ms)</th><th>Memory (MB)</th></tr>
        <tr><td>Next.js 16</td><td>42</td><td>128</td></tr>
        <tr><td>Standard Node</td><td>110</td><td>256</td></tr>
      </table>
    </main>
  `;

  const result = scraper.cleanAndConvert(tableHtml);

  assert.ok(result.markdown.includes("| Framework | Latency (ms) | Memory (MB) |"));
  assert.ok(result.markdown.includes("| --- | --- | --- |"));
  assert.ok(result.markdown.includes("| Next.js 16 | 42 | 128 |"));
  assert.ok(result.markdown.includes("| Standard Node | 110 | 256 |"));
});

test("Firecrawl Document Store - Article Archival & Lookup", () => {
  const store = new FirecrawlDocumentStore();
  const articles = store.getArticles();

  assert.ok(articles.length >= 1, "Should initialize with pre-seeded demo article");
  assert.ok(articles.some((a) => a.id === "art-nextjs-rsc"));

  const custom = store.recordArticle("https://test.io/specs", {
    markdown: "# Specifications\n\nFull clean spec document.",
    metadata: { title: "Test Spec", author: "Tester" },
    extractedLinks: ["https://test.io/a", "https://test.io/b"],
    extractedImages: ["https://test.io/logo.png"],
  });

  assert.ok(custom.id.startsWith("art-"));
  assert.equal(custom.title, "Test Spec");
  assert.equal(custom.extractedLinksCount, 2);
  assert.equal(custom.extractedImagesCount, 1);

  const lookup = store.getArticleById(custom.id);
  assert.ok(lookup);
  assert.equal(lookup?.markdown, "# Specifications\n\nFull clean spec document.");
});
