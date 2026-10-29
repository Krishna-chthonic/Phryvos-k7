/**
 * @file accessibility-tree-parser.test.ts
 * @description Comprehensive unit tests for Browser-Use Accessibility Tree DOM Parser
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AccessibilityTreeParser,
  Rect,
  RectUnionPure,
  computeElementHash,
} from '../../lib/saan/accessibility-tree-parser';

describe('Browser-Use Accessibility Tree DOM Parser (Repo #33)', () => {
  const parser = new AccessibilityTreeParser();

  test('Occlusion Detection - Rect intersection and containment', () => {
    const r1 = new Rect(0, 0, 100, 100);
    const r2 = new Rect(50, 50, 150, 150);
    const r3 = new Rect(200, 200, 300, 300);
    const inside = new Rect(10, 10, 50, 50);

    assert.equal(r1.area(), 10000);
    assert.equal(r1.intersects(r2), true);
    assert.equal(r1.intersects(r3), false);
    assert.equal(r1.contains(inside), true);
    assert.equal(inside.contains(r1), false);
  });

  test('Occlusion Detection - RectUnionPure coverage check', () => {
    const union = new RectUnionPure();
    union.add(new Rect(0, 0, 100, 100));

    const covered = new Rect(20, 20, 80, 80);
    const partial = new Rect(50, 50, 150, 150);

    assert.equal(union.isCovered(covered), true);
    assert.equal(union.isCovered(partial), false);
  });

  test('Element Hash - Deterministic SHA-256 calculation', () => {
    const hash1 = computeElementHash('button', ['body', 'form', 'button'], { id: 'btn-submit', name: 'submit' });
    const hash2 = computeElementHash('button', ['body', 'form', 'button'], { id: 'btn-submit', name: 'submit' });
    const hash3 = computeElementHash('button', ['body', 'div', 'button'], { id: 'btn-submit', name: 'submit' });

    assert.equal(hash1.length, 16);
    assert.equal(hash1, hash2, 'Identical structure must generate identical hash');
    assert.notEqual(hash1, hash3, 'Different branch path must generate different hash');
  });

  test('DOM Parser - Strips scripts, styles, comments, collapses SVG', () => {
    const html = `
      <div>
        <script>alert("malicious");</script>
        <style>.hidden { display: none; }</style>
        <!-- A hidden comment -->
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>
        <button id="ok-btn">Confirm</button>
      </div>
    `;

    const result = parser.parse(html);
    assert.equal(result.interactiveCount, 1);
    assert.ok(result.selectorMap[0]);
    assert.equal(result.selectorMap[0].tag, 'button');
    assert.equal(result.selectorMap[0].text, 'Confirm');
    assert.ok(result.serializedTree.includes('[0] <button>Confirm</button>'));
    assert.ok(!result.serializedTree.includes('alert'));
    assert.ok(!result.serializedTree.includes('circle'));
  });

  test('DOM Parser - Accurately indexes form inputs, links, and ARIA roles', () => {
    const html = `
      <form action="/login">
        <label>Email: <input type="email" name="user_email" placeholder="you@domain.com" /></label>
        <label>Password: <input type="password" name="user_pwd" /></label>
        <button type="submit">Log In</button>
        <a href="/forgot">Forgot Password?</a>
        <div role="button" aria-label="Guest Access">Continue as Guest</div>
      </form>
    `;

    const result = parser.parse(html);
    assert.equal(result.interactiveCount, 5);

    // [0] input email
    assert.equal(result.selectorMap[0].tag, 'input');
    assert.equal(result.selectorMap[0].type, 'email');
    assert.equal(result.selectorMap[0].placeholder, 'you@domain.com');

    // [1] input password
    assert.equal(result.selectorMap[1].tag, 'input');
    assert.equal(result.selectorMap[1].type, 'password');

    // [2] button submit
    assert.equal(result.selectorMap[2].tag, 'button');
    assert.equal(result.selectorMap[2].text, 'Log In');

    // [3] anchor
    assert.equal(result.selectorMap[3].tag, 'a');
    assert.equal(result.selectorMap[3].href, '/forgot');

    // [4] aria role button
    assert.equal(result.selectorMap[4].role, 'button');
    assert.equal(result.selectorMap[4].text, 'Continue as Guest');
  });

  test('DOM Parser - Gracefully handles empty and malformed input', () => {
    const emptyResult = parser.parse('');
    assert.equal(emptyResult.interactiveCount, 0);
    assert.equal(emptyResult.serializedTree, '');

    const textOnly = parser.parse('<p>Just plain text without anything clickable.</p>');
    assert.equal(textOnly.interactiveCount, 0);
  });
});
