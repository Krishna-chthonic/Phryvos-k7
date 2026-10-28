/**
 * @file accessibility-tree-parser.ts
 * @description Clean-room TypeScript adaptation of DOM/HTML accessibility tree serialization
 * and interactive element indexing inspired by browser-use. Generates token-efficient
 * indexed accessibility views [0], [1], [2] for agent interaction.
 */

import { createHash } from 'crypto';

export interface InteractiveElement {
  index: number;
  tag: string;
  type?: string;
  name?: string;
  role?: string;
  text: string;
  value?: string;
  placeholder?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
  elementHash?: string;
}

export interface AccessibilityTreeResult {
  serializedTree: string;
  selectorMap: Record<number, InteractiveElement>;
  interactiveCount: number;
}

/**
 * Axis-aligned rectangle for paint-order occlusion detection (browser-use pattern)
 */
export class Rect {
  constructor(
    public readonly x1: number,
    public readonly y1: number,
    public readonly x2: number,
    public readonly y2: number
  ) {}

  public area(): number {
    return Math.max(0, this.x2 - this.x1) * Math.max(0, this.y2 - this.y1);
  }

  public intersects(other: Rect): boolean {
    return !(this.x2 <= other.x1 || other.x2 <= this.x1 || this.y2 <= other.y1 || other.y2 <= this.y1);
  }

  public contains(other: Rect): boolean {
    return this.x1 <= other.x1 && this.y1 <= other.y1 && this.x2 >= other.x2 && this.y2 >= other.y2;
  }
}

/**
 * Disjoint union of rectangles for occlusion filtering (inspired by browser-use RectUnionPure)
 */
export class RectUnionPure {
  private rects: Rect[] = [];

  public add(rect: Rect): void {
    let toAdd: Rect[] = [rect];
    for (const r of this.rects) {
      const next: Rect[] = [];
      for (const piece of toAdd) {
        if (!piece.intersects(r)) {
          next.push(piece);
        } else {
          next.push(...this.splitDiff(piece, r));
        }
      }
      toAdd = next;
      if (toAdd.length === 0) break;
    }
    this.rects.push(...toAdd);
  }

  public isCovered(target: Rect): boolean {
    for (const r of this.rects) {
      if (r.contains(target)) return true;
    }
    return false;
  }

  private splitDiff(a: Rect, b: Rect): Rect[] {
    const parts: Rect[] = [];
    if (a.y1 < b.y1) parts.push(new Rect(a.x1, a.y1, a.x2, b.y1));
    if (b.y2 < a.y2) parts.push(new Rect(a.x1, b.y2, a.x2, a.y2));
    const yLo = Math.max(a.y1, b.y1);
    const yHi = Math.min(a.y2, b.y2);
    if (a.x1 < b.x1) parts.push(new Rect(a.x1, yLo, b.x1, yHi));
    if (b.x2 < a.x2) parts.push(new Rect(b.x2, yLo, a.x2, yHi));
    return parts;
  }
}

/**
 * Computes deterministic 16-hex element hash for stable DOM tracking across turns (browser-use pattern)
 */
export function computeElementHash(tag: string, branchPath: string[], attrs: Record<string, string>): string {
  const combined = `${branchPath.join('/')}|${tag}|id=${attrs.id || ''}|name=${attrs.name || ''}|aria=${attrs['aria-label'] || ''}`;
  return createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

const DYNAMIC_CLASSES = new Set([
  'focus',
  'hover',
  'active',
  'selected',
  'disabled',
  'animation',
  'transition',
  'loading',
  'open',
  'closed',
  'expanded',
  'collapsed',
  'visible',
  'hidden',
  'pressed',
  'checked',
  'highlighted',
  'current',
]);

export class AccessibilityTreeParser {
  /**
   * Parses an HTML fragment or page into an indexed accessibility tree with a selector map.
   */
  public parse(html: string): AccessibilityTreeResult {
    if (!html || typeof html !== 'string') {
      return { serializedTree: '', selectorMap: {}, interactiveCount: 0 };
    }

    const selectorMap: Record<number, InteractiveElement> = {};
    let currentIndex = 0;

    // 1. Collapse SVG elements first
    let processed = html.replace(/<svg[\s\S]*?<\/svg>/gi, '<svg /> <!-- SVG content collapsed -->');

    // 2. Strip script, style, comments
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');
    processed = processed.replace(/<(?:script|style|noscript)[\s\S]*?<\/(?:script|style|noscript)>/gi, '');

    // 3. Find and index interactive elements
    // We match specific interactive tags or elements with interactive roles/handlers
    // Avoid matching generic non-interactive containers that swallow children.
    const patterns = [
      {
        // Void/Self-closing input elements
        regex: /<input\b([^>]*?)\/?>/gi,
        isVoid: true,
        tag: 'input',
      },
      {
        // Button elements
        regex: /<button\b([^>]*?)>([\s\S]*?)<\/button>/gi,
        isVoid: false,
        tag: 'button',
      },
      {
        // Anchor elements
        regex: /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi,
        isVoid: false,
        tag: 'a',
      },
      {
        // Select elements
        regex: /<select\b([^>]*?)>([\s\S]*?)<\/select>/gi,
        isVoid: false,
        tag: 'select',
      },
      {
        // Textarea elements
        regex: /<textarea\b([^>]*?)>([\s\S]*?)<\/textarea>/gi,
        isVoid: false,
        tag: 'textarea',
      },
      {
        // ARIA interactive elements (role=button, combobox, link, checkbox, tab)
        regex: /<(div|span|section|li|p)\b([^>]*(?:role=["'](?:button|link|combobox|checkbox|tab|menuitem)["']|onclick)[^>]*)>([\s\S]*?)<\/\1>/gi,
        isVoid: false,
        tag: 'aria',
      },
    ];

    interface FoundCandidate {
      position: number;
      tag: string;
      rawAttrs: string;
      innerContent: string;
    }

    const candidates: FoundCandidate[] = [];

    for (const p of patterns) {
      let match: RegExpExecArray | null;
      while ((match = p.regex.exec(processed)) !== null) {
        if (p.isVoid) {
          candidates.push({
            position: match.index,
            tag: p.tag,
            rawAttrs: match[1] || '',
            innerContent: '',
          });
        } else if (p.tag === 'aria') {
          candidates.push({
            position: match.index,
            tag: match[1].toLowerCase(),
            rawAttrs: match[2] || '',
            innerContent: match[3] || '',
          });
        } else {
          candidates.push({
            position: match.index,
            tag: p.tag,
            rawAttrs: match[1] || '',
            innerContent: match[2] || '',
          });
        }
      }
    }

    // Sort candidates by document appearance order
    candidates.sort((a, b) => a.position - b.position);

    const lines: string[] = [];

    for (const cand of candidates) {
      const attrs = this.parseAttributes(cand.rawAttrs);
      const isInteractive = this.checkIsInteractive(cand.tag, attrs);

      if (isInteractive) {
        const text = this.cleanText(cand.innerContent) || attrs['aria-label'] || attrs['title'] || attrs['placeholder'] || attrs['value'] || '';
        const idx = currentIndex++;

        const item: InteractiveElement = {
          index: idx,
          tag: cand.tag,
          type: attrs['type'],
          name: attrs['name'],
          role: attrs['role'] || (cand.tag === 'button' ? 'button' : cand.tag === 'a' ? 'link' : undefined),
          text: text.slice(0, 120),
          value: attrs['value'],
          placeholder: attrs['placeholder'],
          href: attrs['href'],
          disabled: attrs['disabled'] !== undefined,
          checked: attrs['checked'] !== undefined,
          elementHash: computeElementHash(cand.tag, ['body', cand.tag], attrs),
        };

        selectorMap[idx] = item;

        // Build concise LLM-friendly line
        const attrParts: string[] = [];
        if (item.type) attrParts.push(`type="${item.type}"`);
        if (item.name) attrParts.push(`name="${item.name}"`);
        if (item.placeholder) attrParts.push(`placeholder="${item.placeholder}"`);
        if (item.value) attrParts.push(`value="${item.value}"`);
        if (item.href) attrParts.push(`href="${item.href}"`);
        if (item.role && item.role !== cand.tag) attrParts.push(`role="${item.role}"`);
        if (item.disabled) attrParts.push(`disabled`);

        const attrStr = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
        const line = `[${idx}] <${cand.tag}${attrStr}>${item.text}</${cand.tag}>`;
        lines.push(line);
      }
    }

    const serializedTree = lines.join('\n');

    return {
      serializedTree,
      selectorMap,
      interactiveCount: currentIndex,
    };
  }

  private checkIsInteractive(tag: string, attrs: Record<string, string>): boolean {
    if (['button', 'select', 'textarea'].includes(tag)) return true;
    if (tag === 'input' && attrs['type'] !== 'hidden') return true;
    if (tag === 'a' && attrs['href']) return true;

    const role = (attrs['role'] || '').toLowerCase();
    if (['button', 'link', 'combobox', 'checkbox', 'radio', 'tab', 'menuitem'].includes(role)) {
      return true;
    }

    if (attrs['onclick'] || attrs['tabindex']) return true;
    return false;
  }

  private parseAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-z0-9_-]+)(?:=["']([^"']*)["'])?/gi;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(attrString)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[2] !== undefined ? match[2] : 'true';
      attrs[key] = val;
    }

    return attrs;
  }

  private cleanText(str: string): string {
    return str
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
